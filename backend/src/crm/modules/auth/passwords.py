from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError

password_hasher = PasswordHash.recommended()
# Equalize the expensive password check for unknown users. This is not an account.
DUMMY_HASH = password_hasher.hash("not-an-account-password")


def hash_password(password: str) -> str:
    if not 12 <= len(password) <= 128:
        raise ValueError("Password must contain 12 to 128 characters")
    return password_hasher.hash(password)


def verify_password(password: str, encoded: str) -> tuple[bool, str | None]:
    try:
        return password_hasher.verify_and_update(password, encoded)
    except (UnknownHashError, ValueError):
        return False, None
