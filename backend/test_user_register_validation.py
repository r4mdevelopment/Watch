import pytest
from backend.main import UserRegister

def test_username_not_alphanumeric():
    with pytest.raises(ValueError) as exc:
        UserRegister(username="ab$cd", email="test@example.com", password="abcdef")
    assert "alphanumeric" in str(exc.value)


def test_username_too_short():
    with pytest.raises(ValueError) as exc:
        UserRegister(username="ab", email="test@example.com", password="abcdef")
    assert "between 3 and 20" in str(exc.value)


def test_username_too_long():
    with pytest.raises(ValueError) as exc:
        UserRegister(username="a"*25, email="test@example.com", password="abcdef")
    assert "between 3 and 20" in str(exc.value)


def test_short_password():
    with pytest.raises(ValueError) as exc:
        UserRegister(username="abc", email="test@example.com", password="123")
    assert "at least 6" in str(exc.value)
