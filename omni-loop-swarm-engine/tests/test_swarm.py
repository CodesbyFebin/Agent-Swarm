"""Tests for the parallel swarm pipeline + demo + routes."""
from __future__ import annotations

import pytest

from backend.app import create_app
from backend.llm import AgentError
from backend.swarm import _run_swarm, start_swarm_run
from backend.swarm_demo import run_demo_swarm


# --------------------------------------------------------------------------- #
# Demo pipeline (no network, fully deterministic)
# --------------------------------------------------------------------------- #

def test_demo_swarm_default():
    result = run_demo_swarm(task="implement a function to sort a list")
    assert result["mode"] == "swarm"
    assert len(result["candidates"]) == 4
    assert result["arbiter"] is not None
    assert result["arbiter"]["winner"] in {c["id"] for c in result["candidates"]}
    assert 0 <= result["arbiter"]["confidence"] <= 1
    assert result["winner_id"] in {c["id"] for c in result["candidates"]}
    assert result["final_output"]
    assert result["model"] == "demo"


def test_demo_swarm_deterministic():
    a = run_demo_swarm(task="design a SQL schema for a SaaS")
    b = run_demo_swarm(task="design a SQL schema for a SaaS")
    assert a["arbiter"]["winner"] == b["arbiter"]["winner"]
    assert a["candidates"][0]["quality"] == b["candidates"][0]["quality"]


def test_demo_swarm_single_mode():
    result = run_demo_swarm(task="write a one-liner", agent_count=1, mode="single")
    assert len(result["candidates"]) == 1
    assert result["arbiter"]["winner"] == result["candidates"][0]["id"]
    assert result["arbiter"]["confidence"] == 1.0


def test_demo_swarm_arbiter_mode_no_round_robin():
    result = run_demo_swarm(
        task="compare two approaches", agent_count=3, mode="arbiter", round_robin=False
    )
    assert result["round_robin"]["done"] is False
    for c in result["candidates"]:
        assert c["iterations"] == 1


def test_demo_swarm_round_robin_increments_losers():
    result = run_demo_swarm(
        task="implement a function", agent_count=4, mode="swarm", round_robin=True
    )
    assert result["round_robin"]["done"] is True
    winner_id = result["arbiter"]["winner"]
    for c in result["candidates"]:
        if c["id"] == winner_id:
            assert c["iterations"] == 1
        else:
            assert c["iterations"] == 2


def test_demo_swarm_candidate_count_clamped():
    result = run_demo_swarm(task="x", agent_count=99)
    assert len(result["candidates"]) == 6
    result = run_demo_swarm(task="x", agent_count=0)
    assert len(result["candidates"]) == 1


# --------------------------------------------------------------------------- #
# Live pipeline (with a scriptable fake LLM)
# --------------------------------------------------------------------------- #

class FakeEndpoint:
    def __init__(self, scripts):
        self.scripts = list(scripts)
        self.calls = []

    def __call__(self, prompt, *, api_key, model, base_url, temperature, max_tokens,
                 require_api_key=True):
        from backend.llm import LLMResult
        if not self.scripts:
            raise AssertionError("FakeEndpoint ran out of scripts")
        script = self.scripts.pop(0)
        self.calls.append({"system": prompt.system[:60], "model": model, "require_api_key": require_api_key})
        if script.get("raise"):
            raise AgentError(script["raise"])
        return LLMResult(
            parsed=script["parsed"],
            raw=str(script["parsed"]),
            usage={"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30},
            elapsed_seconds=0.001,
        )


def test_swarm_run_single_mode(monkeypatch):
    from backend import swarm

    fake = FakeEndpoint([
        # Only one candidate build is needed
        {"parsed": {"solution": "v1", "evidence": "e1"}},
    ])
    monkeypatch.setattr(swarm, "_do_call", fake)

    run = swarm.SwarmRun(
        id="t1", task="t", constraints="",
        config={"agent_count": 1, "iterations": 1, "mode": "single", "round_robin": False},
        api_key="k", model="m", base_url="http://x",
    )
    final = _run_swarm(run)
    assert len(final["candidates"]) == 1
    assert final["candidates"][0]["solution"] == "v1"
    assert final["arbiter"]["confidence"] == 1.0
    assert final["winner_id"] == "agent-1"
    # No arbiter LLM call in single mode with one candidate
    assert len(fake.calls) == 1


def test_swarm_run_arbiter_picks_winner(monkeypatch):
    from backend import swarm

    fake = FakeEndpoint([
        # 2 candidate builds (parallel)
        {"parsed": {"solution": "v1", "evidence": "e1"}},
        {"parsed": {"solution": "v2", "evidence": "e2"}},
        # Arbiter call
        {"parsed": {"winner": "agent-2", "confidence": 0.9, "reasoning": "better"}},
    ])
    monkeypatch.setattr(swarm, "_do_call", fake)

    run = swarm.SwarmRun(
        id="t2", task="t", constraints="",
        config={"agent_count": 2, "iterations": 1, "mode": "arbiter", "round_robin": False},
        api_key="k", model="m", base_url="http://x",
    )
    final = _run_swarm(run)
    assert final["winner_id"] == "agent-2"
    assert final["final_output"] == "v2"


def test_swarm_run_arbiter_invalid_winner_falls_back(monkeypatch):
    from backend import swarm

    fake = FakeEndpoint([
        {"parsed": {"solution": "v1", "evidence": "e1"}},
        {"parsed": {"solution": "v2", "evidence": "e2"}},
        # Arbiter hallucinates a winner id
        {"parsed": {"winner": "agent-99", "confidence": 0.7, "reasoning": "hmm"}},
    ])
    monkeypatch.setattr(swarm, "_do_call", fake)

    run = swarm.SwarmRun(
        id="t3", task="t", constraints="",
        config={"agent_count": 2, "iterations": 1, "mode": "arbiter", "round_robin": False},
        api_key="k", model="m", base_url="http://x",
    )
    final = _run_swarm(run)
    assert final["winner_id"] in {"agent-1", "agent-2"}


def test_swarm_run_round_robin(monkeypatch):
    from backend import swarm

    fake = FakeEndpoint([
        # 2 candidate builds
        {"parsed": {"solution": "v1", "evidence": "e1"}},
        {"parsed": {"solution": "v2", "evidence": "e2"}},
        # Arbiter picks v2 as winner
        {"parsed": {"winner": "agent-2", "confidence": 0.8, "reasoning": "wins"}},
        # Remediation for the loser (agent-1)
        {"parsed": {"solution": "v1 improved", "evidence": "r1"}},
        # Second arbiter call
        {"parsed": {"winner": "agent-1", "confidence": 0.9, "reasoning": "now wins"}},
    ])
    monkeypatch.setattr(swarm, "_do_call", fake)

    run = swarm.SwarmRun(
        id="t4", task="t", constraints="",
        config={"agent_count": 2, "iterations": 3, "mode": "arbiter", "round_robin": True},
        api_key="k", model="m", base_url="http://x",
    )
    final = _run_swarm(run)
    assert final["round_robin"]["done"] is True
    assert final["winner_id"] == "agent-1"
    assert final["final_output"] == "v1 improved"


# --------------------------------------------------------------------------- #
# Live-streamed arbiter reasoning
# --------------------------------------------------------------------------- #

def _fake_stream_llm(chunks, parsed):
    """Build a fake stream_llm that emits `chunks` via on_delta, then
    returns an LLMResult built from `parsed` (as if extract_json succeeded
    on the concatenated stream)."""
    from backend.llm import LLMResult

    def fake(*, api_key, model, base_url, system, user, temperature, max_tokens,
              require_api_key=True, on_delta=None):
        for c in chunks:
            if on_delta is not None:
                on_delta(c)
        return LLMResult(parsed=parsed, raw="".join(chunks), usage={}, elapsed_seconds=0.001)

    return fake


def test_arbiter_streams_reasoning_live(monkeypatch):
    from backend import swarm

    # Only the 2 candidate builds go through _do_call -- the arbiter call is
    # fully satisfied by the streaming path, so if the fallback path were
    # hit unexpectedly (e.g. streaming silently skipped) this fake would
    # raise "ran out of scripts".
    fake_do_call = FakeEndpoint([
        {"parsed": {"solution": "v1", "evidence": "e1"}},
        {"parsed": {"solution": "v2", "evidence": "e2"}},
    ])
    monkeypatch.setattr(swarm, "_do_call", fake_do_call)
    # Realistic raw stream: the model streams the *whole* JSON envelope, not
    # just the reasoning prose -- the extractor in swarm.py's on_delta is
    # what pulls clean text out of this for the UI.
    monkeypatch.setattr(swarm, "stream_llm", _fake_stream_llm(
        [
            '{"winner": "agent-2", "confidence": 0.85, "reasoning": "Candidate 2 ',
            "is clearly ",
            'the stronger solution."}',
        ],
        {"winner": "agent-2", "confidence": 0.85, "reasoning": "Candidate 2 is clearly the stronger solution."},
    ))

    run = swarm.SwarmRun(
        id="s1", task="t", constraints="",
        config={"agent_count": 2, "iterations": 1, "mode": "arbiter", "round_robin": False},
        api_key="k", model="m", base_url="http://x",
        stream_arbiter=True,
    )
    final = _run_swarm(run)

    assert final["winner_id"] == "agent-2"
    assert final["arbiter"]["reasoning"] == "Candidate 2 is clearly the stronger solution."

    deltas = [s for s in run.steps if s.role == "arbiter_delta"]
    assert [d.evidence for d in deltas] == ["Candidate 2 ", "is clearly ", "the stronger solution."]
    # payload.accumulated grows monotonically and ends at the full text
    assert deltas[-1].payload["accumulated"] == "Candidate 2 is clearly the stronger solution."
    assert deltas[0].payload["accumulated"] == "Candidate 2 "


def test_arbiter_streaming_failure_falls_back_to_non_streaming(monkeypatch):
    from backend import swarm

    fake_do_call = FakeEndpoint([
        {"parsed": {"solution": "v1", "evidence": "e1"}},
        {"parsed": {"solution": "v2", "evidence": "e2"}},
        # Fallback (non-streaming) arbiter call
        {"parsed": {"winner": "agent-1", "confidence": 0.7, "reasoning": "fallback reasoning"}},
    ])
    monkeypatch.setattr(swarm, "_do_call", fake_do_call)

    def failing_stream(*, api_key, model, base_url, system, user, temperature, max_tokens,
                        require_api_key=True, on_delta=None):
        raise AgentError("stream connection reset")

    monkeypatch.setattr(swarm, "stream_llm", failing_stream)

    run = swarm.SwarmRun(
        id="s2", task="t", constraints="",
        config={"agent_count": 2, "iterations": 1, "mode": "arbiter", "round_robin": False},
        api_key="k", model="m", base_url="http://x",
        stream_arbiter=True,
    )
    final = _run_swarm(run)

    assert final["winner_id"] == "agent-1"
    assert final["arbiter"]["reasoning"] == "fallback reasoning"
    # No partial reasoning should have reached the client -- the stream
    # failed before producing any content.
    assert not any(s.role == "arbiter_delta" for s in run.steps)


def test_arbiter_streaming_disabled_by_default(monkeypatch):
    """SwarmRun constructed directly (as tests do) never streams -- avoids
    a real network call sneaking into a unit test. stream_arbiter=True is
    something only start_swarm_run sets, for actual live runs."""
    from backend import swarm

    fake_do_call = FakeEndpoint([
        {"parsed": {"solution": "v1", "evidence": "e1"}},
        {"parsed": {"solution": "v2", "evidence": "e2"}},
        {"parsed": {"winner": "agent-2", "confidence": 0.6, "reasoning": "fine"}},
    ])
    monkeypatch.setattr(swarm, "_do_call", fake_do_call)

    def unexpected_stream(**kwargs):
        raise AssertionError("stream_llm should not be called when stream_arbiter is False")

    monkeypatch.setattr(swarm, "stream_llm", unexpected_stream)

    run = swarm.SwarmRun(
        id="s3", task="t", constraints="",
        config={"agent_count": 2, "iterations": 1, "mode": "arbiter", "round_robin": False},
        api_key="k", model="m", base_url="http://x",
    )
    assert run.stream_arbiter is False
    final = _run_swarm(run)
    assert final["winner_id"] == "agent-2"


def test_start_swarm_run_enables_streaming(monkeypatch):
    from backend import swarm

    monkeypatch.setattr(swarm, "_do_call", FakeEndpoint([
        {"parsed": {"solution": "v", "evidence": "e"}},
    ]))
    monkeypatch.setattr(swarm, "stream_llm", _fake_stream_llm(
        ["ok"], {"winner": "agent-1", "confidence": 1.0, "reasoning": "ok"},
    ))
    run = swarm.start_swarm_run(
        task="t", constraints="", agent_count=1, iterations=1,
        mode="single", round_robin=False,
    )
    assert run.stream_arbiter is True


# --------------------------------------------------------------------------- #
# Routes
# --------------------------------------------------------------------------- #

def test_swarm_demo_route():
    app = create_app()
    c = app.test_client()
    res = c.post("/api/swarm/demo", json={"task": "implement a function", "agent_count": 3})
    assert res.status_code == 200
    body = res.get_json()
    assert len(body["candidates"]) == 3
    assert body["arbiter"] is not None


def test_swarm_demo_route_validates_task():
    app = create_app()
    c = app.test_client()
    res = c.post("/api/swarm/demo", json={})
    assert res.status_code == 400
    assert "task" in res.get_json()["error"]


def test_swarm_route_requires_task():
    app = create_app()
    c = app.test_client()
    res = c.post("/api/swarm", json={})
    assert res.status_code == 400
    assert "task" in res.get_json()["error"]


def test_swarm_route_models_endpoint():
    app = create_app()
    c = app.test_client()
    res = c.get("/api/swarm/models")
    assert res.status_code == 200
    body = res.get_json()
    assert body["anonymous_supported"] is True
    assert len(body["default_models"]) > 0
    assert body["base_url"]


def test_resolve_swarm_credentials_falls_back_to_free_tier_pool_when_omitted():
    from backend import swarm
    from backend.config import settings

    model, base_url, pool = swarm._resolve_swarm_credentials(
        api_key="", model="", base_url="", models=None
    )
    assert base_url == settings.kilo_base_url
    assert len(pool) > 0
    assert pool == tuple(settings.swarm_default_models)[: settings.swarm_max_models]
    assert model == pool[0]


def test_resolve_swarm_credentials_explicit_models_pool():
    from backend import swarm

    model, base_url, pool = swarm._resolve_swarm_credentials(
        api_key="", model="", base_url="", models=["a/1", "b/2", "a/1"]
    )
    # de-duplicated, order preserved
    assert pool == ("a/1", "b/2")
    assert model == "a/1"


def test_resolve_swarm_credentials_single_model_unchanged():
    from backend import swarm

    model, base_url, pool = swarm._resolve_swarm_credentials(
        api_key="k", model="m", base_url="http://x", models=None
    )
    assert model == "m"
    assert base_url == "http://x"
    assert pool == ()  # empty pool => every candidate uses `model`


def test_swarm_free_tier_candidates_use_distinct_models(monkeypatch):
    from backend import swarm

    fake = FakeEndpoint([
        {"parsed": {"solution": "v1", "evidence": "e1"}},
        {"parsed": {"solution": "v2", "evidence": "e2"}},
        {"parsed": {"winner": "agent-1", "confidence": 0.6, "reasoning": "fine"}},
    ])
    monkeypatch.setattr(swarm, "_do_call", fake)

    run = swarm.SwarmRun(
        id="t5", task="t", constraints="",
        config={"agent_count": 2, "iterations": 1, "mode": "swarm", "round_robin": False},
        api_key="", model="pool/first", base_url="http://x",
        models=("pool/first", "pool/second"),
        require_api_key=False,
    )
    swarm._run_swarm(run)

    build_calls = [c for c in fake.calls if c["model"] in {"pool/first", "pool/second"}]
    assert {c["model"] for c in build_calls[:2]} == {"pool/first", "pool/second"}
    assert all(c["require_api_key"] is False for c in fake.calls)


# --------------------------------------------------------------------------- #
# Model fallback (rate-limit / stale-model hardening)
# --------------------------------------------------------------------------- #

def _fake_prompt():
    from backend import prompts
    return prompts.Prompt(system="s", user="u", required_fields=("solution", "evidence"))


def test_fallback_no_pool_does_not_retry_other_models(monkeypatch):
    from backend import swarm

    calls = []

    def fake_do_call(prompt, *, api_key, model, base_url, temperature, max_tokens, require_api_key=True):
        calls.append(model)
        raise AgentError(f"{model} failed")

    monkeypatch.setattr(swarm, "_do_call", fake_do_call)

    with pytest.raises(AgentError, match="only-model failed"):
        swarm._do_call_with_fallback(
            _fake_prompt(), preferred_model="only-model", pool=(),
            api_key="k", base_url="http://x", temperature=0.1, max_tokens=10,
        )
    assert calls == ["only-model"]  # no pool -- nothing else to try


def test_fallback_tries_next_pool_model_on_failure(monkeypatch):
    from backend import swarm
    from backend.llm import LLMResult

    calls = []

    def fake_do_call(prompt, *, api_key, model, base_url, temperature, max_tokens, require_api_key=True):
        calls.append(model)
        if model == "m1":
            raise AgentError("m1 unavailable")
        return LLMResult(parsed={"solution": "ok", "evidence": "e"}, raw="", usage={}, elapsed_seconds=0.001)

    monkeypatch.setattr(swarm, "_do_call", fake_do_call)

    result, used = swarm._do_call_with_fallback(
        _fake_prompt(), preferred_model="m1", pool=("m1", "m2", "m3"),
        api_key="", base_url="http://x", temperature=0.1, max_tokens=10, require_api_key=False,
    )
    assert used == "m2"
    assert result.parsed["solution"] == "ok"
    assert calls == ["m1", "m2"]


def test_fallback_exhausts_pool_and_raises_last_error(monkeypatch):
    from backend import swarm

    def fake_do_call(prompt, *, api_key, model, base_url, temperature, max_tokens, require_api_key=True):
        raise AgentError(f"{model} down")

    monkeypatch.setattr(swarm, "_do_call", fake_do_call)

    with pytest.raises(AgentError, match="m3 down"):
        swarm._do_call_with_fallback(
            _fake_prompt(), preferred_model="m1", pool=("m1", "m2", "m3"),
            api_key="", base_url="http://x", temperature=0.1, max_tokens=10, require_api_key=False,
        )


def test_fallback_respects_max_attempts_cap(monkeypatch):
    from backend import swarm

    calls = []

    def fake_do_call(prompt, *, api_key, model, base_url, temperature, max_tokens, require_api_key=True):
        calls.append(model)
        raise AgentError(f"{model} down")

    monkeypatch.setattr(swarm, "_do_call", fake_do_call)

    with pytest.raises(AgentError):
        swarm._do_call_with_fallback(
            _fake_prompt(), preferred_model="m1", pool=("m1", "m2", "m3", "m4", "m5"),
            api_key="", base_url="http://x", temperature=0.1, max_tokens=10,
            require_api_key=False, max_attempts=2,
        )
    assert calls == ["m1", "m2"]  # capped, never tried m3/m4/m5


def test_swarm_build_falls_back_when_preferred_model_fails(monkeypatch):
    """End-to-end through _run_swarm: candidate 0's preferred model (m1)
    fails, but the run still produces a passing candidate using m2 -- and
    reports m2 as the model that actually answered."""
    from backend import swarm
    from backend.llm import LLMResult

    def fake_do_call(prompt, *, api_key, model, base_url, temperature, max_tokens, require_api_key=True):
        if model == "m1":
            raise AgentError("m1 unavailable")
        return LLMResult(parsed={"solution": f"sol-{model}", "evidence": "e"}, raw="", usage={}, elapsed_seconds=0.001)

    monkeypatch.setattr(swarm, "_do_call", fake_do_call)

    run = swarm.SwarmRun(
        id="fb1", task="t", constraints="",
        config={"agent_count": 1, "iterations": 1, "mode": "single", "round_robin": False},
        api_key="", model="m1", base_url="http://x",
        models=("m1", "m2", "m3"),
        require_api_key=False,
    )
    final = swarm._run_swarm(run)
    assert final["candidates"][0]["model"] == "m2"
    assert final["candidates"][0]["solution"] == "sol-m2"


def test_swarm_route_validates_mode():
    app = create_app()
    c = app.test_client()
    res = c.post("/api/swarm", json={
        "task": "x", "api_key": "k", "model": "m", "base_url": "http://x", "mode": "wat"
    })
    assert res.status_code == 400
    assert "mode" in res.get_json()["error"]


def test_swarm_route_validates_agent_count():
    app = create_app()
    c = app.test_client()
    res = c.post("/api/swarm", json={
        "task": "x", "api_key": "k", "model": "m", "base_url": "http://x", "agent_count": 99
    })
    assert res.status_code == 400
    assert "agent_count" in res.get_json()["error"]


def test_swarm_result_404_for_unknown_id():
    app = create_app()
    c = app.test_client()
    res = c.get("/api/swarm/nope/result")
    assert res.status_code == 404
