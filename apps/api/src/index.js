import 'dotenv/config';
import crypto from 'node:crypto';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import csrf from '@fastify/csrf-protection';
import { z } from 'zod';
import pg from 'pg';
import { pool, emitEvent, getMissionAggregate } from './db.js';
import {
  SESSION_COOKIE, hashPassword, verifyPassword, createSession, destroySession,
  membershipsForUser, requireAuth, hasRole, slugify
} from './auth.js';
import { enqueue, pingRedis, redisConfigured } from './queue.js';

const app = Fastify({ logger: true });
await app.register(cors, {
  origin: process.env.WEB_ORIGIN?.split(',').map((x) => x.trim()) || true,
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true
});
await app.register(cookie);
await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "validator.swagger.io"],
      scriptSrc: ["'self'"],
      connectorSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "same-origin" },
  dnsPrefetchControl: true,
  frameguard: { action: "deny" },
  hidePoweredBy: { setTo: "AgentSwarm 1.0.0" },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssProtection: true,
});
await app.register(csrf);

function setSessionCookie(reply, token, expiresAt) {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: 'lax', path: '/',
    secure: process.env.NODE_ENV === 'production', expires: expiresAt
  });
}
function clearSessionCookie(reply) { reply.clearCookie(SESSION_COOKIE, { path: '/' }); }

async function loadAccessibleMission(req, reply, id) {
  const orgIds = req.memberships.map((m) => m.organization_id);
  const { rows } = await pool.query(`SELECT * FROM missions WHERE id=$1 AND organization_id = ANY($2::uuid[])`, [id, orgIds]);
  if (!rows.length) { reply.code(404).send({ error: 'MISSION_NOT_FOUND' }); return null; }
  return rows[0];
}

// ── Auth ──────────────────────────────────────────────────────────────────

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(200),
  name: z.string().trim().max(120).optional(),
  organizationName: z.string().trim().max(120).optional()
});

app.post('/auth/signup', { config: { rateLimit: { max: 8, timeWindow: '1 minute' } } }, async (req, reply) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'INVALID_REQUEST', details: parsed.error.flatten() });
  const { email, password, name, organizationName } = parsed.data;
  const existing = await pool.query('SELECT id FROM users WHERE lower(email)=lower($1)', [email]);
  if (existing.rows.length) return reply.code(409).send({ error: 'EMAIL_TAKEN' });
  const passwordHash = await hashPassword(password);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = (await client.query(
      `INSERT INTO users (email, password_hash, name) VALUES ($1,$2,$3) RETURNING id, email, name`,
      [email, passwordHash, name || null]
    )).rows[0];
    const orgName = organizationName || `${name || email.split('@')[0]}'s Workspace`;
    const baseSlug = slugify(orgName);
    let org = null;
    for (let attempt = 0; attempt < 5 && !org; attempt++) {
      const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${crypto.randomBytes(3).toString('hex')}`;
      try {
        org = (await client.query(`INSERT INTO organizations (name, slug) VALUES ($1,$2) RETURNING *`, [orgName, candidate])).rows[0];
      } catch (e) { if (e.code !== '23505') throw e; }
    }
    if (!org) throw new Error('ORG_SLUG_ALLOCATION_FAILED');
    await client.query(`INSERT INTO memberships (organization_id, user_id, role) VALUES ($1,$2,'OWNER')`, [org.id, user.id]);
    const project = (await client.query(
      `INSERT INTO projects (organization_id, name, slug) VALUES ($1,'Default','default') RETURNING *`, [org.id]
    )).rows[0];
    await client.query('COMMIT');
    const session = await createSession(user.id);
    setSessionCookie(reply, session.token, session.expiresAt);
    return reply.code(201).send({
      user,
      organizations: [{ organization_id: org.id, role: 'OWNER', organization_name: org.name, organization_slug: org.slug }],
      projects: [project]
    });
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});

const loginSchema = z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(1).max(200) });

app.post('/auth/login', { config: { rateLimit: { max: 8, timeWindow: '1 minute' } } }, async (req, reply) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'INVALID_REQUEST' });
  const { rows } = await pool.query('SELECT id, email, name, password_hash FROM users WHERE lower(email)=lower($1)', [parsed.data.email]);
  const user = rows[0];
  const ok = user ? await verifyPassword(parsed.data.password, user.password_hash) : false;
  if (!ok) return reply.code(401).send({ error: 'INVALID_CREDENTIALS' });
  const session = await createSession(user.id);
  setSessionCookie(reply, session.token, session.expiresAt);
  const organizations = await membershipsForUser(user.id);
  const orgIds = organizations.map((m) => m.organization_id);
  const projects = orgIds.length ? (await pool.query('SELECT * FROM projects WHERE organization_id = ANY($1::uuid[]) ORDER BY name', [orgIds])).rows : [];
  return { user: { id: user.id, email: user.email, name: user.name }, organizations, projects };
});

app.post('/auth/logout', async (req, reply) => {
  await destroySession(req.cookies?.[SESSION_COOKIE]);
  clearSessionCookie(reply);
  return { ok: true };
});

app.get('/me', { preHandler: requireAuth }, async (req) => {
  const orgIds = req.memberships.map((m) => m.organization_id);
  const projects = orgIds.length ? (await pool.query('SELECT * FROM projects WHERE organization_id = ANY($1::uuid[]) ORDER BY name', [orgIds])).rows : [];
  return { user: req.user, organizations: req.memberships, projects };
});

// ── Organizations / Projects ────────────────────────────────────────────

app.get('/api/organizations', { preHandler: requireAuth }, async (req) => req.memberships);

app.get('/api/projects', { preHandler: requireAuth }, async (req) => {
  const orgIds = req.memberships.map((m) => m.organization_id);
  if (!orgIds.length) return [];
  const { rows } = await pool.query('SELECT * FROM projects WHERE organization_id = ANY($1::uuid[]) ORDER BY name', [orgIds]);
  return rows;
});

const createProjectSchema = z.object({ organizationId: z.string().uuid(), name: z.string().trim().min(2).max(120) });

app.post('/api/projects', { preHandler: requireAuth }, async (req, reply) => {
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'INVALID_REQUEST' });
  if (!hasRole(req.memberships, parsed.data.organizationId, 'ADMIN')) return reply.code(403).send({ error: 'INSUFFICIENT_ROLE' });
  const baseSlug = slugify(parsed.data.name);
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${crypto.randomBytes(3).toString('hex')}`;
    try {
      const { rows } = await pool.query('INSERT INTO projects (organization_id, name, slug) VALUES ($1,$2,$3) RETURNING *', [parsed.data.organizationId, parsed.data.name, candidate]);
      return reply.code(201).send(rows[0]);
    } catch (e) { if (e.code !== '23505') throw e; }
  }
  return reply.code(500).send({ error: 'PROJECT_SLUG_ALLOCATION_FAILED' });
});

// ── Health (public) ─────────────────────────────────────────────────────

app.get('/health', async () => {
  let db = 'ERROR';
  try { await pool.query('SELECT 1'); db = 'LIVE'; } catch {}
  const qwen = process.env.QWEN_API_KEY && process.env.QWEN_BASE_URL ? 'CONFIGURED' : 'UNAVAILABLE';
  const redis = redisConfigured() ? ((await pingRedis()) ? 'LIVE' : 'ERROR') : 'UNAVAILABLE';
  return { service: 'agentswarm-api', status: db === 'LIVE' ? 'LIVE' : 'DEGRADED', database: db, qwen, redis };
});

// ── Missions ─────────────────────────────────────────────────────────────

const modeSchema = z.enum(['INSTANT', 'THINK', 'AGENT', 'SWARM', 'AUTO']);
const createMissionSchema = z.object({
  goal: z.string().trim().min(3).max(10000),
  mode: modeSchema.default('SWARM'),
  projectId: z.string().uuid()
});
const noteSchema = z.object({ note: z.string().max(1000).optional() });

app.get('/api/missions', { preHandler: requireAuth }, async (req, reply) => {
  const orgIds = req.memberships.map((m) => m.organization_id);
  const projectId = req.query?.projectId;
  if (projectId) {
    const proj = await pool.query('SELECT organization_id FROM projects WHERE id=$1', [projectId]);
    if (!proj.rows.length || !orgIds.includes(proj.rows[0].organization_id)) return reply.code(404).send({ error: 'PROJECT_NOT_FOUND' });
    const { rows } = await pool.query('SELECT * FROM missions WHERE project_id=$1 ORDER BY created_at DESC LIMIT 100', [projectId]);
    return rows;
  }
  if (!orgIds.length) return [];
  const { rows } = await pool.query('SELECT * FROM missions WHERE organization_id = ANY($1::uuid[]) ORDER BY created_at DESC LIMIT 100', [orgIds]);
  return rows;
});

app.post('/api/missions', { preHandler: requireAuth }, async (req, reply) => {
  const parsed = createMissionSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'INVALID_REQUEST', details: parsed.error.flatten() });
  const proj = await pool.query('SELECT * FROM projects WHERE id=$1', [parsed.data.projectId]);
  if (!proj.rows.length) return reply.code(404).send({ error: 'PROJECT_NOT_FOUND' });
  const project = proj.rows[0];
  if (!hasRole(req.memberships, project.organization_id, 'MEMBER')) return reply.code(403).send({ error: 'INSUFFICIENT_ROLE' });
  const client = await pool.connect();
  let mission;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO missions (goal, mode, status, provider_status, organization_id, project_id, created_by)
       VALUES ($1,$2,'QUEUED','UNKNOWN',$3,$4,$5) RETURNING *`,
      [parsed.data.goal, parsed.data.mode, project.organization_id, project.id, req.user.id]
    );
    mission = rows[0];
    await emitEvent(client, { missionId: mission.id, type: 'mission.created', actor: req.user.email, payload: { mode: mission.mode, provenance: 'LIVE' } });
    await emitEvent(client, { missionId: mission.id, type: 'mission.queued', payload: { provenance: 'LIVE' } });
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally { client.release(); }
  await enqueue('mission', mission.id);
  return reply.code(201).send(await getMissionAggregate(mission.id));
});

app.get('/api/missions/:id', { preHandler: requireAuth }, async (req, reply) => {
  const mission = await loadAccessibleMission(req, reply, req.params.id);
  if (!mission) return;
  return getMissionAggregate(mission.id);
});

app.post('/api/missions/:id/pause', { preHandler: requireAuth }, async (req, reply) => {
  const mission = await loadAccessibleMission(req, reply, req.params.id);
  if (!mission) return;
  if (!['RUNNING', 'WAITING_APPROVAL'].includes(mission.status)) return reply.code(409).send({ error: 'INVALID_STATE_TRANSITION' });
  const { rows } = await pool.query(
    `UPDATE missions SET status='PAUSED', updated_at=now() WHERE id=$1 AND status IN ('RUNNING','WAITING_APPROVAL') RETURNING *`,
    [mission.id]
  );
  if (!rows.length) return reply.code(409).send({ error: 'INVALID_STATE_TRANSITION' });
  await emitEvent(pool, { missionId: mission.id, type: 'mission.paused', actor: req.user.email, payload: { provenance: 'LIVE' } });
  return getMissionAggregate(mission.id);
});

app.post('/api/missions/:id/resume', { preHandler: requireAuth }, async (req, reply) => {
  const mission = await loadAccessibleMission(req, reply, req.params.id);
  if (!mission) return;
  const { rows } = await pool.query(
    `UPDATE missions SET status='RUNNING', updated_at=now() WHERE id=$1 AND status='PAUSED' RETURNING *`, [mission.id]
  );
  if (!rows.length) return reply.code(409).send({ error: 'INVALID_STATE_TRANSITION' });
  await emitEvent(pool, { missionId: mission.id, type: 'mission.resumed', actor: req.user.email, payload: { provenance: 'LIVE' } });
  await enqueue('mission', mission.id);
  return getMissionAggregate(mission.id);
});

app.post('/api/missions/:id/cancel', { preHandler: requireAuth }, async (req, reply) => {
  const mission = await loadAccessibleMission(req, reply, req.params.id);
  if (!mission) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE missions SET status='CANCELLED', updated_at=now(), completed_at=now()
       WHERE id=$1 AND status NOT IN ('COMPLETED','FAILED','CANCELLED') RETURNING *`, [mission.id]
    );
    if (!rows.length) { await client.query('ROLLBACK'); return reply.code(409).send({ error: 'INVALID_STATE_TRANSITION' }); }
    await client.query(`UPDATE tasks SET status='CANCELLED', completed_at=now() WHERE mission_id=$1 AND status NOT IN ('SUCCEEDED','FAILED','CANCELLED','DEAD_LETTER')`, [mission.id]);
    await emitEvent(client, { missionId: mission.id, type: 'mission.cancelled', actor: req.user.email, payload: { provenance: 'LIVE' } });
    await client.query('COMMIT');
    return getMissionAggregate(mission.id);
  } finally { client.release(); }
});

// ── Approvals ────────────────────────────────────────────────────────────

app.get('/api/approvals', { preHandler: requireAuth }, async (req) => {
  const orgIds = req.memberships.map((m) => m.organization_id);
  if (!orgIds.length) return [];
  const { rows } = await pool.query(
    `SELECT a.*, t.title AS task_title, t.agent FROM approvals a
     JOIN tasks t ON t.id=a.task_id
     JOIN missions m ON m.id=a.mission_id
     WHERE m.organization_id = ANY($1::uuid[])
     ORDER BY a.created_at DESC LIMIT 100`,
    [orgIds]
  );
  return rows;
});

async function decideApproval(req, id, status, note) {
  const client = await pool.connect();
  let ap;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT a.*, m.organization_id FROM approvals a JOIN missions m ON m.id=a.mission_id WHERE a.id=$1 FOR UPDATE`,
      [id]
    );
    ap = rows[0];
    const orgIds = req.memberships.map((m) => m.organization_id);
    if (!ap || !orgIds.includes(ap.organization_id)) throw Object.assign(new Error('APPROVAL_NOT_FOUND'), { statusCode: 404 });
    if (!hasRole(req.memberships, ap.organization_id, 'OPERATOR')) throw Object.assign(new Error('INSUFFICIENT_ROLE'), { statusCode: 403 });
    if (ap.status !== 'PENDING') throw Object.assign(new Error('APPROVAL_NOT_PENDING'), { statusCode: 409 });
    await client.query(`UPDATE approvals SET status=$2, decided_at=now(), decision_note=$3 WHERE id=$1`, [id, status, note || null]);
    if (status === 'APPROVED') {
      await client.query(`UPDATE tasks SET status='READY', progress=0 WHERE id=$1 AND status='WAITING_APPROVAL'`, [ap.task_id]);
      await client.query(`UPDATE missions SET status='RUNNING', updated_at=now() WHERE id=$1 AND status='WAITING_APPROVAL'`, [ap.mission_id]);
    } else {
      await client.query(`UPDATE tasks SET status='FAILED', error='Rejected by operator', progress=0, completed_at=now() WHERE id=$1`, [ap.task_id]);
      await client.query(`UPDATE missions SET status='FAILED', updated_at=now(), completed_at=now() WHERE id=$1`, [ap.mission_id]);
    }
    await emitEvent(client, { missionId: ap.mission_id, taskId: ap.task_id, type: status === 'APPROVED' ? 'approval.granted' : 'approval.rejected', actor: req.user.email, payload: { approvalId: id, note: note || null, provenance: 'LIVE' } });
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  if (status === 'APPROVED') await enqueue('task', ap.task_id);
  return getMissionAggregate(ap.mission_id);
}

app.post('/api/approvals/:id/approve', { preHandler: requireAuth }, async (req, reply) => {
  const parsed = noteSchema.safeParse(req.body || {});
  if (!parsed.success) return reply.code(400).send({ error: 'INVALID_REQUEST' });
  try { return await decideApproval(req, req.params.id, 'APPROVED', parsed.data.note); }
  catch (e) { return reply.code(e.statusCode || 500).send({ error: e.message }); }
});

app.post('/api/approvals/:id/reject', { preHandler: requireAuth }, async (req, reply) => {
  const parsed = noteSchema.safeParse(req.body || {});
  if (!parsed.success) return reply.code(400).send({ error: 'INVALID_REQUEST' });
  try { return await decideApproval(req, req.params.id, 'REJECTED', parsed.data.note); }
  catch (e) { return reply.code(e.statusCode || 500).send({ error: e.message }); }
});

// ── Events / Realtime ────────────────────────────────────────────────────

app.get('/api/missions/:id/events', { preHandler: requireAuth }, async (req, reply) => {
  const mission = await loadAccessibleMission(req, reply, req.params.id);
  if (!mission) return;
  const after = Math.max(0, Number(req.query?.after || 0));
  const { rows } = await pool.query(`SELECT * FROM events WHERE mission_id=$1 AND id>$2 ORDER BY id ASC LIMIT 1000`, [mission.id, after]);
  return rows;
});

app.get('/api/missions/:id/stream', { preHandler: requireAuth }, async (req, reply) => {
  const mission = await loadAccessibleMission(req, reply, req.params.id);
  if (!mission) return;
  const missionId = mission.id;
  const after = Math.max(0, Number(req.headers['last-event-id'] || req.query?.after || 0));
  reply.hijack();
  const res = reply.raw;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': process.env.WEB_ORIGIN || '*',
    'Access-Control-Allow-Credentials': 'true'
  });
  const send = (event) => {
    res.write(`id: ${event.id}\n`);
    res.write(`event: runtime\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  const backlog = await pool.query(`SELECT * FROM events WHERE mission_id=$1 AND id>$2 ORDER BY id ASC LIMIT 1000`, [missionId, after]);
  backlog.rows.forEach(send);

  const listener = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await listener.connect();
  await listener.query('LISTEN agentswarm_events');
  const onNotification = async (msg) => {
    try {
      const payload = JSON.parse(msg.payload || '{}');
      if (payload.missionId !== missionId) return;
      const { rows } = await pool.query('SELECT * FROM events WHERE id=$1', [payload.id]);
      if (rows[0]) send(rows[0]);
    } catch {}
  };
  listener.on('notification', onNotification);
  const heartbeat = setInterval(() => res.write(`: heartbeat ${Date.now()}\n\n`), 15000);
  req.raw.on('close', async () => {
    clearInterval(heartbeat);
    listener.off('notification', onNotification);
    try { await listener.end(); } catch {}
  });
});

const port = Number(process.env.API_PORT || 8787);
app.listen({ host: '0.0.0.0', port }).catch((err) => { app.log.error(err); process.exit(1); });
