# AgentSwarm Live API

Base URL in local development: `http://localhost:8787`.

All routes except `/health`, `/auth/signup`, and `/auth/login` require a valid `asw_session` cookie (set automatically by signup/login). Clients must send requests with `credentials: 'include'` (fetch) or `withCredentials: true` (EventSource).

## Health (public)

`GET /health`

Returns actual backend/database/provider/queue configuration state: `{ status, database, qwen, redis }`. `redis` is `UNAVAILABLE` if `REDIS_URL` isn't set, `LIVE` if a real ping succeeded, `ERROR` if configured but unreachable — the worker still functions correctly in all three cases via its Postgres fallback poll, just with higher dispatch latency when Redis is down.

## Auth

- `POST /auth/signup` with `{ "email", "password", "name"?, "organizationName"? }` — creates a user, an `OWNER`-role organization, and a default project. Sets the session cookie. `409 EMAIL_TAKEN` if the email is registered.
- `POST /auth/login` with `{ "email", "password" }` — `401 INVALID_CREDENTIALS` on any failure (no distinction between unknown email / wrong password).
- `POST /auth/logout` — clears the session.
- `GET /me` — current user + organization memberships + projects.

`/auth/signup` and `/auth/login` are rate-limited to 8 requests/minute per IP.

## Organizations / Projects

- `GET /api/organizations` — organizations the caller belongs to, with role.
- `GET /api/projects` — projects across all of the caller's organizations.
- `POST /api/projects` with `{ "organizationId", "name" }` — requires `ADMIN+` role in that org.

## Missions

- `GET /api/missions?projectId=<id>` — omit `projectId` to list across all of the caller's orgs.
- `POST /api/missions` with `{ "goal", "mode", "projectId" }` — requires `MEMBER+` role in the project's org.
- `GET /api/missions/:id`
- `POST /api/missions/:id/pause`
- `POST /api/missions/:id/resume`
- `POST /api/missions/:id/cancel`

Any mission not belonging to one of the caller's organizations returns `404 MISSION_NOT_FOUND` — existence is not leaked to non-members.

## Realtime

- `GET /api/missions/:id/events?after=<eventId>`
- `GET /api/missions/:id/stream?after=<eventId>` — Server-Sent Events with durable backlog replay. Requires the session cookie, so browser clients must construct `EventSource` with `{ withCredentials: true }`.

## Approvals

- `GET /api/approvals` — scoped to the caller's organizations.
- `POST /api/approvals/:id/approve` — requires `OPERATOR+` role in the approval's org.
- `POST /api/approvals/:id/reject` — requires `OPERATOR+` role in the approval's org.

The worker persists all task/model/artifact/verification state in PostgreSQL. Qwen usage fields are stored only when the provider returns them; actual cost remains unknown rather than being fabricated.
