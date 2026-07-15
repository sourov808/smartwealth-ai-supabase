"""Shared vocabulary.

These enums are the contract with the frontend. The database columns are plain
`string` with no CHECK constraints, so Postgres will happily store an invented
category like "Groceries" — and the budgets page, which matches by string
equality, will then silently never match it. These enums are the only guard.

Source of truth: components/dashboard/transaction-modal.tsx
"""

from enum import StrEnum


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
