# Changelog

## 1.1.0 — Parallel swarm + production hardening

### Added
- **Parallel swarm pipeline** (`/api/swarm`, `backend/swarm.py`):
  - N candidate agents run in parallel via `ThreadPoolExecutor`, each with a distinct "personality" (production, performance, security, …) so they don't all converge.
  - An **arbiter** LLM call picks the winner with confidence + reasoning. Invalid winner ids fall back to the first candidate.
  - Optional **round-robin remediation**: every losing candidate sees the winner's output and the arbiter's reasoning, rewrites itself, then the arbiter runs again.
  - **Server-Sent Events** progress stream at `/api/swarm/<id>/events` (`step` / `done` / `error`).
  - **`/api/swarm/demo`** — deterministic, task-aware demo that runs without an API key.
- **New React frontend** (`frontend/src/components/swarm/`):
  - 3-way mode toggle (Single / Swarm / Arbiter).
  - Live agent status row that highlights the most recent SSE build event.
  - Expandable candidate cards with quality, score, model, iteration count, and full evidence.
  - Arbiter panel showing the winner + confidence + reasoning.
  - Final production output with Copy + Download.
  - History drawer (last 20 runs) with one-click restore.
  - Settings drawer (agent count, model, iterations, round-robin toggle, API key, base URL).
  - Error boundary.
  - Reduced-motion support.
- 16 new pytest cases — total now 47.

### Backend hardening (from 1.0.0)
- All tunables env-driven. See `.env.example`.
- Per-agent `temperature` and `max_tokens`; reviewer runs cold.
- Required-fields validation on every agent's JSON response.
- Resilient JSON parser: fences, balanced braces, trailing-comma / single-quote repair.
- Retry on transient 5xx / timeouts with exponential backoff.
- `MAX_REQUEST_BYTES` cap with a clean 413.
- `GET /api/health` returns version + cap.
- Optional `stream: true` for the sequential endpoint.
- CORS env-configurable; default `*` for local dev.
- Sequential demo is now task-aware.
- `debug=True` gone; controlled by `FLASK_DEBUG`.

### Frontend hardening (from 1.0.0)
- Split the monolith into `components/`, `hooks/`, `lib/`, `data/`, `styles/`.
- Real CSS with design tokens, no inline-style monolith.
- Mobile-responsive, accessible, `prefers-reduced-motion` honored.
- Settings (API key, model, base URL) persist via `localStorage` (only on actual change, not on mount).
- History persisted.
- ⌘/Ctrl+Enter submits.
- Error boundary catches render bugs.

### Repo
- `Dockerfile` + `docker-compose.yml` for one-command backend.
- `Makefile` with the common targets.
- `ARCHITECTURE.md` for contributors.
- Pinned versions everywhere.

## 1.0.0 — Original release
- Sequential pipeline: Builder → Reviewer → Remediation → Re-review → Master Reviewer.
- Flask + React + Vite + framer-motion.
- DEMO and LIVE modes.
