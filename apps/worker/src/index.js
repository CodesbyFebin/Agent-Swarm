import 'dotenv/config';
import { z } from 'zod';
import { pool, emitEvent } from './db.js';
import { qwenChat, qwenConfigured } from './qwen.js';
import { enqueue, startQueueWorker, redisConfigured } from './queue.js';
import { evidenceLedger } from './evidence.js';
import { modelRouter, initDefaultModels } from './models.js';
import { scheduler } from './scheduler.js';
import { executeTool, listTools } from './tools/index.js';

const WORKER_ID = process.env.WORKER_ID || `worker-${process.pid}`;
const FALLBACK_POLL_MS = Number(process.env.WORKER_FALLBACK_POLL_MS || 5000);
const WORKER_CONCURRENCY = Number(process.env.WORKER_CONCURRENCY || 4);
const LEASE_SECONDS = Number(process.env.TASK_LEASE_SECONDS || 90);
const MAX_ATTEMPTS = Number(process.env.MAX_TASK_ATTEMPTS || 3);
const AGENTS = ['planner','researcher','architect','backend','frontend','qa','security','devops'];

// Enhanced plan schema with tool requirements
const planSchema = z.object({
  tasks: z.array(z.object({
    key: z.string().regex(/^[a-z0-9_-]{2,40}$/),
    title: z.string().min(3).max(160),
    agent: z.enum([...AGENTS, 'developer', 'qa', 'security']),
    dependencies: z.array(z.string()).default([]),
    requiresApproval: z.boolean().default(false),
    risk: z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).default('LOW'),
    toolRequirements: z.array(z.string()).default([]),
    requiredCapabilities: z.array(z.string()).default([])
  })).min(1).max(15)
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
});

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function extractJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('PLANNER_JSON_NOT_FOUND');
  return JSON.parse(cleaned.slice(start, end + 1));
}

// Enhanced mission planning with tool integration
async function planMission(mission) {
  if (!qwenConfigured()) {
    await pool.query(`UPDATE missions SET status='BLOCKED', provider_status='UNAVAILABLE', provider_error='Qwen is not configured', updated_at=now() WHERE id=$1`, [mission.id]);
    await emitEvent(pool, { missionId: mission.id, type: 'provider.unavailable', actor: 'planner', payload: { provider: 'qwen', provenance: 'LIVE' } });
    return;
  }

  try {
    // Get model router for planning
    const router = await modelRouter;
    
    // Build context for planning
    const projectContext = await pool.query(
      `SELECT p.name, p.slug, o.name as org_name 
       FROM projects p 
       JOIN organizations o ON p.organization_id = o.id 
       WHERE p.id = $1`, [mission.project_id]
    );
    
    const context = projectContext.rows[0] || {};
    
    const result = await qwenChat([
      { role: 'system', content: `You are AgentSwarm's Planner. Return JSON only. Decompose a goal into 1-3 dependency-aware tasks. Include required capabilities and tools. Allowed agents: ${AGENTS.join(', ')}. Use stable lowercase task keys. Set requiresApproval=true only for file writes, DB changes, or deployments. Risk HIGH for shell/DB/file operations, LOW for read-only operations.` },
      { role: 'user', content: `Mission: ${mission.goal}\n\nProject: ${context.name || 'Unknown'}\nOrganization: ${context.org_name || 'Unknown'}\nMode: ${mission.mode}\n\nGenerate a task plan with tool requirements.` }
    ]);
    
    const plan = planSchema.parse(extractJson(result.content));
    
    const client = await pool.connect();
    const readyTaskIds = [];
    
    try {
      await client.query('BEGIN');
      
      for (const t of plan.tasks) {
        const initial = t.dependencies.length === 0 ? 'READY' : 'QUEUED';
        
        const { rows } = await client.query(
          `INSERT INTO tasks (mission_id, task_key, title, agent, dependencies, requires_approval, risk, status, required_capabilities)
           VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9) RETURNING *`,
          [mission.id, t.key, t.title, t.agent, JSON.stringify(t.dependencies || []), 
           t.requiresApproval, t.risk, initial, JSON.stringify(t.requiredCapabilities || [])]
        );
        
        // Create tool requirements as evidence
        if (t.toolRequirements && t.toolRequirements.length > 0) {
          await evidenceLedger.createFileEvidence(rows[0].id, 'TOOL_REQUIREMENTS', 'CREATE', {
            tools: t.toolRequirements,
            capabilities: t.requiredCapabilities
          });
        }
        
        await emitEvent(client, { missionId: mission.id, taskId: rows[0].id, type: 'task.created', actor: 'planner', payload: { key: t.key, title: t.title, agent: t.agent, toolRequirements: t.toolRequirements, provenance: 'LIVE' } });
        
        if (initial === 'READY') {
          await emitEvent(client, { missionId: mission.id, taskId: rows[0].id, type: 'task.ready', actor: 'scheduler', payload: { provenance: 'LIVE' } });
          readyTaskIds.push(rows[0].id);
        }
      }
      
      await client.query(`UPDATE missions SET status='RUNNING', provider_status='LIVE', updated_at=now() WHERE id=$1`, [mission.id]);
      await emitEvent(client, { missionId: mission.id, type: 'mission.planned', actor: 'planner', payload: { taskCount: plan.tasks.length, provider: result.provider, model: result.model, provenance: 'LIVE' } });
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    
    for (const id of readyTaskIds) await enqueue('task', id);
    
    return plan;
  } catch (e) {
    await pool.query(`UPDATE missions SET status='FAILED', provider_status='ERROR', provider_error=$2, completed_at=now(), updated_at=now() WHERE id=$1`, [mission.id, e.message]);
    await emitEvent(pool, { missionId: mission.id, type: 'mission.failed', actor: 'planner', payload: { error: e.message, provenance: 'LIVE' } });
    throw e;
  }
}

// Enhanced task execution with tool integration
async function executeTask(task) {
  const missionQ = await pool.query('SELECT * FROM missions WHERE id=$1', [task.mission_id]);
  const mission = missionQ.rows[0];
  if (!mission || mission.status !== 'RUNNING') return;
  
  // Update task status
  await pool.query(`UPDATE tasks SET status='RUNNING', progress=50, started_at=COALESCE(started_at,now()), leased_until=now()+($2 || ' seconds')::interval WHERE id=$1`, [task.id, LEASE_SECONDS]);
  
  await emitEvent(pool, { missionId: task.mission_id, taskId: task.id, type: 'task.started', actor: task.agent, payload: { workerId: WORKER_ID, provenance: 'LIVE' } });
  
  // Check for tool requirements
  let toolResults = [];
  if (task.tool_requirements || task.required_capabilities) {
    try {
      // Execute required tools
      const caps = task.required_capabilities || [];
      
      // For now, just log the requirements
      await evidenceLedger.createToolEvidence(task.id, 'task_setup', 
        { capabilities: caps }, 
        { missionId: task.mission_id, taskId: task.id, agentId: task.agent }
      );
    } catch (toolError) {
      console.error('[worker] Tool execution error:', toolError);
    }
  }
  
  // Execute with Qwen
  const deps = await dependencyContext(task);
  const result = await qwenChat([
    { role: 'system', content: `You are the ${task.agent} specialist inside AgentSwarm. Execute only the assigned task. Be precise, produce a useful artifact, and clearly state uncertainty.` },
    { role: 'user', content: `Mission goal:\n${mission.goal}\n\nAssigned task:\n${task.title}\n\n${deps ? `Dependency outputs:\n${deps}` : ''}` }
  ]);
  
  // Create evidence
  const evidence = await evidenceLedger.createTaskEvidence(task.id, result, task.agent);
  
  // Save artifact
  let artifactId = null;
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const artifact = await client.query(
        `INSERT INTO artifacts (mission_id, task_id, name, kind, content, evidence_hash)
         VALUES ($1,$2,$3,'agent_output',$4,$5) RETURNING *`,
        [task.mission_id, task.id, `${task.task_key}.md`, result.content, evidence.evidence_hash]
      );
      artifactId = artifact.rows[0].id;
      
      await client.query(`UPDATE tasks SET status='SUCCEEDED', progress=100, provider=$2, model=$3,
         input_tokens=$4, output_tokens=$5, output_text=$6, error=NULL, completed_at=now()
         WHERE id=$1`,
        [task.id, result.provider, result.model, result.inputTokens, result.outputTokens, result.content]
      );
      
      await emitEvent(client, { missionId: task.mission_id, taskId: task.id, type: 'model.completed', actor: task.agent, payload: { provider: result.provider, model: result.model, provenance: 'LIVE' } });
      await emitEvent(client, { missionId: task.mission_id, taskId: task.id, type: 'task.completed', actor: task.agent, payload: { provenance: 'LIVE' } });
      
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  } catch (e) {
    console.error('[worker] Error saving artifact:', e);
  }
  
  await promoteReady(task.mission_id);
  await maybeFinishMission(task.mission_id);
  
  return { success: true, result, evidence, artifactId };
}

// Keep existing helper functions
async function dependencyContext(task) {
  const deps = Array.isArray(task.dependencies) ? task.dependencies : JSON.parse(task.dependencies || '[]');
  if (!deps.length) return '';
  const { rows } = await pool.query(`SELECT task_key,title,output_text FROM tasks WHERE mission_id=$1 AND task_key = ANY($2::text[]) ORDER BY created_at`, [task.mission_id, deps]);
  return rows.map(r => `Dependency ${r.task_key} — ${r.title}:\n${r.output_text || '[no output]'}`).join('\n\n');
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
    
    const vr = await client.query(`INSERT INTO verification_runs (mission_id,status,summary,completed_at) VALUES ($1,$2,$3,now()) RETURNING *`, [missionId, passed ? 'PASSED' : 'FAILED', passed ? 'All tasks have artifacts.' : 'Artifact count mismatch.']);
    
    await emitEvent(client, { missionId, type: passed ? 'verification.passed' : 'verification.failed', actor: 'verifier', payload: { verificationId: vr.rows[0].id, summary: vr.rows[0].summary, provenance: 'LIVE' } });
    await client.query(`UPDATE missions SET status=$2, completed_at=now(), updated_at=now() WHERE id=$1`, [missionId, passed ? 'COMPLETED' : 'FAILED']);
    await emitEvent(client, { missionId, type: passed ? 'mission.completed' : 'mission.failed', actor: 'orchestrator', payload: { provenance: 'LIVE' } });
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

// Claim task function
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
        await emitEvent(client, {missionId: t.mission_id, taskId: t.id, type: 'approval.requested', actor: t.agent, payload: { approvalId: created.rows[0].id, risk: t.risk, provenance: 'LIVE' } });
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

// Main worker loop
async function tryClaimAndProcessOne() {
  // First try to plan a queued mission
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
    if (m) {
      await client.query(`UPDATE missions SET status='PLANNING', provider_status=$2, started_at=COALESCE(started_at,now()), updated_at=now() WHERE id=$1`, [m.id, qwenConfigured() ? 'CONNECTED' : 'UNAVAILABLE']);
      await emitEvent(client, { missionId: m.id, type: 'mission.planning_started', actor: 'planner', payload: { workerId: WORKER_ID, provenance: 'LIVE' } });
      await client.query('COMMIT');
      
      // Plan outside transaction
      if (qwenConfigured()) {
        await planMission(m);
      } else {
        await pool.query(`UPDATE missions SET status='BLOCKED', provider_status='UNAVAILABLE', provider_error='Qwen not configured', updated_at=now() WHERE id=$1`, [m.id]);
        await emitEvent(pool, { missionId: m.id, type: 'mission.blocked', actor: 'planner', payload: { reason: 'Qwen not configured', provenance: 'LIVE' } });
      }
      return true;
    }
    await client.query('ROLLBACK');
  } catch (e) { await client.query('ROLLBACK'); console.error('[worker] Claim error:', e); } finally { client.release(); }
  
  // Then try to claim and execute a task
  const task = await claimTask();
  if (task) {
    await executeTask(task);
    return true;
  }
  return false;
}

async function drainAvailableWork(maxIterations = 50) {
  for (let i = 0; i < maxIterations; i++) {
    const did = await tryClaimAndProcessOne();
    if (!did) break;
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

async function main() {
  console.log(`[AgentSwarm worker] ${WORKER_ID} started; Qwen=${qwenConfigured() ? 'CONFIGURED' : 'UNAVAILABLE'}; dispatch=${redisConfigured() ? 'BullMQ+Postgres-fallback' : 'Postgres-poll-only'}`);
  
  // Initialize model router
  await initDefaultModels();
  
  // Start scheduler
  scheduler.start();

  // Start BullMQ worker
  startQueueWorker(tryClaimAndProcessOne, {
    concurrency: WORKER_CONCURRENCY,
    onError: (err) => console.error('[worker] queue error', err)
  });

  // Fallback sweep
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

// Export for testing and API
export { scheduler, evidenceLedger, modelRouter, tryClaimAndProcessOne };