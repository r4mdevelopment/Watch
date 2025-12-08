import pytest
from unittest.mock import MagicMock, patch
import sys


def test_get_db_finally_closes_connection():
    if "main" in sys.modules:
        del sys.modules["main"]

    fake_session = MagicMock()

    with patch("main.SessionLocal", return_value=fake_session):
        import main

        generator = main.get_db()

        db = next(generator)
        assert db is fake_session

        with pytest.raises(StopIteration):
            next(generator)

    fake_session.close.assert_called_once()
