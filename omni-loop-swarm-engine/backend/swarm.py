"""
Parallel swarm pipeline.

Flow:
  1. N candidate agents run in parallel against the same task (each gets its
     own system prompt flavor so they don't all converge).
  2. An arbiter (single LLM call) reviews every candidate and picks a winner
     with a confidence score and reasoning.
  3. If round_robin is enabled, each losing candidate gets a remediation pass
     that sees the winner's output + arbiter's reasoning and improves itself.
     All remediation calls run in parallel.
  4. The arbiter runs again on the updated set and we ship the final winner.

Each LLM call records an `AgentStep` so the UI can stream progress via SSE.

The whole pipeline is one HTTP request from the client's perspective, but the
client may poll `/api/swarm/<id>/events` for live updates.
"""
from __future__ import annotations

import logging
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import Any, Optional

from . import prompts
from .config import settings
from .llm import AgentError, JSONFieldStreamExtractor, LLMResult, call_llm, merge_usage, stream_llm
from .pipeline import AgentStep, PipelineResult  # reuse shape

log = logging.getLogger("omni-loop")


# --------------------------------------------------------------------------- #
# Run registry — for SSE streaming
# --------------------------------------------------------------------------- #


@dataclass
class SwarmRun:
    id: str
    task: str
    constraints: str
    config: dict
    api_key: str
    model: str
    base_url: str
    # Resolved per-candidate model pool. Empty => every candidate uses
    # `model` (bring-your-own-key path). Non-empty => candidate i uses
    # models[i % len(models)] (free-tier / explicit multi-model path).
    models: tuple[str, ...] = ()
    require_api_key: bool = True
    # Stream the arbiter's reasoning live over SSE instead of only surfacing
    # it once the call completes. Defaults off so constructing a SwarmRun
    # directly (as the unit tests do) never triggers a real network call;
    # start_swarm_run turns it on for actual runs.
    stream_arbiter: bool = False
    steps: list[AgentStep] = field(default_factory=list)
    final: Optional[dict] = None
    error: Optional[str] = None
    done: bool = False
    started_at: float = field(default_factory=time.time)
    finished_at: Optional[float] = None
    lock: threading.Lock = field(default_factory=threading.Lock)
    cv: threading.Condition = field(default_factory=threading.Condition)

    def emit(self, step: AgentStep) -> None:
        with self.cv:
            self.steps.append(step)
            self.cv.notify_all()

    def complete(self, final: dict) -> None:
        with self.cv:
            self.final = final
            self.done = True
            self.finished_at = time.time()
            self.cv.notify_all()

    def fail(self, message: str) -> None:
        with self.cv:
            self.error = message
            self.done = True
            self.finished_at = time.time()
            self.cv.notify_all()


_REGISTRY: dict[str, SwarmRun] = {}
_REGISTRY_LOCK = threading.Lock()


def get_run(run_id: str) -> Optional[SwarmRun]:
    with _REGISTRY_LOCK:
        return _REGISTRY.get(run_id)


def _register(run: SwarmRun) -> None:
    with _REGISTRY_LOCK:
        _REGISTRY[run.id] = run


# --------------------------------------------------------------------------- #
# Per-agent prompts — different "personalities" so candidates diverge
# --------------------------------------------------------------------------- #

PERSONALITIES = [
    "You are a careful, production-minded engineer. Bias toward defensive code, "
    "explicit error handling, and well-named types. Prefer boring, well-trodden "
    "patterns over clever tricks.",

    "You are a performance-focused systems engineer. Bias toward efficient "
    "algorithms, minimal allocations, and clear time/space complexity. Optimize "
    "for throughput and memory when it doesn't hurt readability.",

    "You are a DX-focused frontend/UX-leaning engineer. Bias toward clear, "
    "ergonomic APIs, good defaults, helpful errors, and a delightful developer "
    "experience. Readability wins over micro-optimisation.",

    "You are a security-and-reliability engineer. Bias toward input validation, "
    "least-privilege defaults, threat-modelling the obvious abuse cases, and "
    "fail-closed behaviour on suspicious input.",

    "You are a pragmatic generalist who ships. Bias toward the simplest solution "
    "that solves the stated problem end-to-end, with the fewest moving parts.",

    "You are a research-minded explorer. Bias toward the most expressive, "
    "composable design — even if it takes more lines. Document tradeoffs in "
    "the evidence so the arbiter can compare.",
]


def candidate_prompt(personality: str, task: str, constraints: str) -> prompts.Prompt:
    system = (
        personality
        + "\n\n"
        "Produce a complete, high-quality deliverable for the task. Do not "
        "stub things out or leave placeholders. Respond with ONLY a JSON "
        "object, no prose outside it, no markdown fences: "
        '{"solution": "<the full deliverable>", '
        '"evidence": "<2-4 sentences: what you produced, why, what tradeoffs you made>"}'
    )
    user = f"TASK:\n{task}\n\nCONSTRAINTS / CONTEXT:\n{constraints or '(none provided)'}"
    return prompts.Prompt(system=system, user=user, required_fields=("solution", "evidence"))


def arbiter_prompt(task: str, constraints: str, candidates: list[dict]) -> prompts.Prompt:
    """Build the arbiter prompt from the candidates' solutions + evidence."""
    blocks = []
    for c in candidates:
        blocks.append(
            f"--- CANDIDATE {c['id']} (model={c.get('model','?')}) ---\n"
            f"SOLUTION:\n{c['solution']}\n\n"
            f"EVIDENCE:\n{c['evidence']}\n"
        )
    system = (
        "You are ARBITER, the impartial judge in a parallel multi-agent swarm. "
        "You will see several candidate solutions for the same task, each from "
        "a different agent. Pick the one that best satisfies the task and any "
        "stated constraints. Be specific: if a candidate misses a requirement, "
        "say which. If two are roughly equal, prefer the one whose evidence "
        "shows clearer reasoning. \n\n"
        "Respond with ONLY a JSON object, no prose outside it, no markdown fences: "
        '{"winner": "<candidate id>", '
        '"confidence": <0..1>, '
        '"reasoning": "<2-5 sentences explaining the choice, naming strengths and weaknesses of the winner>"}'
    )
    user = (
        f"TASK:\n{task}\n\n"
        f"CONSTRAINTS / CONTEXT:\n{constraints or '(none provided)'}\n\n"
        + "\n".join(blocks)
    )
    return prompts.Prompt(system=system, user=user, required_fields=("winner", "confidence", "reasoning"))


def remediation_prompt(
    task: str,
    constraints: str,
    candidate: dict,
    winner_output: str,
    arbiter_reasoning: str,
) -> prompts.Prompt:
    """Improve one candidate by showing it the winner and the arbiter's reasoning."""
    system = (
        "You are a remediation agent. Your previous solution was beaten by "
        "another candidate. You will see the winner's output and the arbiter's "
        "reasoning. Rewrite your solution to match or exceed the winner, while "
        "preserving anything that already worked. Do not introduce new scope.\n\n"
        "Respond with ONLY a JSON object, no prose outside it, no markdown fences: "
        '{"solution": "<your improved deliverable>", '
        '"evidence": "<1-3 sentences: what you changed and why, tied to the arbiter feedback>"}'
    )
    user = (
        f"TASK:\n{task}\n\n"
        f"CONSTRAINTS / CONTEXT:\n{constraints or '(none provided)'}\n\n"
        f"YOUR PREVIOUS SOLUTION:\n{candidate['solution']}\n\n"
        f"WINNING SOLUTION (for reference):\n{winner_output}\n\n"
        f"ARBITER REASONING:\n{arbiter_reasoning}"
    )
    return prompts.Prompt(system=system, user=user, required_fields=("solution", "evidence"))


# --------------------------------------------------------------------------- #
# LLM helpers (thread-safe — we share the requests Session implicitly)
# --------------------------------------------------------------------------- #


def _do_call(prompt: prompts.Prompt, *, api_key: str, model: str, base_url: str,
             temperature: float, max_tokens: int, require_api_key: bool = True) -> LLMResult:
    result = call_llm(
        api_key=api_key, model=model, base_url=base_url,
        system=prompt.system, user=prompt.user,
        temperature=temperature, max_tokens=max_tokens,
        require_api_key=require_api_key,
    )
    prompts.validate_parsed(prompt, result.parsed)
    return result


def _do_call_with_fallback(
    prompt: prompts.Prompt, *, preferred_model: str, pool: tuple[str, ...],
    api_key: str, base_url: str, temperature: float, max_tokens: int,
    require_api_key: bool = True, max_attempts: Optional[int] = None,
) -> tuple[LLMResult, str]:
    """Call `_do_call`, falling back to other models in `pool` on failure.

    Free-tier models routinely 404 (rotated out of the catalog), rate-limit,
    or return malformed output that survives `call_llm`'s own same-model
    retries. When there's a pool to draw from, trying the next model is
    cheap insurance against one bad model failing an entire candidate.

    With no pool (bring-your-own single model), this is just `_do_call` --
    there's nothing to fall back to. Returns (result, model_actually_used)
    so the caller can record which model really answered.
    """
    if not pool:
        return (
            _do_call(
                prompt, api_key=api_key, model=preferred_model, base_url=base_url,
                temperature=temperature, max_tokens=max_tokens,
                require_api_key=require_api_key,
            ),
            preferred_model,
        )

    cap = max_attempts if max_attempts is not None else settings.model_fallback_attempts
    ordered = [preferred_model] + [m for m in pool if m != preferred_model]

    last_error: Optional[AgentError] = None
    for model in ordered[: max(1, cap)]:
        try:
            result = _do_call(
                prompt, api_key=api_key, model=model, base_url=base_url,
                temperature=temperature, max_tokens=max_tokens,
                require_api_key=require_api_key,
            )
        except AgentError as e:
            last_error = e
            log.warning("model '%s' failed, falling back: %s", model, e)
            continue
        if model != preferred_model:
            log.info("fell back from '%s' to '%s'", preferred_model, model)
        return result, model

    assert last_error is not None
    raise last_error


# --------------------------------------------------------------------------- #
# Orchestration
# --------------------------------------------------------------------------- #


def _resolve_swarm_credentials(
    *, api_key: str, model: str, base_url: str, models: Optional[list[str]]
) -> tuple[str, str, tuple[str, ...]]:
    """Resolve (model, base_url, model_pool) from optional caller-supplied credentials.

    Pure and side-effect-free so it's testable without touching threads or
    the network. Resolution order:
      1. `models` (explicit multi-model pool) if given and non-empty — each
         candidate i uses models[i % len(models)]. Works with or without an
         api_key (Kilo Gateway accepts anonymous calls at a lower rate).
      2. `model` (single model) if given — every candidate uses it, same as
         before. Requires an api_key unless the caller is deliberately
         pointing at an anonymous-friendly base_url.
      3. Neither given — free-tier default: falls back to
         settings.swarm_default_models as the pool, settings.kilo_base_url
         as the base_url, and no API key is required.
    """
    resolved_base_url = base_url or settings.kilo_base_url
    if models:
        resolved_pool = tuple(dict.fromkeys(m.strip() for m in models if m.strip()))[: settings.swarm_max_models]
        if not resolved_pool:
            raise AgentError("models must contain at least one non-empty id")
        resolved_model = resolved_pool[0]
    elif model:
        resolved_pool = ()
        resolved_model = model
    else:
        resolved_pool = tuple(settings.swarm_default_models)[: settings.swarm_max_models]
        resolved_model = resolved_pool[0] if resolved_pool else ""
        if not resolved_model:
            raise AgentError("no model available: pass model/models or configure SWARM_DEFAULT_MODELS")

    return resolved_model, resolved_base_url, resolved_pool


def start_swarm_run(
    *,
    task: str,
    constraints: str,
    api_key: str = "",
    model: str = "",
    base_url: str = "",
    models: Optional[list[str]] = None,
    agent_count: int,
    iterations: int,
    mode: str,
    round_robin: bool,
) -> SwarmRun:
    """Create a SwarmRun and kick off the pipeline in a background thread.

    Returns immediately. The client polls the SSE endpoint for events.
    Credentials are optional -- see `_resolve_swarm_credentials` for the
    free-tier fallback.
    """
    if mode not in {"single", "swarm", "arbiter"}:
        raise AgentError(f"unknown mode: {mode}")
    if not 1 <= agent_count <= 6:
        raise AgentError("agent_count must be between 1 and 6")
    if not 1 <= iterations <= 10:
        raise AgentError("iterations must be between 1 and 10")

    resolved_model, resolved_base_url, resolved_pool = _resolve_swarm_credentials(
        api_key=api_key, model=model, base_url=base_url, models=models
    )

    run = SwarmRun(
        id=uuid.uuid4().hex[:12],
        task=task,
        constraints=constraints,
        config={
            "agent_count": agent_count,
            "iterations": iterations,
            "mode": mode,
            "round_robin": round_robin,
        },
        api_key=api_key,
        model=resolved_model,
        base_url=resolved_base_url,
        models=resolved_pool,
        require_api_key=bool(api_key),
        stream_arbiter=True,
    )
    _register(run)

    t = threading.Thread(
        target=_run_swarm_thread,
        args=(run,),
        name=f"swarm-{run.id}",
        daemon=True,
    )
    t.start()
    return run


def _run_swarm_thread(run: SwarmRun) -> None:
    try:
        final = _run_swarm(run)
        run.complete(final)
    except AgentError as e:
        run.fail(str(e))
    except Exception as e:  # pragma: no cover - defensive
        run.fail(f"Unexpected error: {e}")


def _run_swarm(run: SwarmRun) -> dict:
    cfg = run.config
    task = run.task
    constraints = run.constraints
    model = run.model
    base_url = run.base_url
    api_key = run.api_key
    require_api_key = run.require_api_key
    # Free-tier / explicit multi-model mode: each candidate gets its own
    # model from the pool instead of every candidate sharing `model`.
    pool = run.models

    def model_for(idx: int) -> str:
        return pool[idx % len(pool)] if pool else model

    usage_total: dict = {}

    # ------------------------------------------------------------------ #
    # 1. Build N candidates in parallel
    # ------------------------------------------------------------------ #
    n = cfg["agent_count"]
    candidates: list[dict] = []
    candidate_index = list(range(n))

    def build_one(idx: int) -> tuple[int, str, LLMResult, float]:
        started = time.monotonic()
        preferred = model_for(idx)
        personality = PERSONALITIES[idx % len(PERSONALITIES)]
        p = candidate_prompt(personality, task, constraints)
        r, cand_model = _do_call_with_fallback(
            p,
            preferred_model=preferred, pool=pool,
            api_key=api_key, base_url=base_url,
            temperature=settings.builder_temperature,
            max_tokens=settings.builder_max_tokens,
            require_api_key=require_api_key,
        )
        return idx, cand_model, r, time.monotonic() - started

    started_all = time.monotonic()
    with ThreadPoolExecutor(max_workers=n) as ex:
        # A dict (not a list) so the original candidate index survives even
        # when the future raises -- fut.result() failing partway through an
        # unpacking assignment would otherwise leave idx unbound.
        futures = {ex.submit(build_one, i): i for i in candidate_index}
        for fut in as_completed(futures):
            idx = futures[fut]
            try:
                _, cand_model, r, elapsed = fut.result()
            except AgentError as e:
                run.emit(AgentStep(
                    name=f"AGENT {idx + 1} (build)",
                    role="candidate_build",
                    evidence="",
                    payload={"candidate_index": idx},
                    error=str(e),
                ))
                raise
            merge_usage(usage_total, r.usage)
            cand = {
                "id": f"agent-{idx + 1}",
                "name": f"Agent {idx + 1}",
                "model": cand_model,
                "iterations": 1,
                "solution": str(r.parsed["solution"]),
                "evidence": str(r.parsed["evidence"]),
                "elapsed_seconds": round(elapsed, 2),
                "usage": r.usage,
            }
            candidates.append(cand)
            run.emit(AgentStep(
                name=f"AGENT {idx + 1} (build)",
                role="candidate_build",
                evidence=cand["evidence"],
                payload={"candidate_id": cand["id"], "candidate_index": idx, "model": cand_model},
                elapsed_seconds=elapsed,
                usage=r.usage,
            ))

    # Sort by original index for stable UI ordering
    candidates.sort(key=lambda c: int(c["id"].split("-")[1]))

    # ------------------------------------------------------------------ #
    # 2. Arbiter decides
    # ------------------------------------------------------------------ #
    arbiter = None
    if cfg["mode"] in {"arbiter", "swarm"} and len(candidates) > 1:
        arbiter = _run_arbiter(run, candidates, usage_total)
    elif len(candidates) == 1:
        arbiter = {
            "winner": candidates[0]["id"],
            "confidence": 1.0,
            "reasoning": "Only one candidate was produced; it wins by default.",
        }

    # ------------------------------------------------------------------ #
    # 3. Round-robin remediation (parallel)
    # ------------------------------------------------------------------ #
    remediation_done = False
    if cfg["round_robin"] and arbiter and len(candidates) > 1:
        winner_id = arbiter["winner"]
        winner = next(c for c in candidates if c["id"] == winner_id)
        losers = [c for c in candidates if c["id"] != winner_id]

        def remediate_one(cand: dict) -> tuple[str, LLMResult, float]:
            started = time.monotonic()
            # In pool mode, remediate with a *different* model than the one
            # that built this candidate, so it isn't just grading its own
            # homework again. Falls back through the rest of the pool if
            # that preferred remediator is unavailable/flaky.
            cand_idx = int(cand["id"].split("-")[1]) - 1
            preferred = pool[(cand_idx + 1) % len(pool)] if pool else model
            p = remediation_prompt(
                task, constraints, cand, winner["solution"], arbiter["reasoning"]
            )
            r, _ = _do_call_with_fallback(
                p,
                preferred_model=preferred, pool=pool,
                api_key=api_key, base_url=base_url,
                temperature=settings.remediation_temperature,
                max_tokens=settings.remediation_max_tokens,
                require_api_key=require_api_key,
            )
            return cand["id"], r, time.monotonic() - started

        with ThreadPoolExecutor(max_workers=max(1, len(losers))) as ex:
            futures = [ex.submit(remediate_one, c) for c in losers]
            for fut in as_completed(futures):
                cid, r, elapsed = fut.result()
                merge_usage(usage_total, r.usage)
                # Replace the candidate's solution + evidence
                for c in candidates:
                    if c["id"] == cid:
                        c["solution"] = str(r.parsed["solution"])
                        c["evidence"] = str(r.parsed["evidence"])
                        c["iterations"] += 1
                        break
                run.emit(AgentStep(
                    name=f"REMEDIATION ({cid})",
                    role="remediation",
                    evidence=str(r.parsed["evidence"]),
                    payload={"candidate_id": cid},
                    elapsed_seconds=elapsed,
                    usage=r.usage,
                ))
        remediation_done = True

        # Re-run arbiter on the updated set
        arbiter = _run_arbiter(run, candidates, usage_total)

    # ------------------------------------------------------------------ #
    # 4. Build final wire payload
    # ------------------------------------------------------------------ #
    winner_id = (arbiter or {}).get("winner") or candidates[0]["id"]
    winner = next(c for c in candidates if c["id"] == winner_id)

    total_elapsed = time.monotonic() - started_all

    return {
        "id": run.id,
        "mode": cfg["mode"],
        "candidates": candidates,
        "arbiter": arbiter,
        "round_robin": {"enabled": cfg["round_robin"], "done": remediation_done},
        "winner_id": winner_id,
        "final_output": winner["solution"],
        "tokens": usage_total,
        "model": model,
        "models_used": list(pool) if pool else [model],
        "total_elapsed_seconds": round(total_elapsed, 2),
    }


def _run_arbiter(run: SwarmRun, candidates: list[dict], usage_total: dict) -> dict:
    p = arbiter_prompt(run.task, run.constraints, candidates)
    started = time.monotonic()
    # Arbiter uses a fixed model for consistent judging across re-runs (the
    # arbiter is called again after remediation). In pool mode that's the
    # last model in the pool; otherwise the single configured model.
    arbiter_model = run.models[-1] if run.models else run.model

    r = None
    # Stream the arbiter's reasoning live over SSE (role="arbiter_delta")
    # instead of the UI seeing nothing until the whole call completes.
    # Only the preferred model gets this treatment: once we've streamed
    # partial reasoning to the client, silently restarting on a different
    # model would show text rewinding/duplicating, so a streaming failure
    # falls through to a normal (non-streaming) fallback pass instead of
    # retrying the stream itself.
    # The model streams the whole JSON envelope ({"winner":..., "reasoning":
    # "..."}), not just the reasoning prose -- extract just that field's
    # text so the UI shows clean sentences, not raw JSON syntax.
    reasoning_extractor = JSONFieldStreamExtractor("reasoning")

    def on_delta(raw_chunk: str) -> None:
        piece = reasoning_extractor.feed(raw_chunk)
        if not piece:
            return
        run.emit(AgentStep(
            name="ARBITER",
            role="arbiter_delta",
            evidence=piece,
            payload={"accumulated": reasoning_extractor.value},
        ))

    if run.stream_arbiter:
        try:
            stream_result = stream_llm(
                api_key=run.api_key, model=arbiter_model, base_url=run.base_url,
                system=p.system, user=p.user,
                temperature=settings.master_temperature, max_tokens=settings.master_max_tokens,
                require_api_key=run.require_api_key, on_delta=on_delta,
            )
            prompts.validate_parsed(p, stream_result.parsed)
        except AgentError as e:
            log.warning("arbiter streaming failed on '%s', falling back: %s", arbiter_model, e)
        else:
            r = stream_result

    if r is None:
        try:
            r, _ = _do_call_with_fallback(
                p,
                preferred_model=arbiter_model, pool=run.models,
                api_key=run.api_key, base_url=run.base_url,
                temperature=settings.master_temperature,
                max_tokens=settings.master_max_tokens,
                require_api_key=run.require_api_key,
            )
        except AgentError as e:
            run.emit(AgentStep(
                name="ARBITER",
                role="arbiter",
                evidence="",
                error=str(e),
            ))
            raise
    merge_usage(usage_total, r.usage)

    # Validate the winner id; if the model hallucinated one, fall back to the first candidate.
    winner_id = str(r.parsed["winner"]).strip()
    valid_ids = {c["id"] for c in candidates}
    if winner_id not in valid_ids:
        winner_id = candidates[0]["id"]
    try:
        confidence = max(0.0, min(1.0, float(r.parsed["confidence"])))
    except (TypeError, ValueError):
        confidence = 0.5

    arbiter = {
        "winner": winner_id,
        "confidence": confidence,
        "reasoning": str(r.parsed["reasoning"]),
    }
    run.emit(AgentStep(
        name="ARBITER",
        role="arbiter",
        evidence=arbiter["reasoning"],
        payload={"winner": winner_id, "confidence": confidence},
        elapsed_seconds=time.monotonic() - started,
        usage=r.usage,
    ))
    return arbiter
