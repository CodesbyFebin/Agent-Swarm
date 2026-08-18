# AgentSwarm Live API

Base URL in local development: `http://localhost:8787`.

## Health

`GET /health`

Returns actual backend/database/provider configuration state.

## Missions

- `GET /api/missions`
- `POST /api/missions` with `{ "goal": "...", "mode": "SWARM" }`
- `GET /api/missions/:id`
- `POST /api/missions/:id/pause`
- `POST /api/missions/:id/resume`
- `POST /api/missions/:id/cancel`

## Realtime

- `GET /api/missions/:id/events?after=<eventId>`
- `GET /api/missions/:id/stream?after=<eventId>` — Server-Sent Events with durable backlog replay.

## Approvals

- `GET /api/approvals`
- `POST /api/approvals/:id/approve`
- `POST /api/approvals/:id/reject`

The worker persists all task/model/artifact/verification state in PostgreSQL. Qwen usage fields are stored only when the provider returns them; actual cost remains unknown rather than being fabricated.
