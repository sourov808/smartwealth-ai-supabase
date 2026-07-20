"""Gmail HTTP, and the token dance that precedes it.

This module holds no credentials. It asks the Next.js app for an access token
and spends it. Google's client id, the client secret, the refresh token and
INTEGRATION_ENCRYPTION_KEY all live in that other process and none of them exist
here — so a compromise of the agent service yields a token with an hour to live
and read-only scope, not standing access to a mailbox.

## Why metadata rather than full message bodies

`format=metadata` returns the headers we ask for plus Gmail's own `snippet` — a
~200 character plain-text preview that Google has already extracted from
whatever MIME and HTML the sender used. `format=full` would mean walking
multipart trees, base64url-decoding parts, and stripping HTML, to produce a
worse version of a string the API hands over for free.

It is also the difference between roughly 80 tokens per message and roughly 600.
At eight messages that is ~640 tokens instead of ~4,800, against a ceiling of
8,000 per minute.

The cost is real and worth stating: a snippet can cut off before the total on a
long receipt. When that starts mattering, the fix is to fetch `format=full` for
the few messages the user drills into, not to fetch it for everything up front.
"""

import asyncio
import logging

import httpx

from agent_service.config import Settings

log = logging.getLogger(__name__)

GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me"

# Hard ceiling on messages per search, enforced here rather than trusted to the
# model's argument. Every message is prompt tokens on the next call.
MAX_RESULTS = 8

# Gmail is a third party on the request path of a chat message. A user watching
# a spinner will not wait longer than this, and neither should we.
TIMEOUT = httpx.Timeout(15.0, connect=5.0)

# Headers worth spending tokens on. `To` and `Cc` are omitted deliberately: they
# are the user's own address on nearly every message and say nothing.
HEADERS = ["From", "Subject", "Date"]


class GmailError(Exception):
    """Base for everything this module raises."""


class NotConnected(GmailError):
    """No Gmail account is linked. A normal state, not a failure."""


class ReconnectRequired(GmailError):
    """The refresh token is dead — expired, revoked, or never issued.

    Distinct from NotConnected because the user's next step differs: they have a
    connection, and it needs re-consenting rather than setting up.
    """


async def access_token(settings: Settings, jwt: str) -> str:
    """Ask Next.js for a token this user's mailbox will accept.

    Both credentials are required by the endpoint: the JWT says whose mailbox,
    the shared secret says the caller is this service rather than a browser.
    """
    url = f"{settings.app_base_url}/api/integrations/gmail/token"

    async with httpx.AsyncClient(timeout=TIMEOUT) as http:
        response = await http.get(
            url,
            headers={
                "Authorization": f"Bearer {jwt}",
                "X-Agent-Secret": settings.agent_service_secret,
            },
        )

    if response.status_code == 404:
        raise NotConnected("Gmail is not connected for this user.")
    if response.status_code == 409:
        raise ReconnectRequired("The Gmail connection expired.")
    if response.status_code != 200:
        # 403 means the shared secret is wrong or missing — a deployment fault,
        # not a user fault, so it is worth a loud log.
        raise GmailError(
            f"Token endpoint returned {response.status_code}: {response.text[:200]}"
        )

    token = response.json().get("accessToken")
    if not token:
        raise GmailError("Token endpoint returned no accessToken.")
    return token


def _header(message: dict, name: str) -> str:
    for header in message.get("payload", {}).get("headers", []):
        if header.get("name", "").lower() == name.lower():
            return header.get("value", "")
    return ""


async def _get_message(http: httpx.AsyncClient, token: str, message_id: str) -> dict:
    params = [("format", "metadata")] + [("metadataHeaders", h) for h in HEADERS]

    response = await http.get(
        f"{GMAIL_API}/messages/{message_id}",
        params=params,
        headers={"Authorization": f"Bearer {token}"},
    )
    response.raise_for_status()
    raw = response.json()

    return {
        "from": _header(raw, "From"),
        "subject": _header(raw, "Subject"),
        "date": _header(raw, "Date"),
        # Already plain text, already truncated by Google.
        "snippet": raw.get("snippet", ""),
    }


async def search(token: str, query: str, limit: int = MAX_RESULTS) -> list[dict]:
    """Run a Gmail search and return the matching messages, newest first.

    Two round trips by design: `messages.list` returns bare ids, so each hit
    needs its own `messages.get`. Those run concurrently — eight sequential
    requests to Google would dominate the response time of the whole chat turn.
    """
    limit = max(1, min(limit, MAX_RESULTS))

    async with httpx.AsyncClient(timeout=TIMEOUT) as http:
        listing = await http.get(
            f"{GMAIL_API}/messages",
            params={"q": query, "maxResults": limit},
            headers={"Authorization": f"Bearer {token}"},
        )

        if listing.status_code == 401:
            # The token was accepted when minted and rejected a moment later.
            # Revocation mid-flight is the realistic cause.
            raise ReconnectRequired("Google rejected the access token.")
        listing.raise_for_status()

        ids = [m["id"] for m in listing.json().get("messages", [])]
        if not ids:
            return []

        results = await asyncio.gather(
            *(_get_message(http, token, mid) for mid in ids),
            return_exceptions=True,
        )

    # One failed fetch should not lose the other seven. A partial answer beats
    # an error the user cannot act on.
    messages = []
    for result in results:
        if isinstance(result, Exception):
            log.warning("Skipping a Gmail message that failed to fetch: %s", result)
            continue
        messages.append(result)

    return messages
