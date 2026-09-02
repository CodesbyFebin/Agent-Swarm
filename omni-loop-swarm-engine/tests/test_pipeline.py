"""Tests for the live pipeline using a fake LLM endpoint."""
from __future__ import annotations

import json
from typing import Any

import pytest

from backend.llm import AgentError
from backend.pipeline import run_pipeline, to_wire


class FakeEndpoint:
    """Replays a scripted sequence of LLM responses."""

    def __init__(self, scripts: list[dict]):
        self.scripts = list(scripts)
        self.calls: list[dict] = []

    def __call__(self, *, api_key, model, base_url, system, user,
                 temperature, max_tokens, json_schema_hint=None, require_api_key=True):
        from backend.llm import LLMResult
        if not self.scripts:
            raise AssertionError("FakeEndpoint ran out of scripted responses")
        script = self.scripts.pop(0)
        self.calls.append({
            "model": model,
            "system": system,
            "user": user,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "require_api_key": require_api_key,
        })
        if script.get("raise"):
            raise AgentError(script["raise"])
        return LLMResult(
            parsed=script["parsed"],
            raw=json.dumps(script["parsed"]),
            usage=script.get("usage", {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2}),
            elapsed_seconds=0.001,
        )


@pytest.fixture(autouse=True)
def patch_call_llm(monkeypatch):
    """Replace the call_llm used by pipeline.py with a scriptable fake."""
    from backend import pipeline
    from backend import llm

    # Capture the fakes for the test to set up.
    state = {"fake": None}

    def fake_caller(**kwargs):
        assert state["fake"] is not None, "no fake endpoint configured for this test"
        return state["fake"](**kwargs)

    monkeypatch.setattr(pipeline, "call_llm", fake_caller)
    monkeypatch.setattr(llm, "call_llm", fake_caller)

    def configure(scripts):
        state["fake"] = FakeEndpoint(scripts)
        return state["fake"]

    return configure


def test_pass_first_try(patch_call_llm):
    patch_call_llm([
        {"parsed": {"solution": "v1", "evidence": "built v1"}},
        {"parsed": {"decision": "PASS", "evidence": "all good"}},
        {"parsed": {"approval": "GRANTED", "evidence": "ship it"}},
    ])
    result = run_pipeline(
        task="t", constraints="", api_key="k", model="m", base_url="http://x"
    )
    assert result.approval == "GRANTED"
    assert result.loop_count == 0
    assert result.final_output == "v1"


def test_one_remediation_loop(patch_call_llm):
    patch_call_llm([
        {"parsed": {"solution": "v1", "evidence": "first try"}},
        {"parsed": {"decision": "FAIL", "evidence": "missing edge case"}},
        # Remediation
        {"parsed": {"solution": "v2 with edge case", "evidence": "added guard"}},
        # Re-review
        {"parsed": {"decision": "PASS", "evidence": "now good"}},
        # Master
        {"parsed": {"approval": "GRANTED", "evidence": "ship"}},
    ])
    result = run_pipeline(
        task="t", constraints="c", api_key="k", model="m", base_url="http://x"
    )
    assert result.loop_count == 1
    assert result.final_output == "v2 with edge case"
    wire = to_wire(result)
    assert wire["remediation"]["active"] is True
    assert wire["remediation"]["loop_count"] == 1


def test_max_loop_cap(patch_call_llm):
    """Reviewer keeps failing forever — pipeline must stop at MAX_REMEDIATION_LOOPS."""
    from backend.config import settings
    cap = settings.max_remediation_loops

    scripts: list[dict] = [
        {"parsed": {"solution": "v1", "evidence": "first"}},
        {"parsed": {"decision": "FAIL", "evidence": "still bad"}},
    ]
    # Each loop: remediation + re-review (both FAIL)
    for _ in range(cap):
        scripts.append({"parsed": {"solution": "vN", "evidence": "tried again"}})
        scripts.append({"parsed": {"decision": "FAIL", "evidence": "still bad"}})
    # Master still runs
    scripts.append({"parsed": {"approval": "DENIED", "evidence": "give up"}})

    patch_call_llm(scripts)
    result = run_pipeline(
        task="t", constraints="", api_key="k", model="m", base_url="http://x"
    )
    assert result.loop_count == cap
    assert result.approval == "DENIED"
    assert "NOT APPROVED" in result.final_output


def test_missing_required_field_raises(patch_call_llm):
    from backend.llm import AgentError
    patch_call_llm([
        {"parsed": {"solution": "v1"}},  # missing evidence
    ])
    with pytest.raises(AgentError):
        run_pipeline(
            task="t", constraints="", api_key="k", model="m", base_url="http://x"
        )


def test_invalid_decision_treated_as_fail(patch_call_llm):
    patch_call_llm([
        {"parsed": {"solution": "v1", "evidence": "first"}},
        {"parsed": {"decision": "MAYBE", "evidence": "unsure"}},
        # If treated as FAIL, remediation runs:
        {"parsed": {"solution": "v2", "evidence": "fixed"}},
        {"parsed": {"decision": "PASS", "evidence": "ok"}},
        {"parsed": {"approval": "GRANTED", "evidence": "go"}},
    ])
    result = run_pipeline(
        task="t", constraints="", api_key="k", model="m", base_url="http://x"
    )
    assert result.loop_count == 1


# --------------------------------------------------------------------------- #
# Model fallback (free-tier pool hardening)
# --------------------------------------------------------------------------- #

def test_no_pool_raises_immediately_on_failure(patch_call_llm):
    """Without model_pool, a failure has nothing to fall back to."""
    patch_call_llm([{"raise": "m1 unavailable"}])
    with pytest.raises(AgentError, match="m1 unavailable"):
        run_pipeline(task="t", constraints="", api_key="", model="m1", base_url="http://x")


def test_builder_falls_back_to_next_pool_model(patch_call_llm):
    fake = patch_call_llm([
        {"raise": "m1 unavailable"},               # BUILDER attempt 1 (m1) fails
        {"parsed": {"solution": "v1", "evidence": "e"}},  # BUILDER attempt 2 (m2) succeeds
        {"parsed": {"decision": "PASS", "evidence": "ok"}},  # REVIEWER
        {"parsed": {"approval": "GRANTED", "evidence": "go"}},  # MASTER
    ])
    result = run_pipeline(
        task="t", constraints="", api_key="", model="m1", base_url="http://x",
        require_api_key=False, model_pool=("m1", "m2", "m3"),
    )
    assert result.approval == "GRANTED"
    assert result.model == "m2"  # the model that actually answered


def test_fallback_model_is_sticky_for_later_steps(patch_call_llm):
    """Once a fallback model succeeds, later steps prefer it first --
    they don't keep retrying the original model that already failed."""
    fake = patch_call_llm([
        {"raise": "m1 unavailable"},                      # BUILDER: m1 fails
        {"parsed": {"solution": "v1", "evidence": "e"}},  # BUILDER: m2 succeeds
        {"parsed": {"decision": "PASS", "evidence": "ok"}},  # REVIEWER: should try m2 first
        {"parsed": {"approval": "GRANTED", "evidence": "go"}},  # MASTER: should try m2 first
    ])
    run_pipeline(
        task="t", constraints="", api_key="", model="m1", base_url="http://x",
        require_api_key=False, model_pool=("m1", "m2", "m3"),
    )
    used_models = [c["model"] for c in fake.calls]
    assert used_models == ["m1", "m2", "m2", "m2"]


def test_pool_exhausted_raises_last_error(patch_call_llm):
    patch_call_llm([
        {"raise": "m1 down"},
        {"raise": "m2 down"},
        {"raise": "m3 down"},
    ])
    with pytest.raises(AgentError, match="m3 down"):
        run_pipeline(
            task="t", constraints="", api_key="", model="m1", base_url="http://x",
            require_api_key=False, model_pool=("m1", "m2", "m3"),
        )
