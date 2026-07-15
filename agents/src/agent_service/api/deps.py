"""Request-scoped dependencies.

We deliberately do NOT verify the JWT signature here. Supabase verifies it on
every PostgREST request, and a forged token simply fails there. Verifying twice
would mean holding the JWT secret in this service for no added protection.

This layer only extracts the token. The database decides whether it is real.
"""

from fastapi import Header, HTTPException


def get_jwt(authorization: str = Header(default="")) -> str:
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(
            status_code=401,
            detail="Expected an 'Authorization: Bearer <jwt>' header",
        )
    return token.strip()
