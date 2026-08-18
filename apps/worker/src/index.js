import 'dotenv/config';
import { z } from 'zod';
import { pool, emitEvent } from './db.js';
import { qwenChat, qwenConfigured } from './qwen.js';
import { enqueue, startQueueWorker, redisConfigured } from './queue.js';

const WORKER_ID = process.env.WORKER_ID || `worker-${process.pid}`;
const FALLBACK_POLL_MS = Number(process.env.WORKER_FALLBACK_POLL_MS || 5000);
const WORKER_CONCURRENCY = Number(process.env.WORKER_CONCURRENCY || 4);
const LEASE_SECONDS = Number(process.env.TASK_LEASE_SECONDS || 90);
const MAX_ATTEMPTS = Number(process.env.MAX_TASK_ATTEMPTS || 3);
const AGENTS = ['planner','researcher','architect','backend','frontend','qa','security','devops'];

const planSchema = z.object({
  tasks: z.array(z.object({
    key: z.string().regex(/^[a-z0-9_-]{2,40}$/),
    title: z.string().min(3).max(160),
    agent: z.enum(AGENTS),
    dependencies: z.array(z.string()).default([]),
    requiresApproval: z.boolean().default(false),
    risk: z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).default('LOW')
  })).min(1).max(12)
}).superRefine((plan, ctx) => {
  const keys = new Set(plan.tasks.map(t => t.key));
  if (keys.size !== plan.tasks.length) ctx.addIssue({ code: 'custom', message: 'Duplicate task key' });
  const byKey = new Map(plan.tasks.map(t => [t.key, t]));
  for (const t of plan.tasks) {
    for (const d of t.dependencies) {
      if (!keys.has(d)) ctx.addIssue({ code: 'custom', message: `Unknown dependency ${d}` });
      if (d === t.key) ctx.addIssue({ code: 'custom', message: `Task ${t.key} cannot depend on itself` });
    }
  }
  const visiting = new Set(), visited = new Set();
  const visit = (key) => {
    if (visiting.has(key)) return true;
    if (visited.has(key)) return false;
    visiting.add(key);
    for (const dep of byKey.get(key)?.dependencies || []) if (visit(dep)) return true;
    visiting.delete(key); visited.add(key); return false;
  };
  for (const key of keys) if (visit(key)) { ctx.addIssue({ code: 'custom', message: 'Task dependency graph contains a cycle' }); break; }
});

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function extractJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('PLANNER_JSON_NOT_FOUND');
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function claimQueuedMission() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT * FROM missions
       WHERE status='QUEUED'
       ORDER BY created_at
       FOR UPDATE SKIP LOCKED LIMIT 1`
    );
    const m = rows[0];
    if (!m) { await client.query('ROLLBACK'); return null; }
    await client.query(`UPDATE missions SET status='PLANNING', provider_status=$2, started_at=COALESCE(started_at,now()), updated_at=now() WHERE id=$1`, [m.id, qwenConfigured() ? 'CONNECTED' : 'UNAVAILABLE']);
    await emitEvent(client, { missionId: m.id, type: 'mission.planning_started', actor: 'planner', payload: { workerId: WORKER_ID, provenance: 'LIVE' } });
    await client.query('COMMIT');
    return m;
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

async function planMission(mission) {
  if (!qwenConfigured()) {
    await pool.query(`UPDATE missions SET status='BLOCKED', provider_status='UNAVAILABLE', provider_error='Qwen is not configured', updated_at=now() WHERE id=$1`, [mission.id]);
    await emitEvent(pool, { missionId: mission.id, type: 'provider.unavailable', actor: 'model-router', payload: { provider: 'qwen', provenance: 'LIVE', reason: 'Missing QWEN_API_KEY/QWEN_BASE_URL/QWEN_MODEL' } });
    return;
  }
  try {
    const result = await qwenChat([
      { role: 'system', content: `You are AgentSwarm's Planner. Return JSON only. Decompose a goal into 3-8 dependency-aware tasks. Allowed agents: ${AGENTS.join(', ')}. Use stable lowercase task keys. Set requiresApproval=true only for consequential external writes/deployment/production changes; risk HIGH or CRITICAL for those. Schema: {"tasks":[{"key":"requirements","title":"...","agent":"planner","dependencies":[],"requiresApproval":false,"risk":"LOW"}]}` },
      { role: 'user', content: mission.goal }
    ]);
    const plan = planSchema.parse(extractJson(result.content));
    const client = await pool.connect();
    const readyTaskIds = [];
    try {
      await client.query('BEGIN');
      for (const t of plan.tasks) {
        const initial = t.dependencies.length === 0 ? 'READY' : 'QUEUED';
        const { rows } = await client.query(
          `INSERT INTO tasks (mission_id, task_key, title, agent, dependencies, requires_approval, risk, status)
           VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8) RETURNING *`,
          [mission.id, t.key, t.title, t.agent, JSON.stringify(t.dependencies), t.requiresApproval, t.risk, initial]
        );
        await emitEvent(client, { missionId: mission.id, taskId: rows[0].id, type: 'task.created', actor: 'planner', payload: { key: t.key, title: t.title, agent: t.agent, dependencies: t.dependencies, provenance: 'LIVE' } });
        if (initial === 'READY') {
          await emitEvent(client, { missionId: mission.id, taskId: rows[0].id, type: 'task.ready', actor: 'scheduler', payload: { provenance: 'LIVE' } });
          readyTaskIds.push(rows[0].id);
        }
      }
      await client.query(`UPDATE missions SET status='RUNNING', provider_status='LIVE', updated_at=now() WHERE id=$1`, [mission.id]);
      await emitEvent(client, { missionId: mission.id, type: 'mission.planned', actor: 'planner', payload: { taskCount: plan.tasks.length, provider: result.provider, model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens, latencyMs: result.latencyMs, provenance: 'LIVE' } });
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    for (const id of readyTaskIds) await enqueue('task', id);
  } catch (e) {
    await pool.query(`UPDATE missions SET status='FAILED', provider_status='ERROR', provider_error=$2, completed_at=now(), updated_at=now() WHERE id=$1`, [mission.id, e.message]);
    await emitEvent(pool, { missionId: mission.id, type: 'mission.failed', actor: 'planner', payload: { error: e.message, provenance: 'LIVE' } });
  }
}

async function recoverRetries() {
  const { rows } = await pool.query(
    `UPDATE tasks SET status='READY', retry_at=NULL
     WHERE status='RETRY_WAIT' AND retry_at IS NOT NULL AND retry_at <= now()
     RETURNING *`
  );
  for (const t of rows) {
    await emitEvent(pool, { missionId: t.mission_id, taskId: t.id, type: 'task.ready', actor: 'scheduler', payload: { retry: true, provenance: 'LIVE' } });
    await enqueue('task', t.id);
  }
}

async function recoverExpiredLeases() {
  const { rows } = await pool.query(
    `UPDATE tasks SET status=CASE WHEN attempt_count >= $1 THEN 'DEAD_LETTER' ELSE 'READY' END,
       lease_owner=NULL, leased_until=NULL, error=COALESCE(error,'Lease expired')
     WHERE status IN ('LEASED','RUNNING') AND leased_until < now()
     RETURNING *`, [MAX_ATTEMPTS]
  );
  for (const t of rows) {
    await emitEvent(pool, { missionId: t.mission_id, taskId: t.id, type: t.status === 'DEAD_LETTER' ? 'task.dead_letter' : 'task.lease_expired', actor: 'scheduler', payload: { attemptCount: t.attempt_count, provenance: 'LIVE' } });
    if (t.status === 'READY') await enqueue('task', t.id);
  }
}

async function claimTask() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT t.* FROM tasks t
       JOIN missions m ON m.id=t.mission_id
       WHERE t.status='READY' AND m.status='RUNNING'
       ORDER BY t.created_at
       FOR UPDATE OF t SKIP LOCKED LIMIT 1`
    );
    const t = rows[0];
    if (!t) { await client.query('ROLLBACK'); return null; }
    if (t.requires_approval) {
      const ap = await client.query(`SELECT * FROM approvals WHERE task_id=$1 AND status IN ('PENDING','APPROVED') ORDER BY created_at DESC LIMIT 1`, [t.id]);
      if (!ap.rows[0]) {
        const created = await client.query(
          `INSERT INTO approvals (mission_id, task_id, risk, title, description)
           VALUES ($1,$2,$3,$4,$5) RETURNING *`,
          [t.mission_id, t.id, t.risk, `Approve: ${t.title}`, `Agent ${t.agent} is requesting permission to execute a consequential task.`]
        );
        await client.query(`UPDATE tasks SET status='WAITING_APPROVAL' WHERE id=$1`, [t.id]);
        await client.query(`UPDATE missions SET status='WAITING_APPROVAL', updated_at=now() WHERE id=$1`, [t.mission_id]);
        await emitEvent(client, { missionId: t.mission_id, taskId: t.id, type: 'approval.requested', actor: t.agent, payload: { approvalId: created.rows[0].id, risk: t.risk, provenance: 'LIVE' } });
        await client.query('COMMIT');
        return null;
      }
      if (ap.rows[0].status !== 'APPROVED') { await client.query('ROLLBACK'); return null; }
    }
    const claimed = await client.query(
      `UPDATE tasks SET status='LEASED', progress=25, lease_owner=$2,
       leased_until=now()+($3 || ' seconds')::interval, attempt_count=attempt_count+1
       WHERE id=$1 RETURNING *`,
      [t.id, WORKER_ID, LEASE_SECONDS]
    );
    await emitEvent(client, { missionId: t.mission_id, taskId: t.id, type: 'task.leased', actor: 'scheduler', payload: { workerId: WORKER_ID, attempt: claimed.rows[0].attempt_count, provenance: 'LIVE' } });
    await client.query('COMMIT');
    return claimed.rows[0];
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

async function dependencyContext(task) {
  const deps = Array.isArray(task.dependencies) ? task.dependencies : JSON.parse(task.dependencies || '[]');
  if (!deps.length) return '';
  const { rows } = await pool.query(`SELECT task_key,title,output_text FROM tasks WHERE mission_id=$1 AND task_key = ANY($2::text[]) ORDER BY created_at`, [task.mission_id, deps]);
  return rows.map(r => `Dependency ${r.task_key} — ${r.title}:\n${r.output_text || '[no output]'}`).join('\n\n');
}

async function executeTask(task) {
  const missionQ = await pool.query('SELECT * FROM missions WHERE id=$1', [task.mission_id]);
  const mission = missionQ.rows[0];
  if (!mission || mission.status !== 'RUNNING') return;
  await pool.query(`UPDATE tasks SET status='RUNNING', progress=50, started_at=COALESCE(started_at,now()), leased_until=now()+($2 || ' seconds')::interval WHERE id=$1`, [task.id, LEASE_SECONDS]);
  await emitEvent(pool, { missionId: task.mission_id, taskId: task.id, type: 'task.started', actor: task.agent, payload: { workerId: WORKER_ID, provenance: 'LIVE' } });
  await emitEvent(pool, { missionId: task.mission_id, taskId: task.id, type: 'model.started', actor: task.agent, payload: { provider: 'qwen', model: process.env.QWEN_MODEL, provenance: 'LIVE' } });
  try {
    const deps = await dependencyContext(task);
    const result = await qwenChat([
      { role: 'system', content: `You are the ${task.agent} specialist inside AgentSwarm. Execute only the assigned task. Be precise, produce a useful artifact, and clearly state uncertainty. Do not claim external side effects you did not perform.` },
      { role: 'user', content: `Mission goal:\n${mission.goal}\n\nAssigned task:\n${task.title}\n\n${deps ? `Dependency outputs:\n${deps}` : ''}` }
    ]);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const missionState = await client.query(`SELECT status FROM missions WHERE id=$1 FOR UPDATE`, [task.mission_id]);
      if (missionState.rows[0]?.status === 'CANCELLED') {
        await client.query(`UPDATE tasks SET status='CANCELLED', progress=0, lease_owner=NULL, leased_until=NULL, completed_at=now() WHERE id=$1`, [task.id]);
        await emitEvent(client, { missionId: task.mission_id, taskId: task.id, type: 'task.cancelled', actor: task.agent, payload: { reason: 'Mission cancelled while model call was in flight', provenance: 'LIVE' } });
        await client.query('COMMIT');
        return;
      }
      await client.query(
        `UPDATE tasks SET status='SUCCEEDED', progress=100, provider=$2, model=$3,
         input_tokens=$4, output_tokens=$5, output_text=$6, error=NULL,
         lease_owner=NULL, leased_until=NULL, completed_at=now()
         WHERE id=$1`,
        [task.id, result.provider, result.model, result.inputTokens, result.outputTokens, result.content]
      );
      const artifact = await client.query(
        `INSERT INTO artifacts (mission_id, task_id, name, kind, content)
         VALUES ($1,$2,$3,'agent_output',$4) RETURNING *`,
        [task.mission_id, task.id, `${task.task_key}.md`, result.content]
      );
      await emitEvent(client, { missionId: task.mission_id, taskId: task.id, type: 'model.completed', actor: task.agent, payload: { provider: result.provider, model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens, latencyMs: result.latencyMs, requestId: result.requestId, provenance: 'LIVE' } });
      await emitEvent(client, { missionId: task.mission_id, taskId: task.id, type: 'artifact.created', actor: task.agent, payload: { artifactId: artifact.rows[0].id, name: artifact.rows[0].name, provenance: 'LIVE' } });
      await emitEvent(client, { missionId: task.mission_id, taskId: task.id, type: 'task.completed', actor: task.agent, payload: { provenance: 'LIVE' } });
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    await promoteReady(task.mission_id);
    await maybeFinishMission(task.mission_id);
  } catch (e) {
    const { rows } = await pool.query('SELECT attempt_count FROM tasks WHERE id=$1', [task.id]);
    const attempts = rows[0]?.attempt_count || task.attempt_count || 1;
    const terminal = attempts >= MAX_ATTEMPTS;
    await pool.query(
      `UPDATE tasks SET status=$2, progress=0, error=$3, lease_owner=NULL, leased_until=NULL,
       completed_at=CASE WHEN $2 IN ('FAILED','DEAD_LETTER') THEN now() ELSE NULL END
       WHERE id=$1`,
      [task.id, terminal ? 'DEAD_LETTER' : 'RETRY_WAIT', e.message]
    );
    if (!terminal) {
      const delaySeconds = Math.min(30, 2 ** attempts);
      await pool.query(`UPDATE tasks SET retry_at=now()+($2 || ' seconds')::interval WHERE id=$1`, [task.id, delaySeconds]);
    }
    await emitEvent(pool, { missionId: task.mission_id, taskId: task.id, type: terminal ? 'task.dead_letter' : 'task.retry_wait', actor: task.agent, payload: { error: e.message, attempt: attempts, provenance: 'LIVE' } });
    if (terminal) {
      await pool.query(`UPDATE missions SET status='FAILED', completed_at=now(), updated_at=now() WHERE id=$1 AND status NOT IN ('CANCELLED','COMPLETED')`, [task.mission_id]);
      await emitEvent(pool, { missionId: task.mission_id, type: 'mission.failed', actor: 'orchestrator', payload: { reason: 'Task entered dead letter', taskId: task.id, provenance: 'LIVE' } });
    }
  }
}

async function promoteReady(missionId) {
  const { rows } = await pool.query(`SELECT id, task_key, dependencies, status FROM tasks WHERE mission_id=$1`, [missionId]);
  const succeeded = new Set(rows.filter(r => r.status === 'SUCCEEDED').map(r => r.task_key));
  const readyIds = [];
  for (const t of rows.filter(r => r.status === 'QUEUED')) {
    const deps = Array.isArray(t.dependencies) ? t.dependencies : JSON.parse(t.dependencies || '[]');
    if (deps.every(d => succeeded.has(d))) {
      await pool.query(`UPDATE tasks SET status='READY' WHERE id=$1 AND status='QUEUED'`, [t.id]);
      await emitEvent(pool, { missionId, taskId: t.id, type: 'task.ready', actor: 'scheduler', payload: { provenance: 'LIVE' } });
      readyIds.push(t.id);
    }
  }
  const summary = await pool.query(`SELECT count(*)::int total, count(*) FILTER (WHERE status='SUCCEEDED')::int succeeded FROM tasks WHERE mission_id=$1`, [missionId]);
  const { total, succeeded: done } = summary.rows[0];
  await pool.query(`UPDATE missions SET progress=$2, updated_at=now() WHERE id=$1`, [missionId, total ? Math.round((done / total) * 100) : 0]);
  for (const id of readyIds) await enqueue('task', id);
}

async function maybeFinishMission(missionId) {
  const { rows } = await pool.query(`SELECT count(*)::int total, count(*) FILTER (WHERE status='SUCCEEDED')::int succeeded, count(*) FILTER (WHERE status IN ('FAILED','DEAD_LETTER'))::int failed FROM tasks WHERE mission_id=$1`, [missionId]);
  const s = rows[0];
  if (!s.total || s.succeeded !== s.total) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE missions SET status='VERIFYING', progress=100, updated_at=now() WHERE id=$1`, [missionId]);
    await emitEvent(client, { missionId, type: 'verification.started', actor: 'verifier', payload: { provenance: 'LIVE' } });
    const artifacts = await client.query(`SELECT count(*)::int count FROM artifacts WHERE mission_id=$1`, [missionId]);
    const passed = artifacts.rows[0].count >= s.total;
    const vr = await client.query(`INSERT INTO verification_runs (mission_id,status,summary,completed_at) VALUES ($1,$2,$3,now()) RETURNING *`, [missionId, passed ? 'PASSED' : 'FAILED', passed ? 'Every succeeded task has a persisted artifact.' : 'Artifact count does not match succeeded task count.']);
    await emitEvent(client, { missionId, type: passed ? 'verification.passed' : 'verification.failed', actor: 'verifier', payload: { verificationId: vr.rows[0].id, summary: vr.rows[0].summary, provenance: 'LIVE' } });
    await client.query(`UPDATE missions SET status=$2, completed_at=now(), updated_at=now() WHERE id=$1`, [missionId, passed ? 'COMPLETED' : 'FAILED']);
    await emitEvent(client, { missionId, type: passed ? 'mission.completed' : 'mission.failed', actor: 'orchestrator', payload: { provenance: 'LIVE' } });
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

/** One unit of dispatchable work: claim+plan a mission, or claim+execute a task. */
async function tryClaimAndProcessOne() {
  const mission = await claimQueuedMission();
  if (mission) { await planMission(mission); return true; }
  const task = await claimTask();
  if (task) { await executeTask(task); return true; }
  return false;
}

async function drainAvailableWork(maxIterations = 50) {
  for (let i = 0; i < maxIterations; i++) {
    const did = await tryClaimAndProcessOne();
    if (!did) break;
  }
}

async function main() {
  const queueMode = redisConfigured();
  console.log(`[AgentSwarm worker] ${WORKER_ID} started; Qwen=${qwenConfigured() ? 'CONFIGURED' : 'UNAVAILABLE'}; dispatch=${queueMode ? 'BullMQ+Postgres-fallback' : 'Postgres-poll-only'}`);

  // BullMQ is a low-latency wake-up signal only. Postgres FOR UPDATE SKIP LOCKED
  // remains the sole authority on which worker claims a given mission/task, so
  // this is safe to run concurrently with the fallback poll below without any
  // risk of duplicate execution.
  startQueueWorker(tryClaimAndProcessOne, {
    concurrency: WORKER_CONCURRENCY,
    onError: (err) => console.error('[worker] queue error', err)
  });

  // Fallback sweep — always runs, queue or no queue. Recovers retry-wait tasks
  // and expired leases (not queue-triggered events), and drains any work the
  // queue missed (Redis down at enqueue time, Redis restart, or REDIS_URL
  // unset entirely, in which case this is the only dispatch path).
  for (;;) {
    try {
      await recoverRetries();
      await recoverExpiredLeases();
      await drainAvailableWork();
    } catch (e) { console.error('[worker]', e); }
    await sleep(FALLBACK_POLL_MS);
  }
}

main();
