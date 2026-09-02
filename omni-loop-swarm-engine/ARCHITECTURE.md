# Architecture

This document is for contributors. The README is for users.

## Two pipelines, one backend, one frontend

```
                        ┌─────────────────────────────────────┐
                        │           React Frontend            │
                        │                                     │
                        │  App.jsx — state machine            │
                        │      │                              │
                        │      ├── SwarmHeader (3-mode toggle)│
                        │      ├── SwarmSettings              │
                        │      ├── InputSection               │
                        │      ├── AgentGrid (live status)    │
                        │      ├── CandidateGrid (results)    │
                        │      ├── ArbiterPanel               │
                        │      ├── FinalSwarmOutput           │
                        │      ├── SwarmHistoryPanel          │
                        │      └── ErrorBoundary              │
                        │                                     │
                        │  hooks/  useSwarmSettings,          │
                        │          useSwarmHistory,           │
                        │          useSwarmRun                │
                        │  lib/    swarmApi (SSE + JSON)      │
                        └────────────────┬────────────────────┘
                                         │ HTTP / SSE
                                         ▼
┌────────────────────────────────────────────────────────────────────┐
│                          Flask Backend                             │
│                                                                    │
│  app.py                                                            │
│      ├── /api/health                                               │
│      ├── /api/demo        → demo.run_demo_pipeline      (seq)      │
│      ├── /api/execute     → pipeline.run_pipeline       (seq)      │
│      ├── /api/swarm       → swarm.start_swarm_run       (par)      │
│      ├── /api/swarm/<id>/events  (SSE)                             │
│      ├── /api/swarm/<id>/result                                    │
│      └── /api/swarm/demo   → swarm_demo.run_demo_swarm  (par)      │
│                                                                    │
│  pipeline.py        sequential: Builder → Reviewer → Rem → Master  │
│  swarm.py           parallel: N candidates → arbiter → (optional)  │
│                              round-robin → re-arbiter              │
│  llm.py             OpenAI-compatible HTTP + JSON repair           │
│  prompts.py         per-agent system+user prompts + validator      │
│  config.py          env-driven settings                            │
└────────────────────────────────────────────────────────────────────┘
```

## Sequential vs parallel — when to use which

**Sequential** (`/api/execute`) is best when:
- You have a single task that needs careful, iterative refinement.
- The cost of one wrong answer is high (e.g. shipping a migration script).
- You want the reviewer to be a hard gate that can fail closed.

**Parallel swarm** (`/api/swarm`) is best when:
- The task has many valid solutions and you want diversity.
- You can afford N× model calls and want a confidence-ranked pick.
- You'd like multiple "personalities" (production, performance, security, …) competing.

You can run both — they share the same `llm.py` and the same prompts module, so adding a new agent flavour only touches `prompts.py` and the relevant pipeline.

## Why the swarm uses Server-Sent Events

The sequential pipeline completes in 3–5 LLM calls and finishes in a few seconds — a single JSON response is fine.

The parallel swarm can be 10+ LLM calls (4 candidates + 1 arbiter + 3 remediations + 1 re-arbiter) and take 30+ seconds. The frontend wants to show the user that *something is happening* — which agents are done, which is in flight, the arbiter's decision. So `/api/swarm` returns 202 with a `run_id` immediately, and the client opens `/api/swarm/<id>/events` for an SSE stream of `step` / `done` / `error` events.

The run registry (`backend/swarm.py:_REGISTRY`) is in-process. For multi-worker production deployment, replace it with Redis or a database.

## Frontend state machine

`useSwarmRun` owns the lifecycle:

```
idle → submitting → running → complete
                   ↘ error
```

- **submitting**: POST `/api/swarm` or `/api/swarm/demo` is in flight.
- **running**: SSE stream is open and we're receiving `step` events. The agent grid highlights the most recent build event as "active" and any earlier builds as "done".
- **complete**: the SSE `done` event arrived; `result` is populated.
- **error**: any failure (validation, network, server). The error message is rendered inline and the button is restored.

The animated phase timer in the header reflects the most recent SSE step name when running.

## Adding a new agent personality

In `backend/swarm.py`:

```python
PERSONALITIES = [
    # existing ones…
    "You are a chaos-testing engineer who tries to break every input. "
    "Bias toward adversarial cases and invalid inputs that other agents miss.",
]
```

That's it. The next build will pick it up via `PERSONALITIES[idx % len(PERSONALITIES)]`.

## Adding a new pipeline

If you need a third pipeline shape (e.g. hierarchical manager → workers):

1. Create `backend/hier.py` exposing `start_hierarchical_run()` and `get_run()` similar to `swarm.py`.
2. Add routes in `app.py` under `/api/hier/*`.
3. Add a parallel module under `frontend/src/components/hier/`.
4. Add tests in `tests/test_hier.py` — the scriptable `FakeEndpoint` pattern in `test_swarm.py` is the template.

## Accessibility

- Skip-link to main content.
- All form fields have associated `<label>` (implicit via `aria-label` on textareas since they're standalone).
- Live region on the agent grid (`aria-label` per agent) so screen readers hear status changes.
- Buttons have visible focus styles and `aria-label` / `aria-pressed` / `aria-expanded` where appropriate.
- `prefers-reduced-motion` disables infinite animations.
- Mobile breakpoint: the input grid collapses to a single column under 880px (via `auto-fit, minmax(...)`).
- The candidate grid uses `role="button"`, `tabIndex={0}`, and Enter/Space activation for keyboard users.
