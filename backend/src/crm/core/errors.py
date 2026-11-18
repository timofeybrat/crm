class DomainError(Exception):
    """Expected business failure; safe to return the message to a client."""


class NotFound(DomainError):
    pass


class Conflict(DomainError):
    pass


class InvalidOperation(DomainError):
    pass
