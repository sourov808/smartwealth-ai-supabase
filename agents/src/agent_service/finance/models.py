"""Shared vocabulary.

These enums are the contract with the frontend. The database columns are plain
`string` with no CHECK constraints, so Postgres will happily store an invented
category like "Groceries" — and the budgets page, which matches by string
equality, will then silently never match it. These enums are the only guard.

Source of truth: components/dashboard/transaction-modal.tsx

Finance-owned. Nothing outside this package uses these.
"""

from enum import StrEnum
from typing import Optional

from pydantic import BaseModel


class TransactionType(StrEnum):
    EXPENSE = "expense"
    INCOME = "income"


class RecurringInterval(StrEnum):
    NONE = "none"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"


class GroupBy(StrEnum):
    CATEGORY = "category"
    TYPE = "type"
    MONTH = "month"


class Category(StrEnum):
    # Expense categories
    FOOD = "Food"
    UTILITIES = "Utilities"
    TRANSPORT = "Transport"
    ENTERTAINMENT = "Entertainment"
    HOUSING = "Housing"
    HEALTH = "Health"
    SHOPPING = "Shopping"
    # Income categories
    SALARY = "Salary"
    FREELANCE = "Freelance"
    INVESTMENT = "Investment"
    GIFT = "Gift"
    # Both
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


# ------------------------------------------------------- what the model sees
#
# Every db query is `select("*")`, so rows arrive with columns the model has no
# use for. These views declare the subset that reaches the prompt, and tool
# results are dumped through them.
#
# The saving is per row and scales with the result set: `user_id` is the same
# value on every row of every query the caller can even see (RLS guarantees it),
# and nobody asks a chat assistant when a row was inserted.
#
# Where a full row is genuinely needed, it travels through RequestContext instead
# of through the prompt — see `pending_delete`, whose confirmation card must show
# the stored row rather than a trimmed copy.


class TransactionView(BaseModel):
    """A transaction as the model sees it. Drops user_id and created_at."""

    id: str
    date: str
    amount: float
    type: str
    category: str
    description: Optional[str] = None
    recurring_interval: Optional[str] = None


class BudgetView(BaseModel):
    """A budget as the model sees it. Drops id, user_id and created_at."""

    category: str
    month_year: str
    limit_amount: float


def transaction_view(row: dict) -> dict:
    return TransactionView(**{k: row.get(k) for k in TransactionView.model_fields}).model_dump(
        exclude_none=True
    )


def budget_view(row: dict) -> dict:
    return BudgetView(**{k: row.get(k) for k in BudgetView.model_fields}).model_dump()


def check_category_matches_type(category: Category, type_: TransactionType) -> None:
    """Raise if a category is nonsense for a type, e.g. an expense on 'Salary'.

    The enums alone cannot express this: both category sets live in one enum, so
    the schema the model sees offers all twelve for either type.
    """
    allowed = EXPENSE_CATEGORIES if type_ is TransactionType.EXPENSE else INCOME_CATEGORIES
    if category not in allowed:
        raise ValueError(
            f"category '{category.value}' is not valid for type '{type_.value}'. "
            f"Valid options: {sorted(c.value for c in allowed)}"
        )
