import pytest
from unittest.mock import MagicMock, patch
import sys


def test_database_get_db_closes_session():
    if "database" in sys.modules:
        del sys.modules["database"]

    fake_session = MagicMock()

    with patch("database.SessionLocal", return_value=fake_session):
        import database

        generator = database.get_db()

        db = next(generator)
        assert db is fake_session

        with pytest.raises(StopIteration):
            next(generator)

    fake_session.close.assert_called_once()
