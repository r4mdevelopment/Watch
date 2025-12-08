import os
import importlib
import pytest


def test_tmdb_api_key_missing(monkeypatch):
    # Удаляем TMDB_API_KEY для теста
    monkeypatch.delenv("TMDB_API_KEY", raising=False)

    # Удаляем модуль, чтобы при повторном импорте сработала проверка
    if "main" in importlib.sys.modules:
        del importlib.sys.modules["main"]

    # Теперь при импорте main.py должен быть ValueError
    with pytest.raises(ValueError) as exc:
        import main

    assert "TMDB_API_KEY not found" in str(exc.value)
