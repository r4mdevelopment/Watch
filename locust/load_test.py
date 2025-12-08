from locust import HttpUser, task, between
import random

MOVIE_IDS = [76600, 19995, 572802]

class WatchUser(HttpUser):
    wait_time = between(1, 3)
    token = None

    def on_start(self):
        r = self.client.post("/api/auth/login", json={
            "username": "test",
            "password": "123456"
        })

        if r.status_code == 200:
            self.token = r.json()["access_token"]

    @task(3)
    def popular(self):
        self.client.get("/api/movies/popular?page=1")

    @task(2)
    def movie(self):
        movie_id = random.choice(MOVIE_IDS)
        self.client.get(f"/api/movies/{movie_id}")

    @task(2)
    def search(self):
        self.client.get("/api/movies/search?query=avatar")

    @task(1)
    def reviews(self):
        movie_id = random.choice(MOVIE_IDS)
        self.client.get(f"/api/reviews/{movie_id}")
