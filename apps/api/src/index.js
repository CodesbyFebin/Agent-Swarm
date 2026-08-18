import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';
import pg from 'pg';
import { pool, emitEvent, getMissionAggregate } from './db.js';

const app = Fastify({ logger: true });
await app.register(cors, {
  origin: process.env.WEB_ORIGIN?.split(',').map((x) => x.trim()) || true,
  methods: ['GET','POST','OPTIONS']
});

const modeSchema = z.enum(['INSTANT','THINK','AGENT','SWARM','AUTO']);
const createMissionSchema = z.object({
  goal: z.string().trim().min(3).max(10000),
  mode: modeSchema.default('SWARM')
});
const noteSchema = z.object({ note: z.string().max(1000).optional() });

app.get('/health', async () => {
  let db = 'ERROR';
  try { await pool.query('SELECT 1'); db = 'LIVE'; } catch {}
  const qwen = process.env.QWEN_API_KEY && process.env.QWEN_BASE_URL ? 'CONFIGURED' : 'UNAVAILABLE';
  return { service: 'agentswarm-api', status: db === 'LIVE' ? 'LIVE' : 'DEGRADED', database: db, qwen };
});

app.get('/api/missions', async () => {
  const { rows } = await pool.query(`SELECT * FROM missions ORDER BY created_at DESC LIMIT 100`);
  return rows;
});

app.post('/api/missions', async (req, reply) => {
  const parsed = createMissionSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'INVALID_REQUEST', details: parsed.error.flatten() });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO missions (goal, mode, status, provider_status)
       VALUES ($1,$2,'QUEUED','UNKNOWN') RETURNING *`,
      [parsed.data.goal, parsed.data.mode]
    );
    const mission = rows[0];
    await emitEvent(client, { missionId: mission.id, type: 'mission.created', actor: 'operator', payload: { mode: mission.mode, provenance: 'LIVE' } });
    await emitEvent(client, { missionId: mission.id, type: 'mission.queued', payload: { provenance: 'LIVE' } });
    await client.query('COMMIT');
    return reply.code(201).send(await getMissionAggregate(mission.id));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally { client.release(); }
});

app.get('/api/missions/:id', async (req, reply) => {
  const data = await getMissionAggregate(req.params.id);
  if (!data) return reply.code(404).send({ error: 'MISSION_NOT_FOUND' });
  return data;
});

app.post('/api/missions/:id/pause', async (req, reply) => {
  const { rows } = await pool.query(
    `UPDATE missions SET status='PAUSED', updated_at=now()
     WHERE id=$1 AND status IN ('RUNNING','WAITING_APPROVAL') RETURNING *`,
    [req.params.id]
  );
  if (!rows.length) return reply.code(409).send({ error: 'INVALID_STATE_TRANSITION' });
  await emitEvent(pool, { missionId: req.params.id, type: 'mission.paused', actor: 'operator', payload: { provenance: 'LIVE' } });
  return getMissionAggregate(req.params.id);
});

app.post('/api/missions/:id/resume', async (req, reply) => {
  const { rows } = await pool.query(
    `UPDATE missions SET status='RUNNING', updated_at=now()
     WHERE id=$1 AND status='PAUSED' RETURNING *`, [req.params.id]
  );
  if (!rows.length) return reply.code(409).send({ error: 'INVALID_STATE_TRANSITION' });
  await emitEvent(pool, { missionId: req.params.id, type: 'mission.resumed', actor: 'operator', payload: { provenance: 'LIVE' } });
  return getMissionAggregate(req.params.id);
});

app.post('/api/missions/:id/cancel', async (req, reply) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE missions SET status='CANCELLED', updated_at=now(), completed_at=now()
       WHERE id=$1 AND status NOT IN ('COMPLETED','FAILED','CANCELLED') RETURNING *`, [req.params.id]
    );
    if (!rows.length) { await client.query('ROLLBACK'); return reply.code(409).send({ error: 'INVALID_STATE_TRANSITION' }); }
    await client.query(`UPDATE tasks SET status='CANCELLED', completed_at=now() WHERE mission_id=$1 AND status NOT IN ('SUCCEEDED','FAILED','CANCELLED','DEAD_LETTER')`, [req.params.id]);
    await emitEvent(client, { missionId: req.params.id, type: 'mission.cancelled', actor: 'operator', payload: { provenance: 'LIVE' } });
    await client.query('COMMIT');
    return getMissionAggregate(req.params.id);
  } finally { client.release(); }
});

app.get('/api/approvals', async () => {
  const { rows } = await pool.query(`SELECT a.*, t.title AS task_title, t.agent FROM approvals a JOIN tasks t ON t.id=a.task_id ORDER BY a.created_at DESC LIMIT 100`);
  return rows;
});

async function decideApproval(id, status, note) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT * FROM approvals WHERE id=$1 FOR UPDATE`, [id]);
    const ap = rows[0];
    if (!ap || ap.status !== 'PENDING') throw Object.assign(new Error('APPROVAL_NOT_PENDING'), { statusCode: 409 });
    await client.query(`UPDATE approvals SET status=$2, decided_at=now(), decision_note=$3 WHERE id=$1`, [id, status, note || null]);
    if (status === 'APPROVED') {
      await client.query(`UPDATE tasks SET status='READY', progress=0 WHERE id=$1 AND status='WAITING_APPROVAL'`, [ap.task_id]);
      await client.query(`UPDATE missions SET status='RUNNING', updated_at=now() WHERE id=$1 AND status='WAITING_APPROVAL'`, [ap.mission_id]);
    } else {
      await client.query(`UPDATE tasks SET status='FAILED', error='Rejected by operator', progress=0, completed_at=now() WHERE id=$1`, [ap.task_id]);
      await client.query(`UPDATE missions SET status='FAILED', updated_at=now(), completed_at=now() WHERE id=$1`, [ap.mission_id]);
    }
    await emitEvent(client, { missionId: ap.mission_id, taskId: ap.task_id, type: status === 'APPROVED' ? 'approval.granted' : 'approval.rejected', actor: 'operator', payload: { approvalId: id, note: note || null, provenance: 'LIVE' } });
    await client.query('COMMIT');
    return getMissionAggregate(ap.mission_id);
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

app.post('/api/approvals/:id/approve', async (req, reply) => {
  const parsed = noteSchema.safeParse(req.body || {});
  if (!parsed.success) return reply.code(400).send({ error: 'INVALID_REQUEST' });
  try { return await decideApproval(req.params.id, 'APPROVED', parsed.data.note); }
  catch (e) { return reply.code(e.statusCode || 500).send({ error: e.message }); }
});

app.post('/api/approvals/:id/reject', async (req, reply) => {
  const parsed = noteSchema.safeParse(req.body || {});
  if (!parsed.success) return reply.code(400).send({ error: 'INVALID_REQUEST' });
  try { return await decideApproval(req.params.id, 'REJECTED', parsed.data.note); }
  catch (e) { return reply.code(e.statusCode || 500).send({ error: e.message }); }
});

app.get('/api/missions/:id/events', async (req) => {
  const after = Math.max(0, Number(req.query?.after || 0));
  const { rows } = await pool.query(`SELECT * FROM events WHERE mission_id=$1 AND id>$2 ORDER BY id ASC LIMIT 1000`, [req.params.id, after]);
  return rows;
});

app.get('/api/missions/:id/stream', async (req, reply) => {
  const missionId = req.params.id;
  const after = Math.max(0, Number(req.headers['last-event-id'] || req.query?.after || 0));
  reply.hijack();
  const res = reply.raw;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': process.env.WEB_ORIGIN || '*'
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
