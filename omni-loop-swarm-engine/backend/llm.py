"""
LLM client + JSON extraction.

Kept dependency-free except for `requests`. Every call returns a structured
`LLMResult` so the pipeline can surface a clean error if the model returns
something we can't parse.
"""
from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass
from typing import Any, Callable, Optional

import requests

from .config import settings


class AgentError(Exception):
    """Raised when an upstream LLM call fails or returns something unusable."""


@dataclass
class LLMResult:
    parsed: dict
    raw: str
    usage: dict
    elapsed_seconds: float


# --------------------------------------------------------------------------- #
# JSON extraction
# --------------------------------------------------------------------------- #

_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def _strip_code_fences(text: str) -> str:
    cleaned = text.strip()
    cleaned = _FENCE_RE.sub("", cleaned)
    return cleaned.strip()


def _find_balanced_json(text: str) -> Optional[str]:
    """Return the first balanced `{...}` substring, or None.

    Handles nested objects and strings that contain braces. Stops at the
    first fully-balanced top-level object.
    """
    start = text.find("{")
    if start == -1:
        return None

    depth = 0
    in_string = False
    escape = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return None


def _try_loads(text: str) -> Optional[dict]:
    try:
        value = json.loads(text)
        return value if isinstance(value, dict) else None
    except json.JSONDecodeError:
        return None


def extract_json(text: str) -> dict:
    """Recover a JSON object from a model response.

    Tries, in order:
      1. Direct parse (after stripping code fences).
      2. First balanced `{...}` substring.
      3. Heuristic repair of common JSON mistakes (trailing commas, single quotes).
    """
    if not text:
        raise AgentError("Empty response from model")

    cleaned = _strip_code_fences(text)
    parsed = _try_loads(cleaned)
    if parsed is not None:
        return parsed

    candidate = _find_balanced_json(cleaned)
    if candidate is not None:
        parsed = _try_loads(candidate)
        if parsed is not None:
            return parsed

        # Last-ditch repair: trailing commas, single quotes.
        repaired = re.sub(r",\s*([}\]])", r"\1", candidate)
        repaired = repaired.replace("'", '"')
        parsed = _try_loads(repaired)
        if parsed is not None:
            return parsed

    raise AgentError(
        f"Could not parse JSON from model output. First 240 chars: {cleaned[:240]!r}"
    )


class JSONFieldStreamExtractor:
    """Incrementally extracts one string field's value out of a raw JSON
    token stream, for live UI display *before* the object is complete.

    Every agent prompt in this codebase asks the model for a single JSON
    object (`{"reasoning": "...", ...}`); streaming that raw is unusable for
    a UI -- the viewer would see literal braces/quotes/other field names
    mixed into the prose. This pulls out just the requested field's text as
    it arrives, best-effort (it doesn't require the object to be valid or
    complete yet). The authoritative parse still happens via `extract_json`
    once the full response has landed -- this is purely a live preview.

    Limitations (acceptable for a preview): assumes the target field's
    value is a plain string (no escaped unicode decoding beyond `\\` +
    next-char), and starts extracting only once it sees `"<field>"` followed
    by `:` and an opening quote, so nothing streams until the model reaches
    that key.
    """

    def __init__(self, field_name: str):
        self._key_marker = f'"{field_name}"'
        self._raw = ""
        self.value = ""
        self._in_value = False
        self._escape = False
        self._done = False

    def feed(self, chunk: str) -> str:
        """Feed the next chunk of raw stream text; return the newly-extracted
        clean text (empty string if nothing new -- e.g. still looking for
        the field, or the field's value has already closed)."""
        if self._done:
            return ""

        if not self._in_value:
            self._raw += chunk
            idx = self._raw.find(self._key_marker)
            if idx == -1:
                return ""
            after_key = self._raw[idx + len(self._key_marker):]
            colon_idx = after_key.find(":")
            if colon_idx == -1:
                return ""
            after_colon = after_key[colon_idx + 1:]
            quote_idx = after_colon.find('"')
            if quote_idx == -1:
                return ""
            self._in_value = True
            remainder = after_colon[quote_idx + 1:]
        else:
            remainder = chunk

        out_chars: list[str] = []
        for ch in remainder:
            if self._escape:
                out_chars.append(ch)
                self._escape = False
                continue
            if ch == "\\":
                self._escape = True
                continue
            if ch == '"':
                self._done = True
                break
            out_chars.append(ch)

        piece = "".join(out_chars)
        self.value += piece
        return piece


# --------------------------------------------------------------------------- #
# HTTP call
# --------------------------------------------------------------------------- #

def _parse_retry_after(value: Optional[str]) -> Optional[float]:
    """Parse a `Retry-After` header: either delta-seconds or an HTTP-date.

    Returns None if absent/unparseable, in which case the caller falls back
    to its own exponential backoff.
    """
    if not value:
        return None
    try:
        return max(0.0, float(value))
    except ValueError:
        pass
    try:
        from email.utils import parsedate_to_datetime
        dt = parsedate_to_datetime(value)
        if dt is None:
            return None
        from datetime import datetime, timezone
        now = datetime.now(dt.tzinfo or timezone.utc)
        return max(0.0, (dt - now).total_seconds())
    except (TypeError, ValueError):
        return None


def call_llm(
    *,
    api_key: str,
    model: str,
    base_url: str,
    system: str,
    user: str,
    temperature: float,
    max_tokens: int,
    json_schema_hint: Optional[dict] = None,
    require_api_key: bool = True,
) -> LLMResult:
    """Call an OpenAI-compatible /chat/completions endpoint with retry.

    `require_api_key=False` allows anonymous calls (e.g. Kilo Gateway's
    free-tier pool, which is reachable with no key at a lower rate limit).
    When `api_key` is empty in that mode, no Authorization header is sent.
    """
    if require_api_key and not api_key:
        raise AgentError("API key is required")
    if not model:
        raise AgentError("Model is required")
    if not base_url:
        raise AgentError("Base URL is required")

    url = base_url.rstrip("/") + "/chat/completions"
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    payload: dict[str, Any] = {
        "model": model,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }

    # Most OpenAI-compatible providers support `response_format` for JSON mode.
    # We ask for it but don't require it — the parser is resilient either way.
    payload["response_format"] = {"type": "json_object"}

    last_error: Optional[Exception] = None
    attempts = max(1, settings.upstream_retries + 1)

    for attempt in range(1, attempts + 1):
        started = time.monotonic()
        try:
            resp = requests.post(
                url,
                headers=headers,
                json=payload,
                timeout=settings.request_timeout_seconds,
            )
        except requests.exceptions.Timeout as e:
            last_error = AgentError(f"Model endpoint timed out after {settings.request_timeout_seconds}s")
            log_attempt_failure(attempt, attempts, last_error)
        except requests.exceptions.RequestException as e:
            last_error = AgentError(f"Could not reach model endpoint ({base_url}): {e}")
            log_attempt_failure(attempt, attempts, last_error)
        else:
            retryable_status = resp.status_code == 429 or 500 <= resp.status_code < 600
            if retryable_status and attempt < attempts:
                last_error = AgentError(
                    f"Model endpoint returned {resp.status_code} (transient)"
                )
                log_attempt_failure(attempt, attempts, last_error)
                retry_after = _parse_retry_after(resp.headers.get("Retry-After"))
                if retry_after is not None:
                    # Cap it -- a server-supplied wait shouldn't be able to
                    # stall a request thread indefinitely.
                    time.sleep(min(retry_after, 30.0))
                    continue
            elif resp.status_code != 200:
                detail = resp.text[:500]
                raise AgentError(f"Model endpoint returned {resp.status_code}: {detail}")
            else:
                data = resp.json()
                try:
                    content = data["choices"][0]["message"]["content"]
                except (KeyError, IndexError, TypeError) as e:
                    raise AgentError(
                        f"Unexpected response shape from model endpoint: {data!r}"
                    ) from e

                usage = data.get("usage") or {}
                try:
                    parsed = extract_json(content)
                except AgentError as e:
                    # Small/free models frequently wander off the requested
                    # JSON shape (nested objects, truncation). That's often
                    # non-deterministic, so it's worth one more roll of the
                    # dice on the same model before giving up on it entirely.
                    if attempt < attempts:
                        last_error = e
                        log_attempt_failure(attempt, attempts, last_error)
                    else:
                        raise
                else:
                    return LLMResult(
                        parsed=parsed,
                        raw=content,
                        usage=usage,
                        elapsed_seconds=time.monotonic() - started,
                    )

        if attempt < attempts:
            backoff = settings.upstream_retry_backoff * (2 ** (attempt - 1))
            time.sleep(backoff)

    # If we get here, every attempt failed with a transient error.
    assert last_error is not None
    raise last_error


def stream_llm(
    *,
    api_key: str,
    model: str,
    base_url: str,
    system: str,
    user: str,
    temperature: float,
    max_tokens: int,
    require_api_key: bool = True,
    on_delta: Optional[Callable[[str], None]] = None,
) -> LLMResult:
    """Like `call_llm`, but streams the response and calls `on_delta(chunk)`
    for each content fragment as it arrives (SSE `data: {...}` lines from an
    OpenAI-compatible `/chat/completions?stream=true` endpoint).

    No same-call retry here -- once partial content has been surfaced to a
    caller (e.g. pushed out over our own SSE stream to a UI), silently
    restarting from scratch would show the viewer text rewinding or
    duplicating. Callers that want resilience should catch AgentError and
    fall back to a fresh non-streaming call_llm/call_llm-with-fallback
    attempt (a clean restart, not a retry of this one).
    """
    if require_api_key and not api_key:
        raise AgentError("API key is required")
    if not model:
        raise AgentError("Model is required")
    if not base_url:
        raise AgentError("Base URL is required")

    url = base_url.rstrip("/") + "/chat/completions"
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    payload = {
        "model": model,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True,
        # Widely-supported OpenAI-compatible extension for getting token
        # usage on the final chunk of a stream; harmless if the provider
        # ignores it (usage just comes back empty).
        "stream_options": {"include_usage": True},
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }

    started = time.monotonic()
    try:
        resp = requests.post(
            url, headers=headers, json=payload,
            timeout=settings.request_timeout_seconds, stream=True,
        )
    except requests.exceptions.Timeout as e:
        raise AgentError(f"Model endpoint timed out after {settings.request_timeout_seconds}s") from e
    except requests.exceptions.RequestException as e:
        raise AgentError(f"Could not reach model endpoint ({base_url}): {e}") from e

    if resp.status_code != 200:
        detail = resp.text[:500]
        raise AgentError(f"Model endpoint returned {resp.status_code}: {detail}")

    content_parts: list[str] = []
    usage: dict = {}
    try:
        for raw_line in resp.iter_lines(decode_unicode=True):
            if not raw_line or not raw_line.startswith("data:"):
                continue
            data_str = raw_line[len("data:"):].strip()
            if data_str == "[DONE]":
                break
            try:
                chunk = json.loads(data_str)
            except json.JSONDecodeError:
                continue
            for choice in chunk.get("choices") or []:
                piece = (choice.get("delta") or {}).get("content")
                if piece:
                    content_parts.append(piece)
                    if on_delta is not None:
                        try:
                            on_delta(piece)
                        except Exception:  # pragma: no cover - defensive
                            pass
            if chunk.get("usage"):
                usage = chunk["usage"]
    finally:
        resp.close()

    content = "".join(content_parts)
    if not content:
        raise AgentError("Empty streamed response from model")

    parsed = extract_json(content)
    return LLMResult(parsed=parsed, raw=content, usage=usage, elapsed_seconds=time.monotonic() - started)


def log_attempt_failure(attempt: int, attempts: int, err: Exception) -> None:
    # Imported lazily so this module stays usable in unit tests without the
    # logging side-effect of importing backend.app.
    import logging
    logging.getLogger("omni-loop").warning(
        "upstream attempt %d/%d failed: %s", attempt, attempts, err
    )


def merge_usage(total: dict, usage: dict) -> dict:
    for k in ("prompt_tokens", "completion_tokens", "total_tokens"):
        total[k] = total.get(k, 0) + (usage.get(k, 0) or 0)
    return total
