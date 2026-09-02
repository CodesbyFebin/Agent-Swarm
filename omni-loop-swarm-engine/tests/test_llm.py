"""Tests for the HTTP boundary in llm.py: retry, 429/Retry-After handling,
malformed-JSON retry, and the require_api_key anonymous-call path.

These mock `requests.post` directly (unlike the other test files, which
patch call_llm/_do_call at a higher layer) since this is the one module that
actually exercises that retry loop.
"""
from __future__ import annotations

import json
from unittest.mock import patch

import pytest
import requests

from unittest.mock import Mock

from backend.llm import AgentError, JSONFieldStreamExtractor, call_llm, stream_llm


def _resp(status_code, json_body=None, text="", headers=None):
    r = requests.Response()
    r.status_code = status_code
    r._content = json.dumps(json_body).encode() if json_body is not None else text.encode()
    r.headers.update(headers or {})
    return r


def _ok_body(parsed=None):
    return {
        "choices": [{"message": {"content": json.dumps(parsed or {"solution": "s", "evidence": "e"})}}],
        "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
    }


def test_success_first_try_no_key_required():
    with patch("backend.llm.requests.post", return_value=_resp(200, _ok_body())) as mock_post:
        result = call_llm(
            api_key="", model="m", base_url="http://x", system="s", user="u",
            temperature=0.1, max_tokens=10, require_api_key=False,
        )
    assert result.parsed == {"solution": "s", "evidence": "e"}
    # Anonymous call: no Authorization header sent.
    assert "Authorization" not in mock_post.call_args.kwargs["headers"]


def test_require_api_key_raises_before_any_request():
    with patch("backend.llm.requests.post") as mock_post:
        with pytest.raises(AgentError, match="API key is required"):
            call_llm(
                api_key="", model="m", base_url="http://x", system="s", user="u",
                temperature=0.1, max_tokens=10, require_api_key=True,
            )
    mock_post.assert_not_called()


def test_api_key_sent_when_present():
    with patch("backend.llm.requests.post", return_value=_resp(200, _ok_body())) as mock_post:
        call_llm(
            api_key="secret", model="m", base_url="http://x", system="s", user="u",
            temperature=0.1, max_tokens=10,
        )
    assert mock_post.call_args.kwargs["headers"]["Authorization"] == "Bearer secret"


def test_429_retries_then_succeeds():
    responses = [_resp(429, text='{"error":"rate limited"}'), _resp(200, _ok_body())]
    with patch("backend.llm.requests.post", side_effect=responses), \
         patch("backend.llm.time.sleep") as mock_sleep:
        result = call_llm(
            api_key="k", model="m", base_url="http://x", system="s", user="u",
            temperature=0.1, max_tokens=10,
        )
    assert result.parsed == {"solution": "s", "evidence": "e"}
    mock_sleep.assert_called()  # backoff was applied


def test_429_honors_retry_after_header():
    responses = [
        _resp(429, text="rate limited", headers={"Retry-After": "2"}),
        _resp(200, _ok_body()),
    ]
    with patch("backend.llm.requests.post", side_effect=responses), \
         patch("backend.llm.time.sleep") as mock_sleep:
        call_llm(
            api_key="k", model="m", base_url="http://x", system="s", user="u",
            temperature=0.1, max_tokens=10,
        )
    mock_sleep.assert_called_once_with(2.0)


def test_retry_after_is_capped():
    responses = [
        _resp(429, text="rate limited", headers={"Retry-After": "9999"}),
        _resp(200, _ok_body()),
    ]
    with patch("backend.llm.requests.post", side_effect=responses), \
         patch("backend.llm.time.sleep") as mock_sleep:
        call_llm(
            api_key="k", model="m", base_url="http://x", system="s", user="u",
            temperature=0.1, max_tokens=10,
        )
    mock_sleep.assert_called_once_with(30.0)


def test_429_exhausted_raises_with_status():
    responses = [_resp(429, text="rate limited")] * 5  # more than upstream_retries+1
    with patch("backend.llm.requests.post", side_effect=responses), \
         patch("backend.llm.time.sleep"):
        with pytest.raises(AgentError, match="429"):
            call_llm(
                api_key="k", model="m", base_url="http://x", system="s", user="u",
                temperature=0.1, max_tokens=10,
            )


def test_5xx_retries_then_succeeds():
    responses = [_resp(503, text="down"), _resp(200, _ok_body())]
    with patch("backend.llm.requests.post", side_effect=responses), \
         patch("backend.llm.time.sleep"):
        result = call_llm(
            api_key="k", model="m", base_url="http://x", system="s", user="u",
            temperature=0.1, max_tokens=10,
        )
    assert result.parsed == {"solution": "s", "evidence": "e"}


def test_404_raises_immediately_not_retried():
    with patch("backend.llm.requests.post", return_value=_resp(404, text="not found")) as mock_post:
        with pytest.raises(AgentError, match="404"):
            call_llm(
                api_key="k", model="m", base_url="http://x", system="s", user="u",
                temperature=0.1, max_tokens=10,
            )
    assert mock_post.call_count == 1  # not a transient status -- no retry


def test_malformed_json_retried_then_succeeds():
    bad = {"choices": [{"message": {"content": '{"solution": "truncated...'}}], "usage": {}}
    good = _ok_body()
    with patch("backend.llm.requests.post", side_effect=[_resp(200, bad), _resp(200, good)]), \
         patch("backend.llm.time.sleep"):
        result = call_llm(
            api_key="k", model="m", base_url="http://x", system="s", user="u",
            temperature=0.1, max_tokens=10,
        )
    assert result.parsed == {"solution": "s", "evidence": "e"}


def test_malformed_json_exhausted_raises():
    bad = {"choices": [{"message": {"content": "not json at all"}}], "usage": {}}
    with patch("backend.llm.requests.post", return_value=_resp(200, bad)), \
         patch("backend.llm.time.sleep"):
        with pytest.raises(AgentError, match="Could not parse JSON"):
            call_llm(
                api_key="k", model="m", base_url="http://x", system="s", user="u",
                temperature=0.1, max_tokens=10,
            )


# --------------------------------------------------------------------------- #
# stream_llm -- SSE parsing
# --------------------------------------------------------------------------- #

def _sse_lines(*content_pieces, usage=None):
    """Build the raw SSE `data: {...}` lines an OpenAI-compatible endpoint
    sends for a streamed chat completion, terminated by [DONE]."""
    lines = []
    for piece in content_pieces:
        lines.append(json.dumps({"choices": [{"delta": {"content": piece}}]}))
    if usage is not None:
        lines.append(json.dumps({"choices": [], "usage": usage}))
    lines.append("[DONE]")
    return [f"data: {line}" for line in lines]


def _streaming_resp(status_code, lines=None, text=""):
    resp = Mock()
    resp.status_code = status_code
    resp.text = text
    resp.iter_lines.return_value = lines or []
    return resp


def test_stream_llm_emits_deltas_and_parses_final_json():
    parsed_payload = {"solution": "def f(): pass", "evidence": "done"}
    lines = _sse_lines('{"solution": ', '"def f(): pass", ', '"evidence": "done"}', usage={"total_tokens": 42})
    resp = _streaming_resp(200, lines)

    deltas = []
    with patch("backend.llm.requests.post", return_value=resp) as mock_post:
        result = stream_llm(
            api_key="k", model="m", base_url="http://x", system="s", user="u",
            temperature=0.1, max_tokens=10, on_delta=deltas.append,
        )

    assert mock_post.call_args.kwargs["json"]["stream"] is True
    assert deltas == ['{"solution": ', '"def f(): pass", ', '"evidence": "done"}']
    assert result.parsed == parsed_payload
    assert result.usage == {"total_tokens": 42}
    resp.close.assert_called_once()


def test_stream_llm_works_without_on_delta_callback():
    lines = _sse_lines('{"solution": "s", "evidence": "e"}')
    resp = _streaming_resp(200, lines)
    with patch("backend.llm.requests.post", return_value=resp):
        result = stream_llm(
            api_key="k", model="m", base_url="http://x", system="s", user="u",
            temperature=0.1, max_tokens=10,
        )
    assert result.parsed == {"solution": "s", "evidence": "e"}


def test_stream_llm_on_delta_exception_does_not_break_streaming():
    lines = _sse_lines('{"solution": "s", ', '"evidence": "e"}')
    resp = _streaming_resp(200, lines)

    def bad_on_delta(chunk):
        raise RuntimeError("UI callback blew up")

    with patch("backend.llm.requests.post", return_value=resp):
        result = stream_llm(
            api_key="k", model="m", base_url="http://x", system="s", user="u",
            temperature=0.1, max_tokens=10, on_delta=bad_on_delta,
        )
    assert result.parsed == {"solution": "s", "evidence": "e"}


def test_stream_llm_non_200_raises_immediately():
    resp = _streaming_resp(404, text="model not found")
    with patch("backend.llm.requests.post", return_value=resp):
        with pytest.raises(AgentError, match="404"):
            stream_llm(
                api_key="k", model="m", base_url="http://x", system="s", user="u",
                temperature=0.1, max_tokens=10,
            )


def test_stream_llm_empty_content_raises():
    resp = _streaming_resp(200, ["data: [DONE]"])
    with patch("backend.llm.requests.post", return_value=resp):
        with pytest.raises(AgentError, match="Empty streamed response"):
            stream_llm(
                api_key="k", model="m", base_url="http://x", system="s", user="u",
                temperature=0.1, max_tokens=10,
            )


def test_stream_llm_ignores_malformed_sse_lines():
    lines = ["data: not json at all", *_sse_lines('{"solution": "s", "evidence": "e"}')]
    resp = _streaming_resp(200, lines)
    with patch("backend.llm.requests.post", return_value=resp):
        result = stream_llm(
            api_key="k", model="m", base_url="http://x", system="s", user="u",
            temperature=0.1, max_tokens=10,
        )
    assert result.parsed == {"solution": "s", "evidence": "e"}


def test_stream_llm_no_retry_no_key_check():
    with patch("backend.llm.requests.post") as mock_post:
        with pytest.raises(AgentError, match="API key is required"):
            stream_llm(
                api_key="", model="m", base_url="http://x", system="s", user="u",
                temperature=0.1, max_tokens=10, require_api_key=True,
            )
    mock_post.assert_not_called()


# --------------------------------------------------------------------------- #
# JSONFieldStreamExtractor
# --------------------------------------------------------------------------- #

def test_extractor_pulls_field_across_chunk_boundaries():
    ex = JSONFieldStreamExtractor("reasoning")
    pieces = [
        ex.feed('{"winner": "a", "confidence": 0.5, "reasoning": "Hello '),
        ex.feed("world, "),
        ex.feed('this works."}'),
    ]
    assert pieces == ["Hello ", "world, ", "this works."]
    assert ex.value == "Hello world, this works."


def test_extractor_emits_nothing_before_key_seen():
    ex = JSONFieldStreamExtractor("reasoning")
    assert ex.feed('{"winner": "a", "conf') == ""
    assert ex.feed('idence": 0.5, ') == ""
    assert ex.value == ""


def test_extractor_handles_escaped_quotes_in_value():
    ex = JSONFieldStreamExtractor("reasoning")
    piece = ex.feed(r'{"reasoning": "She said \"hi\" to me."}')
    assert piece == 'She said "hi" to me.'


def test_extractor_stops_at_closing_quote_ignores_trailing_json():
    ex = JSONFieldStreamExtractor("reasoning")
    p1 = ex.feed('{"reasoning": "done"')
    p2 = ex.feed(', "other": "should not leak into value"}')
    assert p1 == "done"
    assert p2 == ""  # already closed -- further feeds are no-ops
    assert ex.value == "done"


def test_extractor_ignores_other_fields_entirely():
    ex = JSONFieldStreamExtractor("reasoning")
    ex.feed('{"winner": "agent-1", "confidence": 0.9}')  # no "reasoning" key at all
    assert ex.value == ""


def test_extractor_key_split_across_chunks():
    """The key marker itself can straddle a chunk boundary."""
    ex = JSONFieldStreamExtractor("reasoning")
    p1 = ex.feed('{"winner": "a", "reaso')
    p2 = ex.feed('ning": "late start"}')
    assert p1 == ""
    assert p2 == "late start"
