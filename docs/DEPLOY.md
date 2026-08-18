# Deploying the backend (apps/api + apps/worker) to Fly.io

Run every command below from the **repo root** (`~/Desktop/Agent-Swarm`) — the
Dockerfiles are written assuming that build context, since `npm ci` needs
every workspace's `package.json` to match the committed root
`package-lock.json`.

## 1. Install the Fly CLI and sign in

```bash
curl -L https://fly.io/install.sh | sh
fly auth login
```

This opens a browser to sign up/log in — Fly requires a card on file even for
the free allowance, but nothing is charged unless you exceed it.

## 2. Create the two apps (no deploy yet)

```bash
fly apps create agentswarm-api
fly apps create agentswarm-worker
```

If those names are taken, edit the `app = "..."` line in
`apps/api/fly.toml` / `apps/worker/fly.toml` to match whatever name you
actually created.

## 3. Set secrets

Real secrets (never committed to `fly.toml`, which is plaintext):

```bash
fly secrets set --config apps/api/fly.toml    DATABASE_URL="<your Postgres connection string>"
fly secrets set --config apps/worker/fly.toml DATABASE_URL="<your Postgres connection string>"

# Optional — only if/when you have a Qwen key. Without these, missions
# correctly end BLOCKED / provider UNAVAILABLE rather than being simulated.
fly secrets set --config apps/worker/fly.toml QWEN_API_KEY="..." QWEN_BASE_URL="..." QWEN_MODEL="qwen-plus"
```

`REDIS_URL` is deliberately not set. The worker's fallback poll (verified
earlier this session against a real Redis outage) makes Redis a pure latency
optimization, not a requirement — skip it for this deployment.

## 4. Deploy

```bash
fly deploy --config apps/api/fly.toml
fly deploy --config apps/worker/fly.toml
```

## 5. Verify

```bash
curl https://agentswarm-api.fly.dev/health
```

Expect `{"service":"agentswarm-api","status":"LIVE","database":"LIVE","qwen":"UNAVAILABLE","redis":"UNAVAILABLE"}`
(or `qwen:"CONFIGURED"` if you set the Qwen secrets). `redis: UNAVAILABLE` is
correct and expected — it means the truth model is being honest, not that
anything is broken.

## 6. Point the webapp at the real API

`apps/webapp/lib/api.js` falls back to `http://localhost:8787` when
`NEXT_PUBLIC_API_URL` isn't set. Once the API above is live, that fallback
gets updated to the real Fly URL and `apps/webapp` gets redeployed to Vercel
— ask your assistant to do this next, it's a one-file change.

## Migrations

Migrations (`infra/migrations/001_init.sql`, `002_auth.sql`) need to be
applied to whatever Postgres database `DATABASE_URL` points to before the API
will report `database: LIVE`. If the database was provisioned through
Supabase, this is done via the Supabase MCP tools directly against the
project rather than `npm run migrate` (which expects a directly-reachable
`psql`-compatible connection from this machine).
