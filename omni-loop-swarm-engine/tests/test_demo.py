"""Tests for the demo pipeline — task classification + shape."""
from __future__ import annotations

from backend.demo import classify_task, run_demo_pipeline
from backend.pipeline import to_wire


def test_classify_code():
    assert classify_task("implement a function that sorts a list") == "code"
    assert classify_task("write a python script to parse json") == "code"
    assert classify_task("build a React component for a navbar") == "code"


def test_classify_writing():
    assert classify_task("write a blog post about remote work") == "writing"
    assert classify_task("draft an email to my team") == "writing"


def test_classify_analysis():
    assert classify_task("analyze the risks of this acquisition") == "analysis"
    assert classify_task("compare Postgres and MongoDB") == "analysis"


def test_classify_generic():
    assert classify_task("do the thing") == "generic"


def test_demo_pipeline_zero_loops():
    result = run_demo_pipeline("implement a function to reverse a string", loop_count=0)
    wire = to_wire(result)
    assert wire["builder"]["evidence"]
    assert wire["reviewer"]["decision"] == "PASS"
    assert wire["remediation"]["active"] is False
    assert wire["master_reviewer"]["approval"] == "GRANTED"
    assert wire["loop_count"] == 0
    assert wire["final_output"]
    assert wire["steps"], "step list should be populated"
    assert wire["steps"][0]["role"] == "builder"
    assert wire["steps"][-1]["role"] == "master_reviewer"


def test_demo_pipeline_with_loop():
    result = run_demo_pipeline("build a snake game in python", loop_count=1)
    wire = to_wire(result)
    assert wire["remediation"]["active"] is True
    assert wire["loop_count"] == 1
    # Steps: builder, reviewer, remediation, re-review, master
    roles = [s["role"] for s in wire["steps"]]
    assert roles == ["builder", "reviewer", "remediation", "reviewer", "master_reviewer"]


def test_demo_code_solution_uses_topic():
    result = run_demo_pipeline("implement a function to merge k sorted lists", loop_count=0)
    assert "merge" in result.final_output.lower()
