"""
The pipeline itself. Pure orchestration — no HTTP, no Flask. Easy to test.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Optional

from .config import settings
from .llm import AgentError, LLMResult, call_llm, merge_usage
from . import prompts

log = logging.getLogger("omni-loop")


@dataclass
class AgentStep:
    """One agent's contribution, ready to be returned to the caller or UI."""

    name: str
    role: str  # builder | reviewer | remediation | master_reviewer
    evidence: str
    payload: dict = field(default_factory=dict)
    elapsed_seconds: float = 0.0
    usage: dict = field(default_factory=dict)
    error: Optional[str] = None


@dataclass
class PipelineResult:
    steps: list[AgentStep]
    final_output: str
    approval: str  # GRANTED | DENIED
    loop_count: int
    tokens: dict
    model: str
    total_elapsed_seconds: float


# --------------------------------------------------------------------------- #
# Orchestration
# --------------------------------------------------------------------------- #


def _call(
    *,
    prompt: prompts.Prompt,
    api_key: str,
    model: str,
    base_url: str,
    temperature: float,
    max_tokens: int,
    require_api_key: bool = True,
) -> LLMResult:
    result = call_llm(
        api_key=api_key,
        model=model,
        base_url=base_url,
        system=prompt.system,
        user=prompt.user,
        temperature=temperature,
        max_tokens=max_tokens,
        require_api_key=require_api_key,
    )
    prompts.validate_parsed(prompt, result.parsed)
    return result


def _call_with_fallback(
    *,
    prompt: prompts.Prompt,
    preferred_model: str,
    pool: tuple[str, ...],
    api_key: str,
    base_url: str,
    temperature: float,
    max_tokens: int,
    require_api_key: bool = True,
    max_attempts: Optional[int] = None,
) -> tuple[LLMResult, str]:
    """Like `_call`, but tries other models in `pool` if `preferred_model` fails.

    Mirrors swarm.py's `_do_call_with_fallback` -- see there for the
    rationale (free-tier models routinely 404/rate-limit/return malformed
    output). With no pool, this is just `_call`. Returns
    (result, model_actually_used) so the caller can keep using whichever
    model just proved itself for the rest of the run.
    """
    if not pool:
        return (
            _call(
                prompt=prompt, api_key=api_key, model=preferred_model, base_url=base_url,
                temperature=temperature, max_tokens=max_tokens, require_api_key=require_api_key,
            ),
            preferred_model,
        )

    cap = max_attempts if max_attempts is not None else settings.model_fallback_attempts
    ordered = [preferred_model] + [m for m in pool if m != preferred_model]

    last_error: Optional[AgentError] = None
    for m in ordered[: max(1, cap)]:
        try:
            result = _call(
                prompt=prompt, api_key=api_key, model=m, base_url=base_url,
                temperature=temperature, max_tokens=max_tokens, require_api_key=require_api_key,
            )
        except AgentError as e:
            last_error = e
            log.warning("model '%s' failed, falling back: %s", m, e)
            continue
        if m != preferred_model:
            log.info("fell back from '%s' to '%s'", preferred_model, m)
        return result, m

    assert last_error is not None
    raise last_error


def run_pipeline(
    *,
    task: str,
    constraints: str,
    api_key: str,
    model: str,
    base_url: str,
    on_step: Optional[callable] = None,  # type: ignore[valid-type]
    require_api_key: bool = True,
    model_pool: tuple[str, ...] = (),
) -> PipelineResult:
    """Run the closed-loop pipeline.

    `on_step` is called after each agent finishes. The UI uses it to stream
    progress without polling. Errors raised by `on_step` are swallowed so a
    UI bug can't kill the pipeline.

    `model_pool`, if non-empty, enables fallback: if the current model fails
    a call, the next model in the pool is tried before giving up. Once a
    fallback model succeeds, it becomes the preferred model for every
    subsequent step in this run (rather than re-trying the original model
    each time) -- once a model's proven itself mid-pipeline, stick with it.
    """
    started = time.monotonic()
    steps: list[AgentStep] = []
    usage_total: dict = {}
    history_lines: list[str] = []
    current_model = model

    def emit(step: AgentStep) -> None:
        steps.append(step)
        if on_step is not None:
            try:
                on_step(step)
            except Exception:  # pragma: no cover - defensive
                pass

    # ------------------------------------------------------------------ #
    # 1. BUILDER
    # ------------------------------------------------------------------ #
    prompt = prompts.builder_prompt(task, constraints)
    try:
        result, current_model = _call_with_fallback(
            prompt=prompt,
            preferred_model=current_model,
            pool=model_pool,
            api_key=api_key,
            base_url=base_url,
            temperature=settings.builder_temperature,
            max_tokens=settings.builder_max_tokens,
            require_api_key=require_api_key,
        )
        merge_usage(usage_total, result.usage)
        solution = str(result.parsed["solution"])
        emit(AgentStep(
            name="BUILDER",
            role="builder",
            evidence=str(result.parsed["evidence"]),
            payload={"solution": solution},
            elapsed_seconds=result.elapsed_seconds,
            usage=result.usage,
        ))
        history_lines.append(f"BUILDER: {result.parsed['evidence']}")
    except AgentError as e:
        emit(AgentStep(
            name="BUILDER",
            role="builder",
            evidence="",
            error=str(e),
        ))
        raise

    # ------------------------------------------------------------------ #
    # 2. REVIEWER (first pass)
    # ------------------------------------------------------------------ #
    last_reviewer_evidence = ""
    last_decision = "FAIL"
    loop_count = 0

    def review_once(current_solution: str) -> tuple[str, str]:
        nonlocal current_model
        prompt = prompts.reviewer_prompt(task, constraints, current_solution)
        r, current_model = _call_with_fallback(
            prompt=prompt,
            preferred_model=current_model,
            pool=model_pool,
            api_key=api_key,
            base_url=base_url,
            temperature=settings.reviewer_temperature,
            max_tokens=settings.reviewer_max_tokens,
            require_api_key=require_api_key,
        )
        merge_usage(usage_total, r.usage)
        decision = str(r.parsed["decision"]).upper().strip()
        if decision not in {"PASS", "FAIL"}:
            decision = "FAIL"
        return decision, str(r.parsed["evidence"])

    try:
        last_decision, last_reviewer_evidence = review_once(solution)
        emit(AgentStep(
            name="REVIEWER",
            role="reviewer",
            evidence=last_reviewer_evidence,
            payload={"decision": last_decision},
        ))
        history_lines.append(f"REVIEWER: {last_decision} — {last_reviewer_evidence}")
    except AgentError as e:
        emit(AgentStep(
            name="REVIEWER",
            role="reviewer",
            evidence="",
            error=str(e),
        ))
        raise

    # ------------------------------------------------------------------ #
    # 3. REMEDIATION LOOP
    # ------------------------------------------------------------------ #
    while last_decision != "PASS" and loop_count < settings.max_remediation_loops:
        loop_count += 1
        try:
            prompt = prompts.remediation_prompt(
                task, constraints, solution, last_reviewer_evidence
            )
            r, current_model = _call_with_fallback(
                prompt=prompt,
                preferred_model=current_model,
                pool=model_pool,
                api_key=api_key,
                base_url=base_url,
                temperature=settings.remediation_temperature,
                max_tokens=settings.remediation_max_tokens,
                require_api_key=require_api_key,
            )
            merge_usage(usage_total, r.usage)
            solution = str(r.parsed["solution"])
            remediation_evidence = str(r.parsed["evidence"])
            emit(AgentStep(
                name=f"REMEDIATION (loop {loop_count})",
                role="remediation",
                evidence=remediation_evidence,
                payload={"solution": solution, "loop": loop_count},
                elapsed_seconds=r.elapsed_seconds,
                usage=r.usage,
            ))
            history_lines.append(
                f"REMEDIATION (loop {loop_count}): {remediation_evidence}"
            )
        except AgentError as e:
            emit(AgentStep(
                name=f"REMEDIATION (loop {loop_count})",
                role="remediation",
                evidence="",
                error=str(e),
            ))
            raise

        try:
            last_decision, last_reviewer_evidence = review_once(solution)
            emit(AgentStep(
                name=f"RE-REVIEW (loop {loop_count})",
                role="reviewer",
                evidence=last_reviewer_evidence,
                payload={"decision": last_decision, "loop": loop_count},
            ))
            history_lines.append(
                f"RE-REVIEW (loop {loop_count}): {last_decision} — {last_reviewer_evidence}"
            )
        except AgentError as e:
            emit(AgentStep(
                name=f"RE-REVIEW (loop {loop_count})",
                role="reviewer",
                evidence="",
                error=str(e),
            ))
            raise

    # ------------------------------------------------------------------ #
    # 4. MASTER REVIEWER
    # ------------------------------------------------------------------ #
    # Cap history to keep the master prompt bounded.
    history_text = "\n".join(history_lines[-20:])
    try:
        prompt = prompts.master_reviewer_prompt(
            task, constraints, solution, history_text
        )
        r, current_model = _call_with_fallback(
            prompt=prompt,
            preferred_model=current_model,
            pool=model_pool,
            api_key=api_key,
            base_url=base_url,
            temperature=settings.master_temperature,
            max_tokens=settings.master_max_tokens,
            require_api_key=require_api_key,
        )
        merge_usage(usage_total, r.usage)
        approval = str(r.parsed["approval"]).upper().strip()
        if approval not in {"GRANTED", "DENIED"}:
            approval = "DENIED"
        master_evidence = str(r.parsed["evidence"])
        emit(AgentStep(
            name="MASTER REVIEWER",
            role="master_reviewer",
            evidence=master_evidence,
            payload={"approval": approval},
            elapsed_seconds=r.elapsed_seconds,
            usage=r.usage,
        ))
    except AgentError as e:
        emit(AgentStep(
            name="MASTER REVIEWER",
            role="master_reviewer",
            evidence="",
            error=str(e),
        ))
        raise

    final_output = solution
    if approval != "GRANTED":
        final_output = (
            f"[NOT APPROVED — best attempt after {loop_count} remediation loop(s)]\n\n"
            f"{solution}"
        )

    return PipelineResult(
        steps=steps,
        final_output=final_output,
        approval=approval,
        loop_count=loop_count,
        tokens=usage_total,
        model=current_model,
        total_elapsed_seconds=time.monotonic() - started,
    )


def to_wire(result: PipelineResult) -> dict:
    """Flatten the pipeline result into the JSON shape the frontend expects."""
    def find(role: str, loop: Optional[int] = None) -> Optional[AgentStep]:
        for s in result.steps:
            if s.role != role:
                continue
            if loop is not None and s.payload.get("loop") != loop:
                continue
            return s
        return None

    reviewer = find("reviewer")
    remediation = find("remediation")
    master = find("master_reviewer")

    return {
        "builder": {
            "evidence": (find("builder").evidence if find("builder") else ""),
        },
        "reviewer": {
            "evidence": (reviewer.evidence if reviewer else ""),
            "decision": (reviewer.payload.get("decision", "FAIL") if reviewer else "FAIL"),
        },
        "remediation": {
            "active": remediation is not None,
            "evidence": (remediation.evidence if remediation else ""),
            "loop_count": result.loop_count,
        },
        "master_reviewer": {
            "evidence": (master.evidence if master else ""),
            "approval": (master.payload.get("approval", "DENIED") if master else "DENIED"),
        },
        "loop_count": result.loop_count,
        "final_output": result.final_output,
        "tokens": result.tokens,
        "model": result.model,
        "total_elapsed_seconds": round(result.total_elapsed_seconds, 2),
        "steps": [
            {
                "name": s.name,
                "role": s.role,
                "evidence": s.evidence,
                "elapsed_seconds": round(s.elapsed_seconds, 2),
                "usage": s.usage,
                "error": s.error,
                "payload_keys": list(s.payload.keys()),
            }
            for s in result.steps
        ],
    }
