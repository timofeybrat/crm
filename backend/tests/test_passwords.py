import pytest

from crm.modules.auth.passwords import hash_password, verify_password


def test_argon2_hash_is_salted_and_verifiable():
    password = "public-test-password-only"
    first, second = hash_password(password), hash_password(password)
    assert first.startswith("$argon2id$") and first != second
    assert password not in first
    assert verify_password(password, first)[0]
    assert not verify_password("wrong", first)[0]
    assert not verify_password(password, "malformed")[0]


@pytest.mark.parametrize("password", ["short", "x" * 129])
def test_password_length_is_bounded(password):
    with pytest.raises(ValueError):
        hash_password(password)
