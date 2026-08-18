import pg from 'pg';
const { Pool } = pg;

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function emitEvent(client, { missionId, taskId = null, type, actor = 'system', payload = {} }) {
  const { rows } = await client.query(
    `INSERT INTO events (mission_id, task_id, type, actor, payload)
     VALUES ($1,$2,$3,$4,$5::jsonb)
     RETURNING *`,
    [missionId, taskId, type, actor, JSON.stringify(payload)]
  );
  return rows[0];
}

export async function getMissionAggregate(id) {
  const missionQ = await pool.query('SELECT * FROM missions WHERE id=$1', [id]);
  if (!missionQ.rowCount) return null;
  const [tasks, approvals, artifacts, verification, events] = await Promise.all([
    pool.query('SELECT * FROM tasks WHERE mission_id=$1 ORDER BY created_at, task_key', [id]),
    pool.query('SELECT * FROM approvals WHERE mission_id=$1 ORDER BY created_at DESC', [id]),
    pool.query('SELECT * FROM artifacts WHERE mission_id=$1 ORDER BY created_at DESC', [id]),
    pool.query('SELECT * FROM verification_runs WHERE mission_id=$1 ORDER BY created_at DESC', [id]),
    pool.query('SELECT * FROM events WHERE mission_id=$1 ORDER BY id DESC LIMIT 250', [id]),
  ]);
  const usage = tasks.rows.reduce((acc, t) => {
    if (Number.isInteger(t.input_tokens)) acc.inputTokens += t.input_tokens;
    else acc.inputUnknown = true;
    if (Number.isInteger(t.output_tokens)) acc.outputTokens += t.output_tokens;
    else acc.outputUnknown = true;
    return acc;
  }, { inputTokens: 0, outputTokens: 0, inputUnknown: false, outputUnknown: false, actualCost: null });
  return {
    mission: missionQ.rows[0],
    tasks: tasks.rows,
    approvals: approvals.rows,
    artifacts: artifacts.rows,
    verification: verification.rows,
    events: events.rows.reverse(),
    usage,
  };
}
