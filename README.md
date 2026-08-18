# AgentSwarm.in — Live Mission Control

**One goal. A governed swarm. Verified work.**

This branch upgrades the original AgentSwarm demo into a real full-stack execution path:

```text
React Command Centre
        ↓ HTTP / SSE
Fastify Mission API
        ↓
PostgreSQL durable state + event store
        ↓
Worker / Scheduler
        ↓
Qwen Model Studio (OpenAI-compatible API)
        ↓
Task outputs → Artifacts
        ↓
Verification
        ↓
Mission completion
```

There is no client-side timer/random-number mission engine. The frontend renders persisted backend state and receives runtime events over SSE.

## Truth model

- `LIVE` — a request/operation actually succeeded.
- `CONFIGURED` — credentials/configuration exist but a specific operation may not yet have run.
- `UNAVAILABLE` — a required integration is not configured.
- `UNKNOWN` — the upstream system did not provide the value.
- `ERROR` — a real operation failed.

The UI never guesses token usage or cost. If Qwen does not return usage, it is shown as unknown. Actual billing cost is not fabricated.

## Requirements

- Node.js 20+
- Docker (for local PostgreSQL)
- A Qwen / Alibaba Cloud Model Studio API key and OpenAI-compatible base URL for live model execution

## Quick start

```bash
cp .env.example .env
docker compose up -d
npm install
npm run migrate
npm run dev
```

Open `http://localhost:5173`.

### Configure Qwen

Set these server-side values in `.env`:

```bash
QWEN_API_KEY=...
QWEN_BASE_URL=https://<your-workspace-or-region-endpoint>/compatible-mode/v1
QWEN_MODEL=qwen-plus
```

If Qwen is not configured, a new mission is persisted but moves to `BLOCKED` with provider status `UNAVAILABLE`. It is never simulated.

## Services

```text
apps/web      React/Vite Command Centre
apps/api      Fastify REST + SSE API
apps/worker   durable mission planner/executor
infra         PostgreSQL migration
scripts       migration runner
```

## Mission lifecycle

```text
QUEUED
→ PLANNING
→ RUNNING
→ WAITING_APPROVAL (when required)
→ RUNNING
→ VERIFYING
→ COMPLETED
```

Terminal/control states include `PAUSED`, `FAILED`, `CANCELLED`, and `BLOCKED`.

## Task lifecycle

```text
QUEUED
→ READY
→ LEASED
→ RUNNING
→ SUCCEEDED
```

Optional states: `WAITING_APPROVAL`, `RETRY_WAIT`, `FAILED`, `CANCELLED`, `DEAD_LETTER`.

Leases are persisted in PostgreSQL; expired leases are recovered by the worker. Retries are bounded by `MAX_TASK_ATTEMPTS`.

## Realtime architecture

Every runtime event is inserted into the `events` table. A PostgreSQL trigger sends a `NOTIFY`; the API's SSE endpoint listens and streams matching events to connected clients. Reconnecting clients pass the last event ID and receive missed events from the durable event store.

## Qwen execution

The worker uses the configured Qwen OpenAI-compatible chat-completions endpoint for:

1. mission planning;
2. specialist task execution.

Planner output is parsed and validated with Zod before task records are created. Model output never mutates mission state directly.

## Approval gates

A task can declare `requiresApproval` and a risk level. The worker creates a persisted approval request and stops the task in `WAITING_APPROVAL`. The API is authoritative for approve/reject actions. Approval resumes the task; rejection fails the mission.

## Verification

When every task succeeds, the mission enters `VERIFYING`. The current real verification gate checks that every succeeded task has a persisted artifact. Only then does the mission become `COMPLETED`.

This is deliberately minimal and truthful; build/typecheck/security tool gates can be added as real tool adapters rather than decorative green checks.

## API

See [`docs/API.md`](docs/API.md).

## Current production boundary

This is a fully wired **mission/API/model/event/artifact MVP**, not the final enterprise control plane. Before exposing it publicly, add production authentication/tenancy, secret-vault integration, tool/MCP sandbox policies, rate limiting, and deployment hardening.
