"""
Deterministic demo for the parallel swarm. No network. Mirrors the shape of
`backend.swarm._run_swarm` so the UI can be exercised end-to-end.

Each candidate gets a deterministic approach string derived from its index,
so the same task always produces the same set of candidates.
"""
from __future__ import annotations

import hashlib
import time
from typing import Optional

from .pipeline import AgentStep


APPROACHES = [
    "Optimized for time complexity with O(n) traversal using dynamic programming",
    "Prioritized readability with clear separation of concerns and comprehensive error handling",
    "Focused on scalability with modular architecture and dependency injection",
    "Emphasized security with input validation and sanitized outputs",
    "Balanced approach with performance profiling and memory-efficient data structures",
    "Innovative solution leveraging parallel processing and caching strategies",
]

METHODOLOGIES = [
    "divide-and-conquer", "iterative refinement", "heuristic search",
    "constraint satisfaction", "greedy + memoization", "constraint propagation",
]


def _seeded_quality(task: str, idx: int) -> float:
    """Deterministic 'quality' in [0.6, 1.0] per (task, idx)."""
    h = hashlib.sha256(f"{task}::{idx}".encode("utf-8")).digest()
    # Take 4 bytes, scale to [0.6, 1.0]
    n = int.from_bytes(h[:4], "big") / 0xFFFFFFFF
    return 0.6 + n * 0.4


def _candidate_output(task: str, idx: int) -> str:
    approach = APPROACHES[idx % len(APPROACHES)]
    q = _seeded_quality(task, idx)
    return (
        f"# Approach {idx + 1}: {approach}\n\n"
        f"## For task\n{task}\n\n"
        f"## Implementation notes\n"
        f"- Lines of code: {20 + idx * 7}\n"
        f"- Test coverage: {(70 + idx * 3) % 30 + 70}%\n"
        f"- Implementation quality: {(q * 100):.0f}%\n"
    )


def _candidate_evidence(task: str, idx: int) -> str:
    methodology = METHODOLOGIES[idx % len(METHODOLOGIES)]
    q = _seeded_quality(task, idx)
    return (
        f"Agent {idx + 1} analysis: decomposed the task into {3 + idx} "
        f"sub-problems, applied {methodology}, validated against {2 + idx} edge "
        f"cases. Confidence {(q * 100):.0f}%."
    )


def _classify(task: str) -> str:
    t = task.lower()
    if any(k in t for k in ("function", "code", "implement", "script", "sql", "regex", "component")):
        return "code"
    if any(k in t for k in ("write", "blog", "essay", "email", "letter", "story")):
        return "writing"
    if any(k in t for k in ("analyze", "compare", "evaluate", "plan", "schema", "design")):
        return "analysis"
    return "generic"


def _winner_reasoning(task: str, winner_idx: int, candidates: list[dict]) -> str:
    winner = candidates[winner_idx]
    losers = [c for i, c in enumerate(candidates) if i != winner_idx]
    loser_scores = ", ".join(f"{(c['quality'] * 100):.0f}%" for c in losers)
    plural = "s" if len(losers) != 1 else ""
    task_preview = task[:60] + ("…" if len(task) > 60 else "")
    return (
        f"Selected Agent {winner_idx + 1} for {winner['approach_summary']}. "
        f"It scored {(winner['quality'] * 100):.0f}% on the internal quality "
        f"estimate, which is higher than the other {len(losers)} candidate"
        f"{plural} ({loser_scores}). "
        f"For the task \"{task_preview}\" this approach best balances "
        f"correctness, completeness, and adherence to any stated constraints."
    )


def run_demo_swarm(
    *,
    task: str,
    agent_count: int = 4,
    iterations: int = 3,
    mode: str = "swarm",
    round_robin: bool = True,
    sleep_seconds: float = 0.05,
) -> dict:
    """Run a deterministic demo swarm. Returns the same wire shape as the live API."""
    started = time.monotonic()
    # Defensive clamping so callers (including tests) can pass any value.
    agent_count = max(1, min(6, agent_count))
    iterations = max(1, min(10, iterations))

    usage_total = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

    # 1. Build candidates
    candidates: list[dict] = []
    for i in range(agent_count):
        q = _seeded_quality(task, i)
        cand = {
            "id": f"agent-{i + 1}",
            "name": f"Agent {i + 1}",
            "model": "demo",
            "iterations": 1,
            "solution": _candidate_output(task, i),
            "evidence": _candidate_evidence(task, i),
            "quality": q,
            "approach_summary": APPROACHES[i % len(APPROACHES)].split(" with ")[0],
            "elapsed_seconds": round(0.1 + i * 0.02, 2),
            "usage": {"prompt_tokens": 100, "completion_tokens": 80, "total_tokens": 180},
        }
        candidates.append(cand)
        usage_total["prompt_tokens"] += 100
        usage_total["completion_tokens"] += 80
        usage_total["total_tokens"] += 180
        time.sleep(sleep_seconds)

    # 2. Arbiter
    arbiter = None
    if mode in {"swarm", "arbiter"} and agent_count > 1:
        winner_idx = max(range(agent_count), key=lambda i: candidates[i]["quality"])
        arbiter = {
            "winner": candidates[winner_idx]["id"],
            "confidence": 0.8 + candidates[winner_idx]["quality"] * 0.15,
            "reasoning": _winner_reasoning(task, winner_idx, candidates),
        }
    elif agent_count == 1:
        arbiter = {
            "winner": candidates[0]["id"],
            "confidence": 1.0,
            "reasoning": "Only one candidate was produced; it wins by default.",
        }

    # 3. Round-robin remediation
    remediation_done = False
    if round_robin and arbiter and agent_count > 1:
        winner_idx = next(i for i, c in enumerate(candidates) if c["id"] == arbiter["winner"])
        winner = candidates[winner_idx]
        for i, c in enumerate(candidates):
            if c["id"] == winner["id"]:
                continue
            # Bump the quality deterministically (still bounded)
            c["quality"] = min(1.0, c["quality"] + 0.05)
            c["solution"] = c["solution"] + (
                f"\n## Refinement (after seeing winner)\n"
                f"Adopted the winner's structural pattern; kept my naming and "
                f"error-handling. New quality estimate: {(c['quality'] * 100):.0f}%.\n"
            )
            c["iterations"] += 1
            c["evidence"] += " Refined based on the winner's approach."
            usage_total["total_tokens"] += 200
            time.sleep(sleep_seconds)
        remediation_done = True

        # Re-arbiter
        winner_idx = max(range(agent_count), key=lambda i: candidates[i]["quality"])
        arbiter = {
            "winner": candidates[winner_idx]["id"],
            "confidence": 0.8 + candidates[winner_idx]["quality"] * 0.15,
            "reasoning": _winner_reasoning(task, winner_idx, candidates),
        }

    # 4. Strip demo-only fields from the wire shape
    for c in candidates:
        c.pop("approach_summary", None)

    winner_id = (arbiter or {}).get("winner") or candidates[0]["id"]
    winner = next(c for c in candidates if c["id"] == winner_id)

    return {
        "id": "demo",
        "mode": mode,
        "task_kind": _classify(task),
        "candidates": candidates,
        "arbiter": arbiter,
        "round_robin": {"enabled": round_robin, "done": remediation_done},
        "winner_id": winner_id,
        "final_output": winner["solution"],
        "tokens": usage_total,
        "model": "demo",
        "total_elapsed_seconds": round(time.monotonic() - started, 2),
    }
