
from backend import models, main, database

from datetime import datetime, timedelta


def _register_and_get_token(client, username="favuser", email="fav@example.com"):
    payload = {
        "username": username,
        "email": email,
        "password": "FavPass123!",
        "confirm_password": "FavPass123!",
    }
    r = client.post("/api/auth/register", json=payload)
    assert r.status_code == 200
    return r.json()["access_token"]


def test_add_and_get_and_delete_favorites(client, db_session):
    token = _register_and_get_token(client)

    # Изначально избранное пустое
    r_empty = client.get("/api/favorites", headers={"Authorization": f"Bearer {token}"})
    assert r_empty.status_code == 200
    assert r_empty.json() == []

    # Добавляем фильм в избранное
    movie_id = 12345
    r_add = client.post(
        "/api/favorites",
        json={"movie_id": movie_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r_add.status_code == 200
    assert r_add.json()["message"] == "Added to favorites"

    # Повторное добавление должно привести к 400
    r_add2 = client.post(
        "/api/favorites",
        json={"movie_id": movie_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r_add2.status_code == 400
    assert r_add2.json()["detail"] == "Movie already in favorites"

    # Проверяем, что в GET /api/favorites вернулся наш фильм
    r_list = client.get("/api/favorites", headers={"Authorization": f"Bearer {token}"})
    assert r_list.status_code == 200
    favorites = r_list.json()
    assert len(favorites) == 1
    assert favorites[0]["movie_id"] == movie_id

    # Удаляем избранное
    r_del = client.delete(
        f"/api/favorites/{movie_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r_del.status_code == 200
    assert "Removed from favorites" in r_del.json()["message"]

    # Удаление несуществующего фаворита
    r_del2 = client.delete(
        f"/api/favorites/{movie_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r_del2.status_code == 404
    assert r_del2.json()["detail"] == "Favorite not found"


def test_watch_history_add_update_and_limit(client, db_session):
    token = _register_and_get_token(client, username="historyuser", email="history@example.com")

    # Изначально пусто
    r_empty = client.get("/api/history", headers={"Authorization": f"Bearer {token}"})
    assert r_empty.status_code == 200
    assert r_empty.json() == []

    # Добавляем 5 разных фильмов
    for i in range(1, 6):
        r_add = client.post(
            "/api/history",
            json={"movie_id": i},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r_add.status_code == 200

    r_list = client.get("/api/history", headers={"Authorization": f"Bearer {token}"})
    assert r_list.status_code == 200
    history = r_list.json()
    assert len(history) == 5
    # Последний добавленный (movie_id=5) должен быть первым в истории
    assert history[0]["movie_id"] == 5

    # Добавляем уже существующий фильм (например, movie_id=3) -> должен обновиться watched_at
    r_update = client.post(
        "/api/history",
        json={"movie_id": 3},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r_update.status_code == 200
    assert r_update.json()["message"] in ("Updated watch history", "Updated watch history")

    r_list2 = client.get("/api/history", headers={"Authorization": f"Bearer {token}"})
    history2 = r_list2.json()
    # movie_id=3 должен стать первым
    assert history2[0]["movie_id"] == 3

    # Добавляем ещё один новый фильм movie_id=999 -> всего по логике должно остаться только 5 записей
    r_new = client.post(
        "/api/history",
        json={"movie_id": 999},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r_new.status_code == 200

    r_list3 = client.get("/api/history", headers={"Authorization": f"Bearer {token}"})
    history3 = r_list3.json()
    assert len(history3) == 5
    # Убеждаемся, что нет самого старого фильма (movie_id=1)
    movie_ids = [item["movie_id"] for item in history3]
    assert 1 not in movie_ids
