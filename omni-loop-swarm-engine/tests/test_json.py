"""Tests for JSON extraction resilience."""
from __future__ import annotations

import pytest

from backend.llm import AgentError, extract_json


def test_extracts_clean_json():
    out = extract_json('{"solution": "hi", "evidence": "ok"}')
    assert out == {"solution": "hi", "evidence": "ok"}


def test_strips_markdown_fences():
    text = "```json\n{\"solution\": \"x\", \"evidence\": \"y\"}\n```"
    assert extract_json(text) == {"solution": "x", "evidence": "y"}


def test_strips_unlabelled_fences():
    text = "```\n{\"a\": 1}\n```"
    assert extract_json(text) == {"a": 1}


def test_finds_balanced_substring():
    text = 'preamble noise {"solution": "x", "evidence": "y"} trailing noise'
    assert extract_json(text) == {"solution": "x", "evidence": "y"}


def test_handles_nested_objects():
    text = '{"solution": "{\\"k\\": 1}", "evidence": "fine"}'
    assert extract_json(text) == {"solution": '{"k": 1}', "evidence": "fine"}


def test_repairs_trailing_comma():
    text = '{"a": 1, "b": 2,}'
    assert extract_json(text) == {"a": 1, "b": 2}


def test_raises_on_empty():
    with pytest.raises(AgentError):
        extract_json("")


def test_raises_on_garbage():
    with pytest.raises(AgentError):
        extract_json("this is not json at all")


def test_raises_on_unbalanced():
    with pytest.raises(AgentError):
        extract_json('{"a": 1, "b":')


def test_rejects_non_object():
    text = "[1, 2, 3]"
    with pytest.raises(AgentError):
        extract_json(text)
