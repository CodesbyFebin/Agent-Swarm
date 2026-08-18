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
- Docker (for local PostgreSQL + Redis) — or local installs of both; the stack was developed and verified against Homebrew-installed Postgres 17 and Redis 8, no Docker required
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

## Durable dispatch (Redis/BullMQ + Postgres)

Postgres remains the **sole source of mission/task truth** — this was true before Redis existed in this stack and hasn't changed. `FOR UPDATE SKIP LOCKED` is what actually decides which worker process claims a given mission or task; it's safe for any number of concurrent workers by construction.

Redis/BullMQ adds a low-latency **wake-up signal** on top of that, nothing more:

- After a Postgres transaction commits (mission created, task promoted to `READY`, a retry/lease-expiry recovery, an approval granted), the API/worker enqueues a lightweight BullMQ job.
- The worker's `Worker` consumer reacts to jobs by attempting the same claim-and-process logic — the job payload is a *hint*, not an instruction, so a stale, duplicate, or dropped job can never cause duplicate or incorrect execution.
- A slow fallback poll (`WORKER_FALLBACK_POLL_MS`, default 5s) always runs independently of Redis, sweeping for retry-wait tasks, expired leases, and anything the queue missed.
- `enqueue()` is timeout-bounded (1.5s) and never holds an open Postgres client while it runs — verified by actually killing Redis mid-request and confirming the API responds in ~1.6s instead of hanging, and that a mission created during the outage still reaches `BLOCKED`/`COMPLETED`/etc. via the fallback poll alone.
- If `REDIS_URL` is unset, the worker runs in **Postgres-poll-only mode** — same correctness, just higher dispatch latency (up to `WORKER_FALLBACK_POLL_MS`).

This was verified end-to-end, not just written: mission creation during a real Redis outage, worker process killed and restarted mid-backlog (confirmed exactly one `mission.planning_started` event afterward — no duplicate processing), and Redis restarted and confirmed to reconnect automatically without a worker restart.

## Realtime architecture

Every runtime event is inserted into the `events` table. A PostgreSQL trigger sends a `NOTIFY`; the API's SSE endpoint listens and streams matching events to connected clients. Reconnecting clients pass the last event ID and receive missed events from the durable event store.

## Qwen execution

The worker uses the configured Qwen OpenAI-compatible chat-completions endpoint for:

1. mission planning;
2. specialist task execution.

Planner output is parsed and validated with Zod before task records are created. Model output never mutates mission state directly.

## Approval gates

A task can declare `requiresApproval` and a risk level. The worker creates a persisted approval request and stops the task in `WAITING_APPROVAL`. The API is authoritative for approve/reject actions; deciding requires `OPERATOR` role or above in the mission's organization. Approval resumes the task; rejection fails the mission.

## Auth & tenancy

Real, DB-backed authentication — no fabricated "logged in" state:

- Passwords hashed with bcrypt (`bcryptjs`, cost 12). Sessions are opaque random tokens; only a SHA-256 hash of the token is stored in `sessions`, with a 30-day expiry.
- The session token is set as an `httpOnly`, `SameSite=Lax` cookie (`asw_session`) — never exposed to client-side JS, never stored in `localStorage`.
- `POST /auth/signup` creates a `User`, an `Organization` (role `OWNER`), and a default `Project` in one transaction. `POST /auth/login`, `POST /auth/logout`, `GET /me`.
- Every mission belongs to exactly one `organization_id` + `project_id`, set server-side from a membership check — the client can request a project but can never assign a mission to an org it isn't a member of.
- All mission/approval routes require a valid session and verify org membership before returning data; a mission in an org you don't belong to returns `404` (not `403`), so its existence isn't leaked to non-members.
- Roles are `OWNER > ADMIN > OPERATOR > MEMBER > VIEWER`. Creating a mission requires `MEMBER+`; deciding an approval requires `OPERATOR+`; creating a project requires `ADMIN+`.
- `/auth/signup` and `/auth/login` are rate-limited (8/min) via `@fastify/rate-limit`; the rest of the API defaults to 300/min per IP.

This covers the master build prompt's §34 auth requirements and the §55 Gate C / Gate K cross-org-isolation acceptance tests, verified with real signup/login/cross-org-access curl + browser tests (not just written, actually run). Not yet implemented: OAuth providers, password recovery, org invites (multi-member orgs), and CSRF tokens (currently relying on `SameSite=Lax` + credentialed CORS restricted to `WEB_ORIGIN`).

## Verification

When every task succeeds, the mission enters `VERIFYING`. The current real verification gate checks that every succeeded task has a persisted artifact. Only then does the mission become `COMPLETED`.

This is deliberately minimal and truthful; build/typecheck/security tool gates can be added as real tool adapters rather than decorative green checks.

## API

See [`docs/API.md`](docs/API.md).

## Current production boundary

This is a fully wired **mission/API/model/event/artifact MVP with real auth, org/project tenancy, and durable Redis/Postgres dispatch**, not the final enterprise control plane. Before exposing it publicly, still needed: OAuth/SSO, org invites, secret-vault integration (secrets currently come from server `.env` only), tool/MCP gateway, sandboxed task execution, richer verification gates (build/typecheck/security/a11y — today's gate only checks artifact existence), audit ledger, and deployment hardening (CSRF tokens, security headers, production TLS).
