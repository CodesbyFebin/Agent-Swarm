"""
Centralised configuration. All tunables live here so they can be overridden
via environment variables without touching code.
"""
from __future__ import annotations

import os
from dataclasses import dataclass


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    # Pipeline
    max_remediation_loops: int = _env_int("MAX_REMEDIATION_LOOPS", 3)
    request_timeout_seconds: int = _env_int("REQUEST_TIMEOUT_SECONDS", 120)
    max_request_bytes: int = _env_int("MAX_REQUEST_BYTES", 64 * 1024)  # 64 KiB

    # Per-agent temperature. Reviewer and Master reviewer run colder so the
    # gatekeeping is deterministic; Builder / Remediation get a bit of room.
    builder_temperature: float = _env_float("BUILDER_TEMPERATURE", 0.4)
    reviewer_temperature: float = _env_float("REVIEWER_TEMPERATURE", 0.1)
    remediation_temperature: float = _env_float("REMEDIATION_TEMPERATURE", 0.3)
    master_temperature: float = _env_float("MASTER_TEMPERATURE", 0.1)

    # Per-agent max output tokens so a misbehaving model can't generate
    # a 200k-token monologue and blow up the next call.
    builder_max_tokens: int = _env_int("BUILDER_MAX_TOKENS", 2048)
    reviewer_max_tokens: int = _env_int("REVIEWER_MAX_TOKENS", 512)
    remediation_max_tokens: int = _env_int("REMEDIATION_MAX_TOKENS", 2048)
    master_max_tokens: int = _env_int("MASTER_MAX_TOKENS", 512)

    # Retry behaviour for transient upstream errors.
    upstream_retries: int = _env_int("UPSTREAM_RETRIES", 2)
    upstream_retry_backoff: float = _env_float("UPSTREAM_RETRY_BACKOFF", 0.6)

    # CORS — "*" by default for the local dev server; tighten in prod.
    cors_allow_origin: str = os.environ.get("CORS_ALLOW_ORIGIN", "*")

    # --- Free tier (anonymous, no API key) ------------------------------ #
    # Kilo Gateway: one OpenAI-compatible endpoint routing to hundreds of
    # models, including a rotating free tier. Anonymous calls (no key) work
    # at a lower rate limit; a Kilo API key raises the cap. When a request
    # to /api/execute or /api/swarm omits api_key/model/base_url, these
    # defaults are used instead of hard-rejecting the request — see
    # GET /api/swarm/models for what's actually configured.
    kilo_base_url: str = os.environ.get("KILO_BASE_URL", "https://api.kilo.ai/api/gateway")
    swarm_max_models: int = _env_int("SWARM_MAX_MODELS", 6)

    # Default free-tier pool used whenever the caller doesn't supply an
    # explicit `model` (single mode) or `models` list (swarm mode). Kilo's
    # free catalog rotates; override with
    # SWARM_DEFAULT_MODELS="model/a:free,model/b:free,...".
    swarm_default_models: tuple[str, ...] = tuple(
        m.strip()
        for m in os.environ.get(
            "SWARM_DEFAULT_MODELS",
            "nvidia/nemotron-3-ultra-550b-a55b:free,"
            "stepfun/step-3.7-flash:free,"
            "cohere/north-mini-code:free,"
            "poolside/laguna-s-2.1:free,"
            "tencent/hy3:free",
        ).split(",")
        if m.strip()
    )

    # When an agent call fails against its assigned free-tier model (swarm
    # candidate/remediation/arbiter, or the sequential /api/execute
    # pipeline), how many *other* pool models to try before giving up on
    # that call entirely. 1 = no fallback (fail immediately, old behavior);
    # capped implicitly at len(pool) by the caller.
    model_fallback_attempts: int = _env_int("MODEL_FALLBACK_ATTEMPTS", 3)

    # Server
    host: str = os.environ.get("HOST", "0.0.0.0")
    port: int = _env_int("PORT", 5000)
    debug: bool = _env_bool("FLASK_DEBUG", False)


settings = Settings()
