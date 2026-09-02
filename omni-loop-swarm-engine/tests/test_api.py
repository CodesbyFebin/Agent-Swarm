"""Tests for the Flask app routes."""
from __future__ import annotations

import pytest

from backend.app import create_app


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    return app.test_client()


def test_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    body = res.get_json()
    assert body["status"] == "ok"
    assert "version" in body
    assert "max_remediation_loops" in body


def test_demo_route(client):
    res = client.post("/api/demo", json={"task": "implement a function to sort a list"})
    assert res.status_code == 200
    body = res.get_json()
    assert body["builder"]["evidence"]
    assert body["master_reviewer"]["approval"] == "GRANTED"
    # Topic should be reflected in the output
    assert "sort" in body["final_output"].lower()


def test_demo_route_with_loop(client):
    res = client.post("/api/demo", json={"task": "build a snake game", "loop_count": 1})
    assert res.status_code == 200
    body = res.get_json()
    assert body["loop_count"] == 1
    assert body["remediation"]["active"] is True


def test_demo_route_requires_task(client):
    res = client.post("/api/demo", json={})
    assert res.status_code == 400
    assert "task" in res.get_json()["error"]


def test_execute_route_requires_task(client):
    res = client.post("/api/execute", json={})
    assert res.status_code == 400
    assert "task" in res.get_json()["error"]


def test_execute_route_falls_back_to_free_tier_when_credentials_omitted(client, monkeypatch):
    """Omitting api_key/model/base_url no longer 400s -- it resolves to the
    Kilo free-tier defaults (anonymous, no key sent) instead of hard-failing."""
    from backend import pipeline

    captured = {}

    def fake_call(*, api_key, model, base_url, system, user, temperature, max_tokens,
                   require_api_key=True, json_schema_hint=None):
        captured["api_key"] = api_key
        captured["model"] = model
        captured["base_url"] = base_url
        captured["require_api_key"] = require_api_key
        from backend.llm import LLMResult
        if "decision" in system.lower() or "PASS" in system:
            parsed = {"decision": "PASS", "evidence": "looks fine"}
        elif "approval" in system.lower() or "MASTER" in system:
            parsed = {"approval": "GRANTED", "evidence": "ship it"}
        else:
            parsed = {"solution": "done", "evidence": "did it"}
        return LLMResult(parsed=parsed, raw=str(parsed), usage={}, elapsed_seconds=0.001)

    monkeypatch.setattr(pipeline, "call_llm", fake_call)

    res = client.post("/api/execute", json={"task": "x"})
    assert res.status_code == 200
    assert captured["api_key"] == ""
    assert captured["require_api_key"] is False
    assert captured["base_url"]  # defaulted to settings.kilo_base_url
    assert captured["model"]  # defaulted to a free-tier model

    body = res.get_json()
    assert body["final_output"] == "done"


def test_execute_route_uses_supplied_credentials_when_given(client, monkeypatch):
    from backend import pipeline

    captured = {}

    def fake_call(*, api_key, model, base_url, system, user, temperature, max_tokens,
                   require_api_key=True, json_schema_hint=None):
        captured["api_key"] = api_key
        captured["model"] = model
        captured["base_url"] = base_url
        captured["require_api_key"] = require_api_key
        from backend.llm import LLMResult
        if "decision" in system.lower() or "PASS" in system:
            parsed = {"decision": "PASS", "evidence": "looks fine"}
        elif "approval" in system.lower() or "MASTER" in system:
            parsed = {"approval": "GRANTED", "evidence": "ship it"}
        else:
            parsed = {"solution": "done", "evidence": "did it"}
        return LLMResult(parsed=parsed, raw=str(parsed), usage={}, elapsed_seconds=0.001)

    monkeypatch.setattr(pipeline, "call_llm", fake_call)

    res = client.post(
        "/api/execute",
        json={"task": "x", "api_key": "k", "model": "m", "base_url": "http://x"},
    )
    assert res.status_code == 200
    assert captured["api_key"] == "k"
    assert captured["model"] == "m"
    assert captured["base_url"] == "http://x"
    assert captured["require_api_key"] is True


def test_options_preflight(client):
    res = client.options("/api/execute")
    # Flask's test client collapses 204-with-empty-body into 200; accept either
    # but verify the headers we actually care about.
    assert res.status_code in (200, 204)
    assert "Access-Control-Allow-Origin" in res.headers
    assert "POST" in res.headers.get("Access-Control-Allow-Methods", "")


def test_cors_header_on_health(client):
    res = client.get("/api/health")
    assert res.headers.get("Access-Control-Allow-Origin") == "*"
    assert res.headers.get("X-Pipeline-Version")
