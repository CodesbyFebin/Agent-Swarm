import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export const QUEUE_NAME = 'agentswarm-work';

export function redisConfigured() {
  return Boolean(process.env.REDIS_URL);
}

let bullConnection = null;
let queue = null;

function getBullConnection() {
  if (!bullConnection) bullConnection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
  return bullConnection;
}

function getQueue() {
  if (!redisConfigured()) return null;
  if (!queue) queue = new Queue(QUEUE_NAME, { connection: getBullConnection() });
  return queue;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('ENQUEUE_TIMEOUT')), ms))
  ]);
}

/**
 * Wake up a worker to look for claimable work. Redis/BullMQ is a coordination
 * hint only — Postgres row-level locking (FOR UPDATE SKIP LOCKED) remains the
 * sole source of truth for which worker actually claims a mission/task, so a
 * dropped or duplicate enqueue never causes duplicate execution. If Redis is
 * unavailable, this silently no-ops (bounded by a short timeout, so it can
 * never hang a caller) and the worker's fallback poll still finds the work —
 * just with added latency, not lost correctness. Callers must invoke this
 * only after releasing any Postgres client they're holding, so a slow/stuck
 * Redis never leaks a pooled DB connection.
 */
export async function enqueue(kind, id) {
  const q = getQueue();
  if (!q) return;
  const addPromise = q.add(kind, { kind, id }, { removeOnComplete: 500, removeOnFail: 500 });
  addPromise.catch(() => {}); // avoid an unhandled rejection if it settles after our timeout below
  try {
    await withTimeout(addPromise, 1500);
  } catch {
    // best-effort wake-up signal only
  }
}

export async function pingRedis() {
  if (!redisConfigured()) return false;
  const client = new IORedis(process.env.REDIS_URL, {
    enableOfflineQueue: false, connectTimeout: 1500, lazyConnect: true, maxRetriesPerRequest: 0
  });
  try {
    await client.connect();
    return (await client.ping()) === 'PONG';
  } catch {
    return false;
  } finally {
    client.disconnect();
  }
}
