# Agent Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Python FastAPI service in `agents/` that exposes a streaming chat endpoint where an LLM reads and writes the user's Supabase financial data through eight fixed, typed tools.

**Architecture:** Four layers with one direction of dependency — `api/` → `agent/` → `tools/` → `db/`. Nothing skips a layer. The user's Supabase JWT is forwarded from the frontend and attached to every database call, so Postgres RLS (not application code) enforces user isolation. The service holds no service-role key and no delete capability.

**Tech Stack:** Python 3.13, uv, FastAPI 0.139, OpenAI Agents SDK 0.18 (`openai-agents`, pointed at Groq `openai/gpt-oss-120b`), supabase-py 2.31, pydantic 2.13, pytest 9.1.

**Scope:** This plan delivers the Python service only. The deliverable is a curl-able SSE endpoint. Frontend integration (Next.js `/api/chat` route, chat panel, delete confirmation card) is a separate plan written after this one lands.

Design spec: `docs/superpowers/specs/2026-07-15-agentic-layer-design.md`

---

## Global Constraints

- **All commands run from `agents/`.** Use `uv run <cmd>`. Never call `python` or `pytest` directly.
- **`@function_tool(strict_mode=False)` on EVERY tool.** Non-negotiable, and verified against live Groq. The SDK's `strict_mode=True` default (a) forces optional arguments into the schema's `required` list, so the model invents values for filters the user never mentioned, and (b) makes `Optional[SomeEnum]` emit `anyOf: [Enum, null]`, which Groq rejects with `400 ... anyOf branches must be disambiguated via a required discriminator`. Task 6 includes a regression test.
- **Async, with one rule.** `Runner.run_streamed()` is an async iterator, so `api/`, `agent/`, and the tool functions are `async def`. **supabase-py is synchronous** — every db call inside a tool goes through `asyncio.to_thread`, or it blocks the event loop. The `db/` layer itself stays plain sync functions, which keeps it trivial to read and test.
- **Tracing stays off.** Call `set_tracing_disabled(True)` at model construction. The SDK's built-in tracing wants an OpenAI API key this service does not have. Tracing is handled by other tooling.
- **The database is the enforcement point.** Every `db/` call goes through a client built from the user's JWT. Never filter by `user_id` in Python and call it security — RLS is the guarantee.
- **No `SUPABASE_SERVICE_ROLE_KEY` in this service, ever.** It bypasses RLS. Background workers get their own service later.
- **The service never deletes.** `propose_delete_transaction` reads and returns; Next.js executes the delete after user confirmation.
- **A failed tool call is data for the LLM, not an HTTP error.** Every tool passes a `failure_error_function` so exceptions come back to the model as a readable string.
- **Never hardcode a Groq model ID.** It comes from the `GROQ_MODEL` env var. (For reference, the verified working value is `openai/gpt-oss-120b` — note the `openai/` prefix; the bare `gpt-oss-120b` 404s.)
- **Exact vocabulary** (verified against the frontend, which is the only source of truth — the DB columns are plain `string` with no CHECK constraints):
  - `type`: `expense` | `income`
  - `recurring_interval`: `none` | `daily` | `weekly` | `monthly` | `yearly`
  - Expense categories: `Food`, `Utilities`, `Transport`, `Entertainment`, `Housing`, `Health`, `Shopping`, `Others`
  - Income categories: `Salary`, `Freelance`, `Investment`, `Gift`, `Others`
  - Capitalization is exact. The budgets page matches categories by string equality, so `"food"` silently fails to match the `"Food"` budget.

---

## Manual Prerequisites

These require a human and block specific tasks. Do them before starting the task named.

- [x] **DONE:** `GROQ_API_KEY` and `GROQ_MODEL=openai/gpt-oss-120b` are in `agents/.env`. The model was confirmed present on the live models endpoint and confirmed to perform tool calling end-to-end against a real Groq call.
- [x] **DONE:** Dependencies installed via `uv add supabase openai openai-agents fastapi "pydantic>=2" python-dotenv` and `uv add --dev pytest pytest-asyncio httpx`.
- [ ] **Before Task 3:** Create two test users in the Supabase dashboard (Authentication → Users → Add user), with "Auto Confirm User" checked so no email round-trip is needed. Then append to `agents/.env`:
  ```
  TEST_USER_A_EMAIL=
  TEST_USER_A_PASSWORD=
  TEST_USER_B_EMAIL=
  TEST_USER_B_PASSWORD=
  ```
  These exist so the isolation test can prove user A cannot read user B's rows. Without two real users, that test cannot be written honestly.

---

## File Structure

```
agents/
  .env                              # secrets, gitignored (already created)
  pyproject.toml                    # deps already added; needs build-system (Task 1)
  src/agent_service/
    __init__.py
    config.py                       # env -> Settings, fails loudly
    models.py                       # pydantic types + enums, shared by tools/ and db/
    main.py                         # FastAPI app assembly only
    db/
      __init__.py
      errors.py                     # NotFound, PermissionDenied, DbError
      client.py                     # build a JWT-scoped supabase client
      transactions.py               # list/insert/update/get
      budgets.py                    # list/upsert
      profiles.py                   # get
    tools/
      __init__.py
      handlers.py                   # arg dict -> db call -> result dict
      registry.py                   # name -> (schema, handler); builds the OpenAI tools array
    llm/
      __init__.py
      client.py                     # OpenAI SDK -> Groq
      prompts.py                    # system prompt
      loop.py                       # the tool-calling loop, yields events
    api/
      __init__.py
      deps.py                       # Bearer JWT -> UserContext
      chat.py                       # POST /chat -> SSE
  tests/
    conftest.py                     # shared fixtures (settings, test-user JWTs)
    test_config.py
    test_models.py
    test_db_isolation.py            # THE security test
    test_db_transactions.py
    test_db_budgets_profiles.py
    test_tools.py
    test_llm_loop.py
    test_api.py
```

Note: `tools/schemas.py` from the spec is dropped. Pydantic generates JSON schemas directly from `models.py`, so a separate schemas module would be an empty indirection. `registry.py` does the generation.

---

### Task 1: Scaffold and config

**Files:**
- Modify: `agents/pyproject.toml`
- Create: `agents/src/agent_service/__init__.py`
- Create: `agents/src/agent_service/config.py`
- Create: `agents/tests/test_config.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `Settings` (frozen dataclass with `groq_api_key: str`, `groq_model: str`, `supabase_url: str`, `supabase_anon_key: str`) and `load_settings() -> Settings`.

- [ ] **Step 1: Make the project installable**

The current `pyproject.toml` has no `[build-system]`, so a `src/` layout will not be importable. Append:

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/agent_service"]

[tool.pytest.ini_options]
testpaths = ["tests"]
```

- [ ] **Step 2: Write the failing test**

Create `agents/tests/test_config.py`:

```python
import pytest

from agent_service.config import Settings, load_settings

ALL_VARS = {
    "GROQ_API_KEY": "gsk_test",
    "GROQ_MODEL": "some-model",
    "SUPABASE_URL": "https://example.supabase.co",
    "SUPABASE_ANON_KEY": "anon_test",
}


def test_load_settings_reads_all_vars(monkeypatch):
    for key, value in ALL_VARS.items():
        monkeypatch.setenv(key, value)

    settings = load_settings()

    assert settings.groq_api_key == "gsk_test"
    assert settings.groq_model == "some-model"
    assert settings.supabase_url == "https://example.supabase.co"
    assert settings.supabase_anon_key == "anon_test"


@pytest.mark.parametrize("missing", sorted(ALL_VARS))
def test_load_settings_fails_loudly_on_missing_var(monkeypatch, missing):
    for key, value in ALL_VARS.items():
        monkeypatch.setenv(key, value)
    monkeypatch.setenv(missing, "")

    with pytest.raises(RuntimeError, match=missing):
        load_settings()


def test_settings_is_frozen(monkeypatch):
    for key, value in ALL_VARS.items():
        monkeypatch.setenv(key, value)
    settings = load_settings()

    with pytest.raises(Exception):
        settings.groq_model = "other"
```

- [ ] **Step 3: Run it to make sure it fails**

Run: `uv run pytest tests/test_config.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'agent_service'`

- [ ] **Step 4: Write the implementation**

Create `agents/src/agent_service/__init__.py` (empty file).

Create `agents/src/agent_service/config.py`:

```python
"""Environment loading. Every setting is required; there are no silent defaults."""

import os
from dataclasses import dataclass

from dotenv import load_dotenv


@dataclass(frozen=True)
class Settings:
    groq_api_key: str
    groq_model: str
    supabase_url: str
    supabase_anon_key: str


def _require(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(
            f"Missing required environment variable: {name}. See agents/.env"
        )
    return value


def load_settings() -> Settings:
    # Real env vars win over .env, so deployment can override the file.
    load_dotenv(override=False)
    return Settings(
        groq_api_key=_require("GROQ_API_KEY"),
        groq_model=_require("GROQ_MODEL"),
        supabase_url=_require("SUPABASE_URL"),
        supabase_anon_key=_require("SUPABASE_ANON_KEY"),
    )
```

- [ ] **Step 5: Run the tests and make sure they pass**

Run: `uv run pytest tests/test_config.py -v`
Expected: PASS (6 tests — 1 + 4 parametrized + 1)

If you see `ModuleNotFoundError` still, run `uv sync` to install the project in editable mode, then retry.

- [ ] **Step 6: Commit**

```bash
git add agents/pyproject.toml agents/uv.lock agents/src agents/tests
git commit -m "feat(agents): scaffold service and env config"
```

---

### Task 2: Domain models

**Files:**
- Create: `agents/src/agent_service/models.py`
- Create: `agents/tests/test_models.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `TransactionType`, `RecurringInterval`, `Category` (StrEnums); `EXPENSE_CATEGORIES`, `INCOME_CATEGORIES` (frozensets); and the eight tool-argument models: `ListTransactionsArgs`, `SummarizeSpendingArgs`, `ListBudgetsArgs`, `GetProfileArgs`, `AddTransactionArgs`, `UpdateTransactionArgs`, `SetBudgetArgs`, `ProposeDeleteTransactionArgs`.

**Why this task matters:** the database columns are plain `string` with no CHECK constraints. These enums are the *only* thing keeping the agent's vocabulary aligned with the frontend's. Without them the agent can write `category="Groceries"` and the budgets page will silently never match it.

- [ ] **Step 1: Write the failing test**

Create `agents/tests/test_models.py`:

```python
import pytest
from pydantic import ValidationError

from agent_service.models import (
    AddTransactionArgs,
    Category,
    ListTransactionsArgs,
    RecurringInterval,
    SetBudgetArgs,
    SummarizeSpendingArgs,
    TransactionType,
)


def test_enum_values_match_the_frontend_exactly():
    assert TransactionType.EXPENSE == "expense"
    assert TransactionType.INCOME == "income"
    assert {r.value for r in RecurringInterval} == {
        "none", "daily", "weekly", "monthly", "yearly"
    }
    assert Category.FOOD == "Food"


def test_add_transaction_defaults_recurring_to_none():
    args = AddTransactionArgs(amount=40, type="expense", category="Food")
    assert args.recurring_interval == RecurringInterval.NONE


def test_add_transaction_rejects_negative_amount():
    with pytest.raises(ValidationError):
        AddTransactionArgs(amount=-5, type="expense", category="Food")


def test_add_transaction_rejects_category_from_the_wrong_type():
    # "Salary" is an income category; pairing it with an expense is nonsense.
    with pytest.raises(ValidationError, match="not valid for type"):
        AddTransactionArgs(amount=40, type="expense", category="Salary")


def test_add_transaction_allows_others_for_both_types():
    AddTransactionArgs(amount=40, type="expense", category="Others")
    AddTransactionArgs(amount=40, type="income", category="Others")


def test_list_transactions_clamps_limit():
    assert ListTransactionsArgs().limit == 50
    with pytest.raises(ValidationError):
        ListTransactionsArgs(limit=500)


def test_summarize_requires_a_valid_group_by():
    args = SummarizeSpendingArgs(
        start_date="2026-07-01", end_date="2026-07-31", group_by="category"
    )
    assert args.group_by == "category"
    with pytest.raises(ValidationError):
        SummarizeSpendingArgs(
            start_date="2026-07-01", end_date="2026-07-31", group_by="weekday"
        )


def test_set_budget_requires_month_year_format():
    SetBudgetArgs(category="Food", month_year="2026-07", limit_amount=300)
    with pytest.raises(ValidationError):
        SetBudgetArgs(category="Food", month_year="July 2026", limit_amount=300)
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `uv run pytest tests/test_models.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'agent_service.models'`

- [ ] **Step 3: Write the implementation**

Create `agents/src/agent_service/models.py`:

```python
"""Shared domain types.

These enums are the contract with the frontend. The database columns are plain
`string` with no CHECK constraints, so nothing in Postgres stops the agent from
inventing a category. Validation here is what keeps the agent's vocabulary
aligned with the UI's.

Source of truth: components/dashboard/transaction-modal.tsx
"""

from enum import StrEnum
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


class TransactionType(StrEnum):
    EXPENSE = "expense"
    INCOME = "income"


class RecurringInterval(StrEnum):
    NONE = "none"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"


class Category(StrEnum):
    FOOD = "Food"
    UTILITIES = "Utilities"
    TRANSPORT = "Transport"
    ENTERTAINMENT = "Entertainment"
    HOUSING = "Housing"
    HEALTH = "Health"
    SHOPPING = "Shopping"
    SALARY = "Salary"
    FREELANCE = "Freelance"
    INVESTMENT = "Investment"
    GIFT = "Gift"
    OTHERS = "Others"


EXPENSE_CATEGORIES = frozenset({
    Category.FOOD, Category.UTILITIES, Category.TRANSPORT,
    Category.ENTERTAINMENT, Category.HOUSING, Category.HEALTH,
    Category.SHOPPING, Category.OTHERS,
})

INCOME_CATEGORIES = frozenset({
    Category.SALARY, Category.FREELANCE, Category.INVESTMENT,
    Category.GIFT, Category.OTHERS,
})

DATE = Field(pattern=r"^\d{4}-\d{2}-\d{2}$", description="ISO date, YYYY-MM-DD")
MONTH_YEAR = Field(pattern=r"^\d{4}-\d{2}$", description="Month, YYYY-MM")


def _check_category_matches_type(
    category: Optional[Category], type_: Optional[TransactionType]
) -> None:
    if category is None or type_ is None:
        return
    allowed = EXPENSE_CATEGORIES if type_ is TransactionType.EXPENSE else INCOME_CATEGORIES
    if category not in allowed:
        raise ValueError(
            f"category '{category.value}' is not valid for type '{type_.value}'. "
            f"Valid options: {sorted(c.value for c in allowed)}"
        )


# --- Read tools ---

class ListTransactionsArgs(BaseModel):
    start_date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    end_date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    category: Optional[Category] = None
    type: Optional[TransactionType] = None
    limit: int = Field(50, ge=1, le=200)


class SummarizeSpendingArgs(BaseModel):
    start_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    end_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    group_by: Literal["category", "type", "month"]


class ListBudgetsArgs(BaseModel):
    month_year: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}$")


class GetProfileArgs(BaseModel):
    pass


# --- Write tools ---

class AddTransactionArgs(BaseModel):
    amount: float = Field(gt=0, description="Positive magnitude; `type` carries the sign")
    type: TransactionType
    category: Category
    date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    description: Optional[str] = None
    recurring_interval: RecurringInterval = RecurringInterval.NONE

    @model_validator(mode="after")
    def category_matches_type(self):
        _check_category_matches_type(self.category, self.type)
        return self


class UpdateTransactionArgs(BaseModel):
    id: str
    amount: Optional[float] = Field(None, gt=0)
    type: Optional[TransactionType] = None
    category: Optional[Category] = None
    date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    description: Optional[str] = None
    recurring_interval: Optional[RecurringInterval] = None

    @model_validator(mode="after")
    def category_matches_type(self):
        # Only checkable when both are supplied. A partial update that changes
        # only the category is validated by the handler, which reads the row first.
        _check_category_matches_type(self.category, self.type)
        return self

    def changes(self) -> dict:
        """Fields the caller actually set, ready for a PATCH body."""
        return self.model_dump(exclude={"id"}, exclude_none=True, mode="json")


class SetBudgetArgs(BaseModel):
    category: Category
    month_year: str = Field(pattern=r"^\d{4}-\d{2}$")
    limit_amount: float = Field(gt=0)

    @model_validator(mode="after")
    def budgets_are_expense_only(self):
        if self.category not in EXPENSE_CATEGORIES:
            raise ValueError(
                f"category '{self.category.value}' is not valid for type 'expense'. "
                "Budgets apply to expense categories only."
            )
        return self


class ProposeDeleteTransactionArgs(BaseModel):
    id: str
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `uv run pytest tests/test_models.py -v`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add agents/src/agent_service/models.py agents/tests/test_models.py
git commit -m "feat(agents): add domain models with frontend-aligned vocabulary"
```

---

### Task 3: Database client and the isolation test

**Files:**
- Create: `agents/src/agent_service/db/__init__.py`
- Create: `agents/src/agent_service/db/errors.py`
- Create: `agents/src/agent_service/db/client.py`
- Create: `agents/tests/conftest.py`
- Create: `agents/tests/test_db_isolation.py`

**Interfaces:**
- Consumes: `Settings` from Task 1.
- Produces: `create_user_client(settings: Settings, jwt: str) -> Client`; exceptions `DbError`, `NotFound`, `PermissionDenied`; pytest fixtures `settings`, `jwt_a`, `jwt_b`, `client_a`, `client_b`.

**Requires:** the Manual Prerequisite creating two test users.

**This is the most important task in the plan.** The isolation test *is* the security model. If it does not pass, nothing else in this service is safe to run.

- [ ] **Step 1: Write the failing test**

Create `agents/tests/conftest.py`:

```python
"""Shared fixtures. Integration fixtures need the two test users from the
Manual Prerequisites; they skip cleanly if those env vars are absent.
"""

import os

import pytest
from supabase import ClientOptions, create_client

from agent_service.config import load_settings
from agent_service.db.client import create_user_client


@pytest.fixture(scope="session")
def settings():
    return load_settings()


def _sign_in(settings, email_var: str, password_var: str) -> str:
    email = os.environ.get(email_var, "").strip()
    password = os.environ.get(password_var, "").strip()
    if not email or not password:
        pytest.skip(f"{email_var}/{password_var} not set; see Manual Prerequisites")

    anon = create_client(
        settings.supabase_url,
        settings.supabase_anon_key,
        options=ClientOptions(persist_session=False, auto_refresh_token=False),
    )
    session = anon.auth.sign_in_with_password({"email": email, "password": password})
    return session.session.access_token


@pytest.fixture(scope="session")
def jwt_a(settings):
    return _sign_in(settings, "TEST_USER_A_EMAIL", "TEST_USER_A_PASSWORD")


@pytest.fixture(scope="session")
def jwt_b(settings):
    return _sign_in(settings, "TEST_USER_B_EMAIL", "TEST_USER_B_PASSWORD")


@pytest.fixture
def client_a(settings, jwt_a):
    return create_user_client(settings, jwt_a)


@pytest.fixture
def client_b(settings, jwt_b):
    return create_user_client(settings, jwt_b)
```

Create `agents/tests/test_db_isolation.py`:

```python
"""The security model, as a test.

If any test here fails, stop. The service is not safe to run.
"""

import pytest

from agent_service.db.client import create_user_client


def test_client_sends_both_apikey_and_authorization(settings, jwt_a):
    # Supabase's gateway 401s without `apikey`, and supabase-py skips adding it
    # when you supply your own Authorization header. Both must be present.
    client = create_user_client(settings, jwt_a)
    headers = {k.lower(): v for k, v in client.options.headers.items()}

    assert headers["apikey"] == settings.supabase_anon_key
    assert headers["authorization"] == f"Bearer {jwt_a}"


def test_a_user_can_read_their_own_rows(client_a, jwt_a):
    inserted = (
        client_a.table("transactions")
        .insert({"amount": 1.23, "type": "expense", "category": "Others",
                 "date": "2026-01-01", "description": "isolation-test-a"})
        .execute()
    )
    row_id = inserted.data[0]["id"]

    found = client_a.table("transactions").select("*").eq("id", row_id).execute()
    assert len(found.data) == 1

    client_a.table("transactions").delete().eq("id", row_id).execute()


def test_user_b_cannot_read_user_a_rows(client_a, client_b):
    """THE test. User A inserts; user B must not see it."""
    inserted = (
        client_a.table("transactions")
        .insert({"amount": 999.99, "type": "expense", "category": "Others",
                 "date": "2026-01-01", "description": "isolation-test-secret"})
        .execute()
    )
    row_id = inserted.data[0]["id"]

    try:
        # Direct lookup by primary key — the most targeted read possible.
        leaked = client_b.table("transactions").select("*").eq("id", row_id).execute()
        assert leaked.data == [], "RLS LEAK: user B read user A's transaction"

        # And it must not appear in an unfiltered scan either.
        all_b = client_b.table("transactions").select("description").execute()
        descriptions = [r["description"] for r in all_b.data]
        assert "isolation-test-secret" not in descriptions
    finally:
        client_a.table("transactions").delete().eq("id", row_id).execute()


def test_user_b_cannot_delete_user_a_rows(client_a, client_b):
    inserted = (
        client_a.table("transactions")
        .insert({"amount": 5.0, "type": "expense", "category": "Others",
                 "date": "2026-01-01", "description": "isolation-test-delete"})
        .execute()
    )
    row_id = inserted.data[0]["id"]

    try:
        client_b.table("transactions").delete().eq("id", row_id).execute()
        still_there = client_a.table("transactions").select("id").eq("id", row_id).execute()
        assert len(still_there.data) == 1, "RLS LEAK: user B deleted user A's transaction"
    finally:
        client_a.table("transactions").delete().eq("id", row_id).execute()


def test_a_forged_user_id_is_rejected_or_ignored(client_a, jwt_b, settings):
    """The agent hallucinating someone else's user_id must not write to their data."""
    client_b = create_user_client(settings, jwt_b)
    b_id = client_b.auth.get_user(jwt_b).user.id

    try:
        client_a.table("transactions").insert({
            "amount": 1.0, "type": "expense", "category": "Others",
            "date": "2026-01-01", "description": "isolation-test-forged",
            "user_id": b_id,  # forged
        }).execute()
    except Exception:
        return  # RLS rejected the write outright — the desired outcome.

    leaked = (
        client_b.table("transactions").select("id")
        .eq("description", "isolation-test-forged").execute()
    )
    assert leaked.data == [], "RLS LEAK: user A wrote a row into user B's data"
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `uv run pytest tests/test_db_isolation.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'agent_service.db'`

- [ ] **Step 3: Write the implementation**

Create `agents/src/agent_service/db/__init__.py` (empty file).

Create `agents/src/agent_service/db/errors.py`:

```python
"""Database-layer exceptions. The tools layer converts these into tool results
the model can read; they must never reach the HTTP layer as 500s.
"""


class DbError(Exception):
    """Base for anything the database layer raises."""


class NotFound(DbError):
    """The row does not exist, or RLS hid it. Indistinguishable by design."""


class PermissionDenied(DbError):
    """RLS refused the write. A real signal that something is wrong."""
```

Create `agents/src/agent_service/db/client.py`:

```python
"""Builds a Supabase client scoped to one user's JWT.

Two non-obvious facts about supabase-py 2.31, both verified against the live
project. Getting either wrong silently breaks the service or its security:

1. Supabase's gateway requires an `apikey` header. A request with only
   `Authorization: Bearer <jwt>` returns 401 "No API key found in request".

2. `Client.create()` only injects the `apikey` header when you have NOT supplied
   your own `Authorization` header (see supabase/_sync/client.py:108). Because we
   always supply one, we must pass `apikey` ourselves. Passing a `headers` dict
   also replaces the library's defaults entirely, so nothing else fills it in.

Hence: both headers, explicitly, every time.
"""

from supabase import Client, ClientOptions, create_client

from agent_service.config import Settings


def create_user_client(settings: Settings, jwt: str) -> Client:
    """A client whose every query runs as the user identified by `jwt`.

    RLS — not this code — is what stops one user reading another's rows.
    """
    return create_client(
        settings.supabase_url,
        settings.supabase_anon_key,
        options=ClientOptions(
            headers={
                "apiKey": settings.supabase_anon_key,
                "Authorization": f"Bearer {jwt}",
            },
            # This is a stateless server handling many users. Never persist a
            # session to disk, and never spawn a refresh thread per request.
            persist_session=False,
            auto_refresh_token=False,
        ),
    )
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `uv run pytest tests/test_db_isolation.py -v`
Expected: PASS (5 tests)

**If `test_user_b_cannot_read_user_a_rows` fails, STOP.** Your RLS policies are not protecting the `transactions` table. Fix the policies in Supabase before writing another line of this service. Do not work around it in Python.

If tests SKIP, the test-user env vars are missing — see Manual Prerequisites.

- [ ] **Step 5: Commit**

```bash
git add agents/src/agent_service/db agents/tests/conftest.py agents/tests/test_db_isolation.py
git commit -m "feat(agents): add JWT-scoped supabase client with RLS isolation tests"
```

---

### Task 4: Transactions data access

**Files:**
- Create: `agents/src/agent_service/db/transactions.py`
- Create: `agents/tests/test_db_transactions.py`

**Interfaces:**
- Consumes: `Client` from Task 3, models from Task 2.
- Produces:
  - `list_transactions(client, *, start_date=None, end_date=None, category=None, type=None, limit=50) -> list[dict]`
  - `get_transaction(client, transaction_id: str) -> dict` (raises `NotFound`)
  - `insert_transaction(client, values: dict) -> dict`
  - `update_transaction(client, transaction_id: str, changes: dict) -> dict` (raises `NotFound`)

Note: no `delete_transaction`. The capability does not exist in this service by design.

- [ ] **Step 1: Write the failing test**

Create `agents/tests/test_db_transactions.py`:

```python
import pytest

from agent_service.db import transactions as tx
from agent_service.db.errors import NotFound


@pytest.fixture
def sample(client_a):
    row = tx.insert_transaction(client_a, {
        "amount": 42.5, "type": "expense", "category": "Food",
        "date": "2026-03-15", "description": "db-test-sample",
        "recurring_interval": "none",
    })
    yield row
    client_a.table("transactions").delete().eq("id", row["id"]).execute()


def test_insert_returns_the_created_row(sample):
    assert sample["id"]
    assert sample["amount"] == 42.5
    assert sample["category"] == "Food"


def test_insert_does_not_require_user_id(sample):
    # The DB default fills user_id from the JWT. If this ever fails, the schema
    # default changed and RLS assumptions need rechecking.
    assert sample["user_id"]


def test_get_returns_the_row(client_a, sample):
    assert tx.get_transaction(client_a, sample["id"])["id"] == sample["id"]


def test_get_raises_not_found_for_unknown_id(client_a):
    with pytest.raises(NotFound):
        tx.get_transaction(client_a, "00000000-0000-0000-0000-000000000000")


def test_list_filters_by_date_range(client_a, sample):
    inside = tx.list_transactions(client_a, start_date="2026-03-01", end_date="2026-03-31")
    assert sample["id"] in [r["id"] for r in inside]

    outside = tx.list_transactions(client_a, start_date="2026-04-01", end_date="2026-04-30")
    assert sample["id"] not in [r["id"] for r in outside]


def test_list_filters_by_category_and_type(client_a, sample):
    hit = tx.list_transactions(client_a, category="Food", type="expense")
    assert sample["id"] in [r["id"] for r in hit]

    miss = tx.list_transactions(client_a, category="Transport")
    assert sample["id"] not in [r["id"] for r in miss]


def test_list_respects_limit(client_a, sample):
    assert len(tx.list_transactions(client_a, limit=1)) <= 1


def test_update_changes_only_supplied_fields(client_a, sample):
    updated = tx.update_transaction(client_a, sample["id"], {"amount": 99.0})
    assert updated["amount"] == 99.0
    assert updated["category"] == "Food"  # untouched


def test_update_raises_not_found_for_unknown_id(client_a):
    with pytest.raises(NotFound):
        tx.update_transaction(
            client_a, "00000000-0000-0000-0000-000000000000", {"amount": 1.0}
        )
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `uv run pytest tests/test_db_transactions.py -v`
Expected: FAIL — `ImportError: cannot import name 'transactions'`

- [ ] **Step 3: Write the implementation**

Create `agents/src/agent_service/db/transactions.py`:

```python
"""Transaction queries. Plain functions: arguments in, rows out.

This module knows nothing about LLMs or HTTP. `user_id` is never passed or
filtered here — the JWT on the client scopes every query, and RLS enforces it.

There is deliberately no delete function. Deletes are proposed by the agent and
executed by the frontend after the user confirms.
"""

from typing import Optional

from supabase import Client

from agent_service.db.errors import NotFound

TABLE = "transactions"


def list_transactions(
    client: Client,
    *,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category: Optional[str] = None,
    type: Optional[str] = None,
    limit: int = 50,
) -> list[dict]:
    query = client.table(TABLE).select("*")

    if start_date:
        query = query.gte("date", start_date)
    if end_date:
        query = query.lte("date", end_date)
    if category:
        query = query.eq("category", category)
    if type:
        query = query.eq("type", type)

    return query.order("date", desc=True).limit(limit).execute().data


def get_transaction(client: Client, transaction_id: str) -> dict:
    rows = client.table(TABLE).select("*").eq("id", transaction_id).execute().data
    if not rows:
        # Could be a bad id, or RLS hiding someone else's row. We cannot tell
        # them apart, and we should not try — leaking the difference would
        # confirm the row exists.
        raise NotFound(f"No transaction with id {transaction_id}")
    return rows[0]


def insert_transaction(client: Client, values: dict) -> dict:
    # user_id is omitted on purpose: the column defaults to auth.uid().
    return client.table(TABLE).insert(values).execute().data[0]


def update_transaction(client: Client, transaction_id: str, changes: dict) -> dict:
    rows = client.table(TABLE).update(changes).eq("id", transaction_id).execute().data
    if not rows:
        raise NotFound(f"No transaction with id {transaction_id}")
    return rows[0]
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `uv run pytest tests/test_db_transactions.py -v`
Expected: PASS (9 tests)

If `test_insert_does_not_require_user_id` fails with a not-null violation, the `user_id` column has no `auth.uid()` default. Add the default in Supabase rather than passing `user_id` from Python — a client-supplied `user_id` is exactly the thing RLS is protecting you from.

- [ ] **Step 5: Commit**

```bash
git add agents/src/agent_service/db/transactions.py agents/tests/test_db_transactions.py
git commit -m "feat(agents): add transactions data access"
```

---

### Task 5: Budgets and profiles data access

**Files:**
- Create: `agents/src/agent_service/db/budgets.py`
- Create: `agents/src/agent_service/db/profiles.py`
- Create: `agents/tests/test_db_budgets_profiles.py`

**Interfaces:**
- Consumes: `Client` from Task 3.
- Produces:
  - `budgets.list_budgets(client, *, month_year=None) -> list[dict]`
  - `budgets.upsert_budget(client, *, category: str, month_year: str, limit_amount: float) -> dict`
  - `profiles.get_profile(client) -> dict` (raises `NotFound`)

- [ ] **Step 1: Write the failing test**

Create `agents/tests/test_db_budgets_profiles.py`:

```python
import pytest

from agent_service.db import budgets, profiles


@pytest.fixture
def sample_budget(client_a):
    row = budgets.upsert_budget(
        client_a, category="Entertainment", month_year="2026-03", limit_amount=100.0
    )
    yield row
    client_a.table("budgets").delete().eq("id", row["id"]).execute()


def test_upsert_creates_a_budget(sample_budget):
    assert sample_budget["category"] == "Entertainment"
    assert sample_budget["limit_amount"] == 100.0


def test_upsert_updates_an_existing_budget_instead_of_duplicating(client_a, sample_budget):
    again = budgets.upsert_budget(
        client_a, category="Entertainment", month_year="2026-03", limit_amount=250.0
    )
    assert again["limit_amount"] == 250.0

    rows = budgets.list_budgets(client_a, month_year="2026-03")
    matching = [r for r in rows if r["category"] == "Entertainment"]
    assert len(matching) == 1, "upsert duplicated instead of updating"


def test_list_filters_by_month(client_a, sample_budget):
    assert sample_budget["id"] in [r["id"] for r in budgets.list_budgets(client_a, month_year="2026-03")]
    assert sample_budget["id"] not in [r["id"] for r in budgets.list_budgets(client_a, month_year="2026-04")]


def test_get_profile_returns_the_current_user(client_a):
    profile = profiles.get_profile(client_a)
    assert "id" in profile
    assert "currency" in profile
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `uv run pytest tests/test_db_budgets_profiles.py -v`
Expected: FAIL — `ImportError: cannot import name 'budgets'`

- [ ] **Step 3: Write the implementation**

Create `agents/src/agent_service/db/budgets.py`:

```python
"""Budget queries. Plain functions: arguments in, rows out."""

from typing import Optional

from supabase import Client

TABLE = "budgets"


def list_budgets(client: Client, *, month_year: Optional[str] = None) -> list[dict]:
    query = client.table(TABLE).select("*")
    if month_year:
        query = query.eq("month_year", month_year)
    return query.order("category").execute().data


def upsert_budget(
    client: Client, *, category: str, month_year: str, limit_amount: float
) -> dict:
    """Set a category's limit for a month, replacing any existing limit.

    Read-then-write rather than a true upsert: a Postgres ON CONFLICT needs a
    unique constraint on (user_id, category, month_year), which this schema does
    not have. The race window is a user contradicting themselves in two
    simultaneous chats — not a real risk here. Revisit if a constraint is added.
    """
    existing = (
        client.table(TABLE).select("id")
        .eq("category", category).eq("month_year", month_year)
        .execute().data
    )

    if existing:
        return (
            client.table(TABLE)
            .update({"limit_amount": limit_amount})
            .eq("id", existing[0]["id"])
            .execute().data[0]
        )

    return (
        client.table(TABLE)
        .insert({
            "category": category,
            "month_year": month_year,
            "limit_amount": limit_amount,
        })
        .execute().data[0]
    )
```

Create `agents/src/agent_service/db/profiles.py`:

```python
"""Profile queries. Plain functions: arguments in, rows out."""

from supabase import Client

from agent_service.db.errors import NotFound

TABLE = "profiles"


def get_profile(client: Client) -> dict:
    """The current user's profile.

    No id argument: RLS narrows this table to exactly one row — the caller's.
    """
    rows = client.table(TABLE).select("*").limit(1).execute().data
    if not rows:
        raise NotFound("No profile row for the current user")
    return rows[0]
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `uv run pytest tests/test_db_budgets_profiles.py -v`
Expected: PASS (4 tests)

If `test_get_profile_returns_the_current_user` raises `NotFound`, your test user has no `profiles` row. Insert one via the Supabase dashboard.

- [ ] **Step 5: Commit**

```bash
git add agents/src/agent_service/db/budgets.py agents/src/agent_service/db/profiles.py agents/tests/test_db_budgets_profiles.py
git commit -m "feat(agents): add budgets and profiles data access"
```

---

### Task 6: The tool layer

**Files:**
- Create: `agents/src/agent_service/tools/__init__.py`
- Create: `agents/src/agent_service/tools/handlers.py`
- Create: `agents/src/agent_service/tools/registry.py`
- Create: `agents/tests/test_tools.py`

**Interfaces:**
- Consumes: models from Task 2, db modules from Tasks 4–5.
- Produces:
  - `registry.TOOLS: dict[str, Tool]` where `Tool` is a dataclass with `name: str`, `description: str`, `args_model: type[BaseModel]`, `handler: Callable[[Client, BaseModel], dict]`.
  - `registry.openai_tool_schemas() -> list[dict]` — the array passed to the Groq API.
  - `registry.run_tool(client, name: str, raw_args: str | dict) -> dict` — validates, dispatches, and converts every failure into `{"error": ...}`.

**Key idea:** `run_tool` never raises. A failed tool call is data for the LLM.

- [ ] **Step 1: Write the failing test**

Create `agents/tests/test_tools.py`:

```python
"""Unit tests with a fake db layer. No network."""

import json
from unittest.mock import patch

import pytest

from agent_service.tools import registry

FAKE_ROW = {
    "id": "abc-123", "amount": 40.0, "type": "expense", "category": "Food",
    "date": "2026-07-14", "description": "groceries",
    "recurring_interval": "none", "user_id": "user-a",
}


def test_every_tool_has_a_schema_and_a_handler():
    assert len(registry.TOOLS) == 8
    for name, tool in registry.TOOLS.items():
        assert tool.name == name
        assert tool.description.strip()
        assert tool.args_model is not None
        assert callable(tool.handler)


def test_openai_schemas_have_the_shape_the_api_expects():
    schemas = registry.openai_tool_schemas()
    assert len(schemas) == 8
    for schema in schemas:
        assert schema["type"] == "function"
        fn = schema["function"]
        assert fn["name"] in registry.TOOLS
        assert fn["description"].strip()
        assert fn["parameters"]["type"] == "object"


def test_schemas_expose_the_category_enum_to_the_model():
    schemas = {s["function"]["name"]: s for s in registry.openai_tool_schemas()}
    dumped = json.dumps(schemas["add_transaction"])
    # The model must see the exact vocabulary, or it will invent categories.
    assert "Food" in dumped
    assert "Salary" in dumped


def test_run_tool_dispatches_and_returns_data():
    with patch("agent_service.tools.handlers.tx.insert_transaction", return_value=FAKE_ROW):
        result = registry.run_tool(
            None, "add_transaction",
            {"amount": 40, "type": "expense", "category": "Food"},
        )
    assert result["transaction"]["id"] == "abc-123"
    assert "error" not in result


def test_run_tool_accepts_a_json_string():
    with patch("agent_service.tools.handlers.tx.insert_transaction", return_value=FAKE_ROW):
        result = registry.run_tool(
            None, "add_transaction",
            json.dumps({"amount": 40, "type": "expense", "category": "Food"}),
        )
    assert result["transaction"]["id"] == "abc-123"


def test_run_tool_returns_error_for_unknown_tool():
    result = registry.run_tool(None, "drop_database", {})
    assert "error" in result
    assert "unknown tool" in result["error"].lower()


def test_run_tool_returns_validation_errors_to_the_model():
    result = registry.run_tool(
        None, "add_transaction", {"amount": -5, "type": "expense", "category": "Food"}
    )
    assert "error" in result
    assert "amount" in result["error"]


def test_run_tool_returns_bad_category_pairing_as_an_error():
    result = registry.run_tool(
        None, "add_transaction", {"amount": 5, "type": "expense", "category": "Salary"}
    )
    assert "error" in result
    assert "not valid for type" in result["error"]


def test_run_tool_returns_malformed_json_as_an_error():
    result = registry.run_tool(None, "add_transaction", "{not json")
    assert "error" in result


def test_run_tool_converts_db_exceptions_into_errors():
    from agent_service.db.errors import NotFound

    with patch(
        "agent_service.tools.handlers.tx.get_transaction",
        side_effect=NotFound("No transaction with id xyz"),
    ):
        result = registry.run_tool(None, "propose_delete_transaction", {"id": "xyz"})
    assert "error" in result
    assert "xyz" in result["error"]


def test_propose_delete_returns_a_proposal_and_never_deletes():
    with patch("agent_service.tools.handlers.tx.get_transaction", return_value=FAKE_ROW) as get:
        result = registry.run_tool(None, "propose_delete_transaction", {"id": "abc-123"})

    get.assert_called_once()
    assert result["requires_confirmation"] is True
    assert result["transaction"]["id"] == "abc-123"
    # There is no delete function in the db layer at all.
    from agent_service.db import transactions
    assert not hasattr(transactions, "delete_transaction")


def test_summarize_groups_by_category():
    rows = [
        {**FAKE_ROW, "category": "Food", "amount": 10.0, "type": "expense"},
        {**FAKE_ROW, "category": "Food", "amount": 15.0, "type": "expense"},
        {**FAKE_ROW, "category": "Transport", "amount": 7.0, "type": "expense"},
    ]
    with patch("agent_service.tools.handlers.tx.list_transactions", return_value=rows):
        result = registry.run_tool(None, "summarize_spending", {
            "start_date": "2026-07-01", "end_date": "2026-07-31", "group_by": "category",
        })

    assert result["totals"] == {"Food": 25.0, "Transport": 7.0}
    assert result["transaction_count"] == 3


def test_summarize_groups_by_month():
    rows = [
        {**FAKE_ROW, "date": "2026-07-14", "amount": 10.0},
        {**FAKE_ROW, "date": "2026-07-20", "amount": 5.0},
        {**FAKE_ROW, "date": "2026-08-01", "amount": 3.0},
    ]
    with patch("agent_service.tools.handlers.tx.list_transactions", return_value=rows):
        result = registry.run_tool(None, "summarize_spending", {
            "start_date": "2026-07-01", "end_date": "2026-08-31", "group_by": "month",
        })

    assert result["totals"] == {"2026-07": 15.0, "2026-08": 3.0}
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `uv run pytest tests/test_tools.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'agent_service.tools'`

- [ ] **Step 3: Write the handlers**

Create `agents/src/agent_service/tools/__init__.py` (empty file).

Create `agents/src/agent_service/tools/handlers.py`:

```python
"""Tool handlers: validated args in, plain dicts out.

Each handler takes a Supabase client and a validated pydantic model, calls the
db layer, and returns a JSON-serializable dict that goes back to the model as a
tool result. Handlers do not catch exceptions — `registry.run_tool` does that in
one place.

This module knows nothing about HTTP or the OpenAI API.
"""

from collections import defaultdict

from supabase import Client

from agent_service.db import budgets as bg
from agent_service.db import profiles as pf
from agent_service.db import transactions as tx
from agent_service.models import (
    AddTransactionArgs,
    GetProfileArgs,
    ListBudgetsArgs,
    ListTransactionsArgs,
    ProposeDeleteTransactionArgs,
    SetBudgetArgs,
    SummarizeSpendingArgs,
    UpdateTransactionArgs,
)


def list_transactions(client: Client, args: ListTransactionsArgs) -> dict:
    rows = tx.list_transactions(
        client,
        start_date=args.start_date,
        end_date=args.end_date,
        category=args.category.value if args.category else None,
        type=args.type.value if args.type else None,
        limit=args.limit,
    )
    return {"transactions": rows, "count": len(rows)}


def summarize_spending(client: Client, args: SummarizeSpendingArgs) -> dict:
    """Aggregate in Python rather than Postgres.

    One user's transactions is a trivial volume. A Postgres RPC would be faster
    but adds a migration and hides the logic. Revisit if it measurably slows.
    """
    rows = tx.list_transactions(
        client, start_date=args.start_date, end_date=args.end_date, limit=200
    )

    totals: dict[str, float] = defaultdict(float)
    for row in rows:
        if args.group_by == "category":
            key = row["category"]
        elif args.group_by == "type":
            key = row["type"]
        else:  # "month"
            key = row["date"][:7]  # YYYY-MM-DD -> YYYY-MM
        totals[key] += float(row["amount"])

    return {
        "totals": {k: round(v, 2) for k, v in totals.items()},
        "group_by": args.group_by,
        "transaction_count": len(rows),
        "start_date": args.start_date,
        "end_date": args.end_date,
    }


def list_budgets(client: Client, args: ListBudgetsArgs) -> dict:
    rows = bg.list_budgets(client, month_year=args.month_year)
    return {"budgets": rows, "count": len(rows)}


def get_profile(client: Client, args: GetProfileArgs) -> dict:
    return {"profile": pf.get_profile(client)}


def add_transaction(client: Client, args: AddTransactionArgs) -> dict:
    values = args.model_dump(exclude_none=True, mode="json")
    return {"transaction": tx.insert_transaction(client, values)}


def update_transaction(client: Client, args: UpdateTransactionArgs) -> dict:
    changes = args.changes()
    if not changes:
        return {"error": "No fields to update were supplied."}
    return {"transaction": tx.update_transaction(client, args.id, changes)}


def set_budget(client: Client, args: SetBudgetArgs) -> dict:
    row = bg.upsert_budget(
        client,
        category=args.category.value,
        month_year=args.month_year,
        limit_amount=args.limit_amount,
    )
    return {"budget": row}


def propose_delete_transaction(
    client: Client, args: ProposeDeleteTransactionArgs
) -> dict:
    """Read the row and hand it back as a proposal. Never deletes.

    The frontend renders a confirmation card and performs the delete itself. The
    destructive capability does not exist in this process.
    """
    row = tx.get_transaction(client, args.id)
    return {
        "requires_confirmation": True,
        "action": "delete_transaction",
        "transaction": row,
        "note": (
            "Not deleted. Tell the user you need their confirmation, and "
            "summarize the transaction above so they can verify it."
        ),
    }
```

- [ ] **Step 4: Write the registry**

Create `agents/src/agent_service/tools/registry.py`:

```python
"""The LLM-facing tool contract.

Schemas are generated from the pydantic models in models.py, so what the model
sees and what we validate can never drift apart.

`run_tool` is the single place that catches exceptions. It never raises: a
failed tool call is data the model can read and recover from, not a crash.
"""

import json
from dataclasses import dataclass
from typing import Callable, Union

from pydantic import BaseModel, ValidationError
from supabase import Client

from agent_service.db.errors import DbError
from agent_service.models import (
    AddTransactionArgs,
    GetProfileArgs,
    ListBudgetsArgs,
    ListTransactionsArgs,
    ProposeDeleteTransactionArgs,
    SetBudgetArgs,
    SummarizeSpendingArgs,
    UpdateTransactionArgs,
)
from agent_service.tools import handlers


@dataclass(frozen=True)
class Tool:
    name: str
    description: str
    args_model: type[BaseModel]
    handler: Callable[[Client, BaseModel], dict]


_TOOL_LIST = [
    Tool(
        name="list_transactions",
        description=(
            "List the user's transactions, newest first. Filter by date range, "
            "category, or type. Use this when the user asks what they spent on "
            "something, or to find a specific transaction before updating it."
        ),
        args_model=ListTransactionsArgs,
        handler=handlers.list_transactions,
    ),
    Tool(
        name="summarize_spending",
        description=(
            "Total the user's transactions over a date range, grouped by "
            "category, type, or month. Prefer this over list_transactions when "
            "the user asks 'how much' rather than 'which'."
        ),
        args_model=SummarizeSpendingArgs,
        handler=handlers.summarize_spending,
    ),
    Tool(
        name="list_budgets",
        description="List the user's category budget limits, optionally for one month.",
        args_model=ListBudgetsArgs,
        handler=handlers.list_budgets,
    ),
    Tool(
        name="get_profile",
        description=(
            "Get the user's profile: their currency, username, and overall "
            "monthly budget. Call this when you need to know their currency."
        ),
        args_model=GetProfileArgs,
        handler=handlers.get_profile,
    ),
    Tool(
        name="add_transaction",
        description=(
            "Record a new income or expense. `amount` is always a positive "
            "number; `type` carries the sign. If the user does not give a date, "
            "omit it and today's date is used."
        ),
        args_model=AddTransactionArgs,
        handler=handlers.add_transaction,
    ),
    Tool(
        name="update_transaction",
        description=(
            "Change fields on an existing transaction. Supply only the fields "
            "that change. Find the id with list_transactions first."
        ),
        args_model=UpdateTransactionArgs,
        handler=handlers.update_transaction,
    ),
    Tool(
        name="set_budget",
        description=(
            "Set or replace the spending limit for one expense category in one "
            "month. Budgets apply to expense categories only."
        ),
        args_model=SetBudgetArgs,
        handler=handlers.set_budget,
    ),
    Tool(
        name="propose_delete_transaction",
        description=(
            "Propose deleting a transaction. This does NOT delete it — it "
            "returns the transaction so the user can confirm. Deleting always "
            "requires the user's explicit confirmation."
        ),
        args_model=ProposeDeleteTransactionArgs,
        handler=handlers.propose_delete_transaction,
    ),
]

TOOLS: dict[str, Tool] = {tool.name: tool for tool in _TOOL_LIST}


def openai_tool_schemas() -> list[dict]:
    """The `tools` array for the chat completions API."""
    return [
        {
            "type": "function",
            "function": {
                "name": tool.name,
                "description": tool.description,
                "parameters": tool.args_model.model_json_schema(),
            },
        }
        for tool in _TOOL_LIST
    ]


def _format_validation_error(exc: ValidationError) -> str:
    parts = []
    for err in exc.errors():
        field = ".".join(str(p) for p in err["loc"]) or "arguments"
        parts.append(f"{field}: {err['msg']}")
    return "Invalid arguments. " + "; ".join(parts)


def run_tool(client: Client, name: str, raw_args: Union[str, dict]) -> dict:
    """Validate, dispatch, and never raise.

    Every failure becomes {"error": "..."} so the model can read it and correct
    itself rather than the request 500ing.
    """
    tool = TOOLS.get(name)
    if tool is None:
        return {"error": f"Unknown tool '{name}'. Available: {sorted(TOOLS)}"}

    if isinstance(raw_args, str):
        try:
            raw_args = json.loads(raw_args or "{}")
        except json.JSONDecodeError as exc:
            return {"error": f"Arguments were not valid JSON: {exc}"}

    try:
        args = tool.args_model.model_validate(raw_args)
    except ValidationError as exc:
        return {"error": _format_validation_error(exc)}

    try:
        return tool.handler(client, args)
    except DbError as exc:
        return {"error": str(exc)}
    except Exception as exc:  # noqa: BLE001 - the model gets to see it, not a 500
        return {"error": f"{type(exc).__name__}: {exc}"}
```

- [ ] **Step 5: Run the tests and make sure they pass**

Run: `uv run pytest tests/test_tools.py -v`
Expected: PASS (13 tests). No network is used.

- [ ] **Step 6: Commit**

```bash
git add agents/src/agent_service/tools agents/tests/test_tools.py
git commit -m "feat(agents): add tool layer with generated schemas"
```

---

### Task 7: LLM client and system prompt

**Files:**
- Create: `agents/src/agent_service/llm/__init__.py`
- Create: `agents/src/agent_service/llm/client.py`
- Create: `agents/src/agent_service/llm/prompts.py`
- Create: `agents/tests/test_llm_client.py`

**Interfaces:**
- Consumes: `Settings` from Task 1, `Category` enums from Task 2.
- Produces: `create_llm_client(settings) -> OpenAI`; `system_prompt(today: str) -> str`.

- [ ] **Step 1: Write the failing test**

Create `agents/tests/test_llm_client.py`:

```python
from agent_service.config import Settings
from agent_service.llm.client import GROQ_BASE_URL, create_llm_client
from agent_service.llm.prompts import system_prompt

FAKE = Settings(
    groq_api_key="gsk_test",
    groq_model="some-model",
    supabase_url="https://example.supabase.co",
    supabase_anon_key="anon",
)


def test_client_points_at_groq_not_openai():
    client = create_llm_client(FAKE)
    assert str(client.base_url).rstrip("/") == GROQ_BASE_URL.rstrip("/")
    assert "groq.com" in str(client.base_url)


def test_system_prompt_pins_today_so_relative_dates_resolve():
    prompt = system_prompt(today="2026-07-15")
    assert "2026-07-15" in prompt


def test_system_prompt_lists_the_exact_category_vocabulary():
    prompt = system_prompt(today="2026-07-15")
    for word in ["Food", "Transport", "Salary", "Freelance", "Others"]:
        assert word in prompt


def test_system_prompt_states_the_delete_rule():
    prompt = system_prompt(today="2026-07-15").lower()
    assert "confirm" in prompt
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `uv run pytest tests/test_llm_client.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'agent_service.llm'`

- [ ] **Step 3: Write the implementation**

Create `agents/src/agent_service/llm/__init__.py` (empty file).

Create `agents/src/agent_service/llm/client.py`:

```python
"""The Groq connection.

Groq speaks the OpenAI wire protocol, so we use the OpenAI SDK with a different
base_url. No Groq-specific SDK is needed.

The model id is never hardcoded — Groq's catalog changes often. It comes from
GROQ_MODEL. List live options with:
    curl -s https://api.groq.com/openai/v1/models \\
      -H "Authorization: Bearer $GROQ_API_KEY" | jq -r '.data[].id'
"""

from openai import OpenAI

from agent_service.config import Settings

GROQ_BASE_URL = "https://api.groq.com/openai/v1"


def create_llm_client(settings: Settings) -> OpenAI:
    return OpenAI(api_key=settings.groq_api_key, base_url=GROQ_BASE_URL)
```

Create `agents/src/agent_service/llm/prompts.py`:

```python
"""The system prompt.

Two things here are load-bearing rather than decorative:

1. `today` is injected. The model has no clock, so without it "last month"
   silently resolves against its training cutoff.
2. The category vocabulary is listed explicitly. The DB columns are plain
   `string`, so an invented category would be accepted by Postgres and then
   never match the budgets page. Pydantic rejects bad categories, but telling
   the model up front avoids a wasted round-trip.
"""

from agent_service.models import EXPENSE_CATEGORIES, INCOME_CATEGORIES


def system_prompt(today: str) -> str:
    expense = ", ".join(sorted(c.value for c in EXPENSE_CATEGORIES))
    income = ", ".join(sorted(c.value for c in INCOME_CATEGORIES))

    return f"""You are the assistant inside a personal finance app. You help one \
user understand and manage their own income, expenses, and budgets.

Today's date is {today}. Resolve all relative dates ("yesterday", "last month") \
against it.

You can only ever see and change the data of the user you are talking to. This is \
enforced by the database, not by you.

## Categories

Use these exact strings, including capitalization. Do not invent categories.

- Expense: {expense}
- Income: {income}

If nothing fits, use "Others". If the user's wording is ambiguous ("bills" could \
be Utilities or Housing), ask rather than guess.

## Amounts

`amount` is always a positive number. `type` ("expense" or "income") carries the \
sign. Never send a negative amount.

## Deleting

You cannot delete anything. `propose_delete_transaction` only fetches the \
transaction so the user can confirm. When you call it, show the user what would be \
deleted and ask them to confirm. The app handles the deletion once they agree.

## Style

Be brief and concrete. Report real numbers from tool results — never estimate or \
invent a figure. If a tool returns an error, tell the user plainly what went wrong.

Before changing anything, make sure you have understood which record the user \
means. Use list_transactions to find its id rather than guessing.
"""
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `uv run pytest tests/test_llm_client.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add agents/src/agent_service/llm agents/tests/test_llm_client.py
git commit -m "feat(agents): add groq client and system prompt"
```

---

### Task 8: The tool-calling loop

**Files:**
- Create: `agents/src/agent_service/llm/loop.py`
- Create: `agents/tests/test_llm_loop.py`

**Interfaces:**
- Consumes: `registry` from Task 6, `system_prompt` from Task 7.
- Produces: `run_agent(llm, model, db_client, messages, today, max_iterations=8) -> Iterator[Event]`, where `Event` is a dict with a `type` key of `text`, `tool_call`, `confirm_required`, `done`, or `error`.

**This is the file worth understanding.** It is the whole agent. Everything else is plumbing around it. It is also the only file that would be rewritten if you ever move to LangGraph.

- [ ] **Step 1: Write the failing test**

Create `agents/tests/test_llm_loop.py`:

```python
"""Loop tests with a scripted fake LLM. No network, no flake."""

import json
from types import SimpleNamespace
from unittest.mock import patch

from agent_service.llm.loop import MAX_ITERATIONS, run_agent


def _tool_call(call_id, name, args):
    return SimpleNamespace(
        id=call_id,
        type="function",
        function=SimpleNamespace(name=name, arguments=json.dumps(args)),
    )


def _response(content=None, tool_calls=None):
    message = SimpleNamespace(
        role="assistant", content=content, tool_calls=tool_calls
    )
    return SimpleNamespace(choices=[SimpleNamespace(message=message)])


class FakeLLM:
    """Returns queued responses in order and records what it was sent."""

    def __init__(self, responses):
        self._responses = list(responses)
        self.calls = []
        self.chat = SimpleNamespace(
            completions=SimpleNamespace(create=self._create)
        )

    def _create(self, **kwargs):
        self.calls.append(kwargs)
        if not self._responses:
            return _response(content="fallback")
        return self._responses.pop(0)


def _run(llm, **kwargs):
    return list(run_agent(
        llm=llm, model="fake-model", db_client=None,
        messages=[{"role": "user", "content": "hi"}],
        today="2026-07-15", **kwargs,
    ))


def test_plain_answer_streams_text_then_done():
    events = _run(FakeLLM([_response(content="You spent $25.")]))
    assert [e["type"] for e in events] == ["text", "done"]
    assert events[0]["content"] == "You spent $25."


def test_system_prompt_and_tools_are_sent_on_the_first_call():
    llm = FakeLLM([_response(content="hi")])
    _run(llm)

    sent = llm.calls[0]
    assert sent["messages"][0]["role"] == "system"
    assert "2026-07-15" in sent["messages"][0]["content"]
    assert len(sent["tools"]) == 8


def test_single_tool_call_then_answer():
    llm = FakeLLM([
        _response(tool_calls=[_tool_call("c1", "summarize_spending", {
            "start_date": "2026-06-01", "end_date": "2026-06-30",
            "group_by": "category",
        })]),
        _response(content="You spent $25 on Food."),
    ])

    with patch("agent_service.tools.registry.run_tool", return_value={"totals": {"Food": 25.0}}):
        events = _run(llm)

    assert [e["type"] for e in events] == ["tool_call", "text", "done"]
    assert events[0]["name"] == "summarize_spending"

    # The tool result must be fed back as a `tool` message tied to the call id.
    second_call_messages = llm.calls[1]["messages"]
    tool_messages = [m for m in second_call_messages if m["role"] == "tool"]
    assert len(tool_messages) == 1
    assert tool_messages[0]["tool_call_id"] == "c1"
    assert "Food" in tool_messages[0]["content"]


def test_parallel_tool_calls_all_execute():
    llm = FakeLLM([
        _response(tool_calls=[
            _tool_call("c1", "get_profile", {}),
            _tool_call("c2", "list_budgets", {}),
        ]),
        _response(content="done"),
    ])

    with patch("agent_service.tools.registry.run_tool", return_value={"ok": True}) as run:
        events = _run(llm)

    assert run.call_count == 2
    assert [e["type"] for e in events] == ["tool_call", "tool_call", "text", "done"]
    assert len([m for m in llm.calls[1]["messages"] if m["role"] == "tool"]) == 2


def test_multi_round_tool_calls():
    llm = FakeLLM([
        _response(tool_calls=[_tool_call("c1", "list_transactions", {})]),
        _response(tool_calls=[_tool_call("c2", "get_profile", {})]),
        _response(content="finished"),
    ])

    with patch("agent_service.tools.registry.run_tool", return_value={"ok": True}):
        events = _run(llm)

    assert [e["type"] for e in events] == ["tool_call", "tool_call", "text", "done"]


def test_propose_delete_emits_confirm_required():
    proposal = {
        "requires_confirmation": True,
        "action": "delete_transaction",
        "transaction": {"id": "abc-123", "amount": 40.0},
    }
    llm = FakeLLM([
        _response(tool_calls=[_tool_call("c1", "propose_delete_transaction", {"id": "abc-123"})]),
        _response(content="Confirm?"),
    ])

    with patch("agent_service.tools.registry.run_tool", return_value=proposal):
        events = _run(llm)

    kinds = [e["type"] for e in events]
    assert "confirm_required" in kinds
    confirm = next(e for e in events if e["type"] == "confirm_required")
    assert confirm["transaction"]["id"] == "abc-123"


def test_tool_errors_go_back_to_the_model_not_the_user():
    llm = FakeLLM([
        _response(tool_calls=[_tool_call("c1", "get_profile", {})]),
        _response(content="Sorry, I could not find your profile."),
    ])

    with patch("agent_service.tools.registry.run_tool", return_value={"error": "No profile row"}):
        events = _run(llm)

    # No error event: the model handled it and answered.
    assert [e["type"] for e in events] == ["tool_call", "text", "done"]
    assert "No profile row" in llm.calls[1]["messages"][-1]["content"]


def test_iteration_cap_stops_an_infinite_tool_loop():
    forever = [
        _response(tool_calls=[_tool_call(f"c{i}", "get_profile", {})])
        for i in range(MAX_ITERATIONS + 5)
    ]
    llm = FakeLLM(forever)

    with patch("agent_service.tools.registry.run_tool", return_value={"ok": True}):
        events = _run(llm)

    assert events[-1]["type"] == "error"
    assert "too many steps" in events[-1]["message"].lower()
    assert len(llm.calls) <= MAX_ITERATIONS


def test_llm_failure_becomes_an_error_event_not_a_crash():
    class Broken:
        def __init__(self):
            self.chat = SimpleNamespace(
                completions=SimpleNamespace(create=self._boom)
            )

        def _boom(self, **kwargs):
            raise RuntimeError("groq is down")

    events = _run(Broken())
    assert events[-1]["type"] == "error"
    assert "groq is down" in events[-1]["message"]
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `uv run pytest tests/test_llm_loop.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'agent_service.llm.loop'`

- [ ] **Step 3: Write the implementation**

Create `agents/src/agent_service/llm/loop.py`:

```python
"""The agent loop.

The whole agent is this file:

    1. Send the conversation plus the tool schemas to the model.
    2. If it asked for tools, run them and append the results as `tool` messages.
    3. Go back to 1.
    4. If it answered in plain text instead, we are done.

It yields events rather than returning a value, so the API layer can stream
progress to the user while the loop is still running. It never raises: every
failure becomes an `error` event.
"""

import json
from typing import Any, Iterator, Optional

from agent_service.llm.prompts import system_prompt
from agent_service.tools import registry

MAX_ITERATIONS = 8

Event = dict[str, Any]


def _serialize_tool_calls(tool_calls) -> list[dict]:
    """The assistant's tool_calls, as plain dicts to send back in `messages`."""
    return [
        {
            "id": call.id,
            "type": "function",
            "function": {
                "name": call.function.name,
                "arguments": call.function.arguments,
            },
        }
        for call in tool_calls
    ]


def run_agent(
    *,
    llm,
    model: str,
    db_client,
    messages: list[dict],
    today: str,
    max_iterations: int = MAX_ITERATIONS,
) -> Iterator[Event]:
    conversation: list[dict] = [
        {"role": "system", "content": system_prompt(today=today)},
        *messages,
    ]
    tools = registry.openai_tool_schemas()

    for _ in range(max_iterations):
        try:
            response = llm.chat.completions.create(
                model=model, messages=conversation, tools=tools
            )
        except Exception as exc:  # noqa: BLE001 - surfaced as an event, not a 500
            yield {"type": "error", "message": f"The model call failed: {exc}"}
            return

        message = response.choices[0].message
        tool_calls = getattr(message, "tool_calls", None)

        if not tool_calls:
            yield {"type": "text", "content": message.content or ""}
            yield {"type": "done"}
            return

        conversation.append({
            "role": "assistant",
            "content": message.content,
            "tool_calls": _serialize_tool_calls(tool_calls),
        })

        for call in tool_calls:
            name = call.function.name
            yield {"type": "tool_call", "name": name, "id": call.id}

            result = registry.run_tool(db_client, name, call.function.arguments)

            # A delete proposal is the one result the UI must act on itself.
            if result.get("requires_confirmation"):
                yield {
                    "type": "confirm_required",
                    "action": result.get("action"),
                    "transaction": result.get("transaction"),
                }

            conversation.append({
                "role": "tool",
                "tool_call_id": call.id,
                "content": json.dumps(result, default=str),
            })

    yield {
        "type": "error",
        "message": (
            "I took too many steps without reaching an answer. "
            "Try asking something more specific."
        ),
    }
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `uv run pytest tests/test_llm_loop.py -v`
Expected: PASS (9 tests). No network is used.

- [ ] **Step 5: Commit**

```bash
git add agents/src/agent_service/llm/loop.py agents/tests/test_llm_loop.py
git commit -m "feat(agents): add tool-calling loop"
```

---

### Task 9: The API layer

**Files:**
- Create: `agents/src/agent_service/api/__init__.py`
- Create: `agents/src/agent_service/api/deps.py`
- Create: `agents/src/agent_service/api/chat.py`
- Create: `agents/src/agent_service/main.py`
- Create: `agents/tests/test_api.py`

**Interfaces:**
- Consumes: everything above.
- Produces: `main.app` (FastAPI); `GET /health`; `POST /chat` returning `text/event-stream`.

- [ ] **Step 1: Write the failing test**

Create `agents/tests/test_api.py`:

```python
"""API tests with a faked loop. No network, no LLM."""

import json
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from agent_service.main import app


@pytest.fixture
def client():
    return TestClient(app)


def _sse_events(body: str) -> list[dict]:
    return [
        json.loads(line[len("data: "):])
        for line in body.splitlines()
        if line.startswith("data: ")
    ]


def test_health_needs_no_auth(client):
    assert client.get("/health").status_code == 200


def test_chat_rejects_a_request_with_no_token(client):
    response = client.post("/chat", json={"messages": [{"role": "user", "content": "hi"}]})
    assert response.status_code == 401


def test_chat_rejects_a_malformed_authorization_header(client):
    response = client.post(
        "/chat",
        json={"messages": [{"role": "user", "content": "hi"}]},
        headers={"Authorization": "Basic abc"},
    )
    assert response.status_code == 401


def test_chat_rejects_an_empty_message_list(client):
    with patch("agent_service.api.chat.create_user_client"):
        response = client.post(
            "/chat", json={"messages": []},
            headers={"Authorization": "Bearer fake.jwt.token"},
        )
    assert response.status_code == 422


def test_chat_streams_loop_events_as_sse(client):
    fake_events = [
        {"type": "tool_call", "name": "summarize_spending", "id": "c1"},
        {"type": "text", "content": "You spent $25."},
        {"type": "done"},
    ]

    with patch("agent_service.api.chat.create_user_client"), \
         patch("agent_service.api.chat.create_llm_client"), \
         patch("agent_service.api.chat.run_agent", return_value=iter(fake_events)):
        response = client.post(
            "/chat",
            json={"messages": [{"role": "user", "content": "how much on food?"}]},
            headers={"Authorization": "Bearer fake.jwt.token"},
        )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert _sse_events(response.text) == fake_events


def test_chat_forwards_the_caller_jwt_to_the_db_client(client):
    with patch("agent_service.api.chat.create_user_client") as make_db, \
         patch("agent_service.api.chat.create_llm_client"), \
         patch("agent_service.api.chat.run_agent", return_value=iter([{"type": "done"}])):
        client.post(
            "/chat",
            json={"messages": [{"role": "user", "content": "hi"}]},
            headers={"Authorization": "Bearer the.users.jwt"},
        )

    # The user's own token must reach the db client, or RLS scopes nothing.
    assert make_db.call_args.args[1] == "the.users.jwt"


def test_a_crash_mid_stream_becomes_an_error_event(client):
    def explode(**kwargs):
        yield {"type": "text", "content": "starting"}
        raise RuntimeError("unexpected boom")

    with patch("agent_service.api.chat.create_user_client"), \
         patch("agent_service.api.chat.create_llm_client"), \
         patch("agent_service.api.chat.run_agent", side_effect=explode):
        response = client.post(
            "/chat",
            json={"messages": [{"role": "user", "content": "hi"}]},
            headers={"Authorization": "Bearer fake.jwt.token"},
        )

    events = _sse_events(response.text)
    assert events[-1]["type"] == "error"
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `uv run pytest tests/test_api.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'agent_service.main'`

- [ ] **Step 3: Write the auth dependency**

Create `agents/src/agent_service/api/__init__.py` (empty file).

Create `agents/src/agent_service/api/deps.py`:

```python
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
            status_code=401, detail="Expected an 'Authorization: Bearer <jwt>' header"
        )
    return token.strip()
```

- [ ] **Step 4: Write the chat route**

Create `agents/src/agent_service/api/chat.py`:

```python
"""POST /chat — the only real endpoint.

Sync on purpose. The generator below is a plain sync generator; FastAPI runs it
in a threadpool. See the plan's Global Constraints for why.
"""

import json
from datetime import date
from typing import Iterator, Literal

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from agent_service.api.deps import get_jwt
from agent_service.config import load_settings
from agent_service.db.client import create_user_client
from agent_service.llm.client import create_llm_client
from agent_service.llm.loop import run_agent

router = APIRouter()


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    # Conversation state lives in the frontend; it is resent every turn.
    messages: list[Message] = Field(min_length=1)


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event, default=str)}\n\n"


@router.post("/chat")
def chat(request: ChatRequest, jwt: str = Depends(get_jwt)) -> StreamingResponse:
    settings = load_settings()
    db_client = create_user_client(settings, jwt)
    llm = create_llm_client(settings)

    def stream() -> Iterator[str]:
        try:
            for event in run_agent(
                llm=llm,
                model=settings.groq_model,
                db_client=db_client,
                messages=[m.model_dump() for m in request.messages],
                today=date.today().isoformat(),
            ):
                yield _sse(event)
        except Exception as exc:  # noqa: BLE001
            # The response has already started, so we cannot send a 500 status.
            # The client learns about failures through the event stream.
            yield _sse({"type": "error", "message": f"{type(exc).__name__}: {exc}"})

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

- [ ] **Step 5: Write the app assembly**

Create `agents/src/agent_service/main.py`:

```python
"""App assembly. Wiring only — no logic lives here."""

from fastapi import FastAPI

from agent_service.api.chat import router as chat_router

app = FastAPI(title="Agent Service", version="0.1.0")
app.include_router(chat_router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
```

- [ ] **Step 6: Run the tests and make sure they pass**

Run: `uv run pytest tests/test_api.py -v`
Expected: PASS (7 tests)

- [ ] **Step 7: Run the whole suite**

Run: `uv run pytest -v`
Expected: PASS. Every test, including the isolation tests from Task 3.

- [ ] **Step 8: Commit**

```bash
git add agents/src/agent_service/api agents/src/agent_service/main.py agents/tests/test_api.py
git commit -m "feat(agents): add chat endpoint with SSE streaming"
```

---

### Task 10: End-to-end verification against real Groq and real Supabase

Every test so far faked either the LLM or nothing at all. This task proves the real thing works. No new code — if something breaks here, fix it and add a test that would have caught it.

**Files:**
- Create: `agents/README.md` (currently empty)

- [ ] **Step 1: Start the service**

```bash
cd agents && uv run fastapi dev src/agent_service/main.py
```
Expected: server on http://127.0.0.1:8000. In another terminal: `curl -s localhost:8000/health` → `{"status":"ok"}`

- [ ] **Step 2: Get a real user JWT**

```bash
cd agents && uv run python -c "
from supabase import create_client, ClientOptions
from agent_service.config import load_settings
import os
s = load_settings()
c = create_client(s.supabase_url, s.supabase_anon_key,
                  options=ClientOptions(persist_session=False, auto_refresh_token=False))
r = c.auth.sign_in_with_password({
    'email': os.environ['TEST_USER_A_EMAIL'],
    'password': os.environ['TEST_USER_A_PASSWORD'],
})
print(r.session.access_token)
"
```
Save the output as `$JWT`.

- [ ] **Step 3: A read question**

```bash
curl -N -X POST localhost:8000/chat \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"How much did I spend on food last month?"}]}'
```
Expected: a `tool_call` event naming `summarize_spending` or `list_transactions`, then `text`, then `done`. The number in the text must match the data — verify it in the dashboard.

- [ ] **Step 4: A write**

```bash
curl -N -X POST localhost:8000/chat \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Add a $40 groceries expense for yesterday"}]}'
```
Expected: a `tool_call` for `add_transaction`, then `done`. Confirm in the dashboard that the row exists, that `category` is exactly `"Food"`, and that the date is genuinely yesterday — that last check is what proves the injected `today` works.

- [ ] **Step 5: A delete proposal**

```bash
curl -N -X POST localhost:8000/chat \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Delete that groceries transaction"}]}'
```
Expected: a `confirm_required` event carrying the transaction. **The row must still exist in the dashboard afterward.** If it is gone, stop — a delete path exists somewhere it should not.

- [ ] **Step 6: An expired-token check**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:8000/chat \
  -H "Authorization: Bearer not.a.real.jwt" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hi"}]}'
```
Expected: the request is refused. The service must never serve data for an unverifiable token.

- [ ] **Step 7: Write the README**

Write `agents/README.md` covering: what the service is, the four-layer architecture, the `.env` vars, how to run it, how to run tests, and the two rules that matter most — no service-role key, and no delete capability. Keep it short; `agents/memory.md` holds the detail.

- [ ] **Step 8: Update the trackers**

Tick off the completed phases in `agents/progress.md` and add a dated entry to its "Log of Completed Steps". Record anything surprising in `agents/memory.md` under Gotchas.

- [ ] **Step 9: Commit**

```bash
git add agents/README.md agents/progress.md agents/memory.md
git commit -m "docs(agents): add README and update trackers after e2e verification"
```

---

## What this plan does not cover

Deliberately deferred. Each needs its own plan.

1. **Frontend integration** — the Next.js `/api/chat` route, the chat panel, the delete confirmation card and its server action. This is the immediate next plan. Note for it: read the relevant guide under `node_modules/next/dist/docs/` first — this Next.js version has breaking changes from common knowledge (see `AGENTS.md`).
2. **Agent memory** — short-term, long-term, semantic. The phase after the copilot works. Reevaluate LangGraph there.
3. **Background workers** — needs the service-role key and a separate auth path.
4. **Deployment** — Railway or Fly, plus `AGENT_SERVICE_URL` in the Next.js env.
5. **Token streaming** — the loop currently yields a whole `text` event per model reply rather than per-token deltas. Add `stream=True` handling if the latency feels bad in the UI.
