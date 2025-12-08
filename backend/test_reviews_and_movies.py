
import types
import httpx
from backend import models, main, database


def register_user_and_token(client, username="reviewer", email="review@example.com"):
    payload = {
        "username": username,
        "email": email,
        "password": "ReviewPass123!",
        "confirm_password": "ReviewPass123!",
    }
    r = client.post("/api/auth/register", json=payload)
    assert r.status_code == 200
    return r.json()["access_token"]


def test_create_and_get_reviews(client, db_session):
    token = register_user_and_token(client)

    # Создаём отзыв
    movie_id = 777
    review_payload = {
        "movie_id": movie_id,
        "rating": 8,
        "comment": "Очень хороший фильм",
    }
    r_create = client.post(
        "/api/reviews",
        json=review_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r_create.status_code == 200
    data = r_create.json()
    assert data["rating"] == 8
    assert data["comment"] == "Очень хороший фильм"
    assert data["user"]["username"] == "reviewer"

    # Повторный отзыв на тот же фильм от того же пользователя -> ожидаем 400
    r_dup = client.post(
        "/api/reviews",
        json=review_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r_dup.status_code == 400
    assert "already reviewed" in r_dup.json()["detail"].lower()

    # Получаем список отзывов для фильма
    r_list = client.get(f"/api/reviews/{movie_id}")
    assert r_list.status_code == 200
    reviews = r_list.json()
    assert len(reviews) == 1
    assert reviews[0]["rating"] == 8
    assert reviews[0]["comment"] == "Очень хороший фильм"

    # Получаем отзывы пользователя
    # сначала узнаём user_id
    user = db_session.query(models.User).filter(models.User.username == "reviewer").first()
    assert user is not None

    r_user_reviews = client.get(f"/api/users/{user.id}/reviews")
    assert r_user_reviews.status_code == 200
    user_reviews = r_user_reviews.json()
    assert len(user_reviews) == 1
    assert user_reviews[0]["movie_id"] == movie_id


# --------------------- TMDB endpoints (мок httpx.AsyncClient) ---------------------


class DummyResponse:
    def __init__(self, data, status_code: int = 200):
        self._data = data
        self.status_code = status_code

    def json(self):
        return self._data

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPError(f"HTTP error {self.status_code}")


class DummyAsyncClient:
    def __init__(self, *args, **kwargs):
        self.last_requests = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        pass

    async def get(self, url, params=None):
        # Сохраним запрос для проверки при необходимости
        self.last_requests.append((url, params))
        # Возвращаем фиксированный JSON
        if "popular" in url:
            return DummyResponse({"results": [{"id": 1, "title": "Popular Movie"}]})
        elif "search" in url:
            return DummyResponse({"results": [{"id": 2, "title": "Search Result"}]})
        elif "videos" in url:
            return DummyResponse({"results": [{"id": "abc", "key": "trailer_key"}]})
        else:  # /movie/{id}
            return DummyResponse({"id": 42, "title": "Some Movie"})


def _patch_httpx_for_main(monkeypatch):
    """
    Подменяем main.httpx на свой namespace с DummyAsyncClient.
    """
    fake_httpx = types.SimpleNamespace(
        AsyncClient=DummyAsyncClient,
        HTTPError=httpx.HTTPError,
    )
    monkeypatch.setattr(main, "httpx", fake_httpx)


def test_root_endpoint(client):
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["message"].lower().startswith("watch")


def test_get_popular_movies_uses_tmdb(monkeypatch, client):
    _patch_httpx_for_main(monkeypatch)

    r = client.get("/api/movies/popular?page=1")
    assert r.status_code == 200
    data = r.json()
    assert "results" in data
    assert data["results"][0]["title"] == "Popular Movie"


def test_search_movies_uses_tmdb(monkeypatch, client):
    _patch_httpx_for_main(monkeypatch)

    r = client.get("/api/movies/search", params={"query": "Test", "page": 1})
    assert r.status_code == 200
    data = r.json()
    assert data["results"][0]["title"] == "Search Result"


def test_get_movie_details_uses_tmdb(monkeypatch, client):
    _patch_httpx_for_main(monkeypatch)

    r = client.get("/api/movies/42")
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == 42
    assert data["title"] == "Some Movie"


def test_get_movie_videos_uses_tmdb(monkeypatch, client):
    _patch_httpx_for_main(monkeypatch)

    r = client.get("/api/movies/42/videos")
    assert r.status_code == 200
    data = r.json()
    assert "results" in data
    assert data["results"][0]["key"] == "trailer_key"
