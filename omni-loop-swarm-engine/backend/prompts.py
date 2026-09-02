"""
Per-agent prompts. Each agent declares the JSON shape it must return so the
pipeline can validate the response and surface a clean error if the model
hallucinated a different structure.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from .llm import AgentError


@dataclass(frozen=True)
class Prompt:
    system: str
    user: str
    # Field names the agent MUST return. We don't enforce types because
    # LLMs love adding weird unicode dashes etc., but presence is required.
    required_fields: tuple[str, ...]


def builder_prompt(task: str, constraints: str) -> Prompt:
    system = (
        "You are BUILDER, the first agent in a closed-loop production pipeline. "
        "You produce a complete, high-quality first solution to the given task. "
        "Be thorough and concrete — do not stub things out or leave placeholders. "
        "If the task asks for code, ship runnable code. If it asks for prose, "
        "ship the final prose, not an outline of it."
        "\n\n"
        'Respond with ONLY a JSON object, no prose outside it, no markdown fences: '
        '{"solution": "<the full deliverable, as plain text or code>", '
        '"evidence": "<2-5 sentences explaining your approach and how it satisfies the task/constraints>"}'
    )
    user = f"TASK:\n{task}\n\nCONSTRAINTS / CONTEXT:\n{constraints or '(none provided)'}"
    return Prompt(system=system, user=user, required_fields=("solution", "evidence"))


def reviewer_prompt(task: str, constraints: str, solution: str) -> Prompt:
    system = (
        "You are REVIEWER, the gatekeeper of a closed-loop production pipeline. "
        "You are strict and specific. Evaluate the candidate solution against the "
        "original task and constraints. Look for correctness, completeness, missed "
        "requirements, and anything that would break in production. "
        "PASS only if the solution genuinely meets the bar — false positives waste "
        "compute and ship broken work. "
        "\n\n"
        'Respond with ONLY a JSON object, no prose outside it, no markdown fences: '
        '{"decision": "PASS" or "FAIL", '
        '"evidence": "<specific evaluation; if FAIL, enumerate the concrete issues that must be fixed>"}'
    )
    user = (
        f"TASK:\n{task}\n\nCONSTRAINTS / CONTEXT:\n{constraints or '(none provided)'}\n\n"
        f"CANDIDATE SOLUTION TO REVIEW:\n{solution}"
    )
    return Prompt(system=system, user=user, required_fields=("decision", "evidence"))


def remediation_prompt(
    task: str, constraints: str, solution: str, reviewer_feedback: str
) -> Prompt:
    system = (
        "You are REMEDIATION, the agent responsible for fixing flaws a reviewer has "
        "identified. Rewrite the solution to resolve every issue raised, while "
        "preserving everything that already worked. Do not introduce new scope "
        "beyond what's needed to satisfy the task, constraints, and reviewer feedback. "
        "\n\n"
        'Respond with ONLY a JSON object, no prose outside it, no markdown fences: '
        '{"solution": "<the corrected, complete deliverable>", '
        '"evidence": "<what you changed and why, tied directly to the reviewer\'s feedback>"}'
    )
    user = (
        f"TASK:\n{task}\n\nCONSTRAINTS / CONTEXT:\n{constraints or '(none provided)'}\n\n"
        f"PREVIOUS SOLUTION:\n{solution}\n\n"
        f"REVIEWER FEEDBACK TO RESOLVE:\n{reviewer_feedback}"
    )
    return Prompt(
        system=system, user=user, required_fields=("solution", "evidence")
    )


def master_reviewer_prompt(
    task: str, constraints: str, solution: str, history: str
) -> Prompt:
    system = (
        "You are MASTER REVIEWER, the final production authority in this pipeline. "
        "Nothing ships without your approval. Review the final candidate solution and "
        "the full review history. Grant approval only if the solution is genuinely "
        "production-ready for the stated task and constraints. "
        "Be conservative — a DENY that turns into a fix is cheaper than a GRANT that "
        "ships a regression."
        "\n\n"
        'Respond with ONLY a JSON object, no prose outside it, no markdown fences: '
        '{"approval": "GRANTED" or "DENIED", '
        '"evidence": "<final production-readiness assessment>"}'
    )
    user = (
        f"TASK:\n{task}\n\nCONSTRAINTS / CONTEXT:\n{constraints or '(none provided)'}\n\n"
        f"FINAL CANDIDATE SOLUTION:\n{solution}\n\n"
        f"PIPELINE HISTORY:\n{history}"
    )
    return Prompt(
        system=system, user=user, required_fields=("approval", "evidence")
    )


# --------------------------------------------------------------------------- #
# Validation
# --------------------------------------------------------------------------- #


def validate_parsed(prompt: Prompt, parsed: dict) -> dict:
    """Raise AgentError if any required field is missing/empty, else return parsed."""
    missing = [f for f in prompt.required_fields if not str(parsed.get(f, "")).strip()]
    if missing:
        raise AgentError(
            f"Model response missing required field(s): {', '.join(missing)}. "
            f"Got: {parsed!r}"
        )
    return parsed


# Type hint only
PromptBuilder = Callable[..., Prompt]
