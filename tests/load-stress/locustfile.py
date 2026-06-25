"""Load / stress test locustfile.

Pillar L19.1 (perf regression suite). Defines Locust user behaviors
for the Phenotype fleet HTTP endpoints.

Usage:
    locust -f tests/load-stress/locustfile.py --host http://localhost:8080
"""
from locust import HttpUser, task, between
import json


class FleetUser(HttpUser):
    wait_time = between(0.5, 3.0)

    def on_start(self):
        """Authenticate before starting tasks."""
        resp = self.client.post("/auth/login", json={"username": "loadtest", "password": "loadtest"})
        if resp.status_code == 200:
            self.token = resp.json().get("token", "")
        else:
            self.token = ""

    @task(3)
    def list_models(self):
        self.client.get("/v1/models", headers=self._headers())

    @task(2)
    def chat_completion(self):
        payload = {"model": "gpt-4o-mini", "messages": [{"role": "user", "content": "Hello"}], "max_tokens": 10}
        self.client.post("/v1/chat/completions", json=payload, headers=self._headers())

    @task(1)
    def health_check(self):
        self.client.get("/health")

    @task(1)
    def list_combos(self):
        self.client.get("/api/combos", headers=self._headers())

    def _headers(self):
        h = {"Content-Type": "application/json"}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        return h
