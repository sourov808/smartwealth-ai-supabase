"""Database-layer exceptions.

The tools layer converts these into strings the model can read. They must never
reach the HTTP layer as 500s.
"""


class DbError(Exception):
    """Base for anything the database layer raises."""


class NotFound(DbError):
    """The row does not exist, or RLS hid it. Indistinguishable by design."""


class PermissionDenied(DbError):
    """RLS refused the write. A real signal that something is wrong."""
