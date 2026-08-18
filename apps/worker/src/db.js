import pg from 'pg';
const { Pool } = pg;
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function emitEvent(client, { missionId, taskId = null, type, actor = 'system', payload = {} }) {
  const { rows } = await client.query(
    `INSERT INTO events (mission_id, task_id, type, actor, payload)
     VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING *`,
    [missionId, taskId, type, actor, JSON.stringify(payload)]
  );
  return rows[0];
}
