# Omni-Loop Swarm Engine

> A multi-agent LLM platform with two pipelines:
> 1. **Sequential closed loop** — Builder → Reviewer → Remediation → Re-review → Master Reviewer (gated, deterministic).
> 2. **Parallel swarm with arbiter** — N candidate agents run in parallel, an arbiter picks the winner, optional round-robin remediation re-ranks the candidates.
>
> Both pipelines hit any OpenAI-compatible endpoint. The frontend ships with a deterministic demo so you can exercise every UI path without an API key.

```
SEQUENTIAL  (single best, gated)
   BUILDER ──► REVIEWER ──(FAIL)──► REMEDIATION ──► REVIEWER ──(FAIL)──► …  (up to N loops)
                  │                                          │
                (PASS)                                       │
                  ▼                                          │
            MASTER REVIEWER ──► GRANTED / DENIED ──► Final

PARALLEL SWARM  (multiple candidates, judged)
   ┌─ Agent 1 ─┐
   ├─ Agent 2 ─┤  ──►  ARBITER  ──► Winner
   ├─ Agent 3 ─┤              ▲
   └─ Agent N ─┘              │
                              └─ round-robin: losers see winner, improve, re-arbiter
```

---

## What you get

```
omni-loop-swarm-engine/
├── backend/
│   ├── app.py            # Flask routes — both pipelines
│   ├── config.py         # env-driven tunables
│   ├── demo.py           # sequential demo
│   ├── swarm_demo.py     # parallel-swarm demo (deterministic)
│   ├── llm.py            # OpenAI-compatible HTTP client + JSON repair
│   ├── pipeline.py       # sequential orchestration
│   ├── swarm.py          # parallel orchestration + arbiter + round-robin
│   ├── prompts.py        # per-agent prompts + required-field validation
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx               # top-level state machine
│       ├── main.jsx
│       ├── components/
│       │   ├── ErrorBoundary.jsx
│       │   └── swarm/            # SwarmHeader, CandidateGrid, ArbiterPanel, ...
│       ├── data/                 # swarmModes, models
│       ├── hooks/                # useSwarmSettings, useSwarmHistory, useSwarmRun
│       ├── lib/                  # api, swarmApi, storage, format
│       └── styles/swarm.css
├── tests/                        # pytest
├── Dockerfile
├── docker-compose.yml
├── Makefile
├── pytest.ini
└── .env.example
```

## Quickstart

### A — pip + npm

```bash
pip install -r backend/requirements.txt
PYTHONPATH=. python -m backend.app          # backend on :5000

cd frontend
npm install
npm run dev                                  # frontend on :5173
```

### B — Docker

```bash
docker compose up --build
```

### C — Make

```bash
make install
make backend        # one terminal
make frontend       # another
```

## Using it

- **DEMO mode** (default if you leave the API key empty): runs a deterministic, task-aware simulated pipeline. No key required. Different task kinds (code, writing, analysis) get different output styles.
- **LIVE mode**: open **Settings**, paste your API key, pick a model, set the base URL. Your key is sent from this browser to your own backend for the one POST that runs the pipeline. It is never written to disk on the server; it is saved only in this browser's `localStorage` so you don't have to retype it.

### Mode toggle (top right)

| Mode | What it does |
| --- | --- |
| **Single** | One agent, direct output. Simplest path. |
| **Swarm** | N parallel agents + round-robin remediation. Each agent sees the task independently. |
| **Arbiter** | Swarm + an impartial LLM judge that picks the winner with confidence + reasoning. |

## API

### Sequential pipeline (legacy)

```http
POST /api/execute
Content-Type: application/json

{ "task": "...", "constraints": "...", "api_key": "...", "model": "...", "base_url": "..." }
```

Returns the full wire payload with `builder`, `reviewer`, `remediation`, `master_reviewer`, `final_output`, `tokens`, etc.

### Parallel swarm

```http
POST /api/swarm
{
  "task": "...",
  "constraints": "...",
  "api_key": "...",
  "model": "...",
  "base_url": "...",
  "mode": "single" | "swarm" | "arbiter",
  "agent_count": 4,
  "iterations": 3,
  "round_robin": true
}

→ 202 Accepted
{ "id": "<run id>", "status_url": "/api/swarm/<id>/events", "result_url": "/api/swarm/<id>/result" }
```

```http
GET /api/swarm/<id>/events     # Server-Sent Events: step / done / error
GET /api/swarm/<id>/result     # 202 while running, 200 with the final payload when done
```

### Demo

```http
POST /api/swarm/demo
{ "task": "...", "mode": "swarm", "agent_count": 4, "round_robin": true }

POST /api/demo                 # sequential demo
{ "task": "..." }
```

### Health

```http
GET /api/health
{ "status": "ok", "version": "1.1.0", "max_remediation_loops": 3 }
```

## Configuration

All backend knobs are env-driven. See [`.env.example`](./.env.example) for the full list. Most useful:

| Variable | Default | What it does |
| --- | --- | --- |
| `MAX_REMEDIATION_LOOPS` | `3` | Sequential loop cap. |
| `REQUEST_TIMEOUT_SECONDS` | `120` | Per-call HTTP timeout. |
| `MAX_REQUEST_BYTES` | `65536` | Request body cap. |
| `*_TEMPERATURE` | `0.1–0.4` | Per-agent sampling temperature. |
| `*_MAX_TOKENS` | `512–2048` | Per-agent output cap. |
| `UPSTREAM_RETRIES` | `2` | Retries on transient 5xx / timeouts. |
| `CORS_ALLOW_ORIGIN` | `*` | Tighten in production. |

## Tests

```bash
pip install -r backend/requirements.txt
PYTHONPATH=. python -m pytest -v
```

Covers JSON extraction, sequential pipeline, parallel swarm + arbiter + round-robin, both demos, and every Flask route.

## Production notes

- Run the backend with a real WSGI server (`gunicorn -w 4 -b 0.0.0.0:5000 backend.app:app`) — never `app.run()` in prod.
- Put a reverse proxy (nginx, Caddy) in front for TLS, request size limits, and SSE buffering config.
- Rate-limit `/api/execute` and `/api/swarm`; each call is multiple upstream LLM requests.
- The frontend is a static bundle — drop `frontend/dist/` behind any CDN.

## License

MIT.
