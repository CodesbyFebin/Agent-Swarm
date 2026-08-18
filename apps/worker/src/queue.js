import { Queue, Worker } from 'bullmq';
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

/** Same coordination-hint contract as apps/api/src/queue.js — see comment there. */
export async function enqueue(kind, id) {
  const q = getQueue();
  if (!q) return;
  const addPromise = q.add(kind, { kind, id }, { removeOnComplete: 500, removeOnFail: 500 });
  addPromise.catch(() => {});
  try {
    await withTimeout(addPromise, 1500);
  } catch {
    // best-effort wake-up signal only
  }
}

/**
 * Starts a BullMQ Worker that calls `processOne` for every job. Job payload
 * is a hint, not an instruction: processOne re-derives the actual claimable
 * work from Postgres (FOR UPDATE SKIP LOCKED), so a stale/duplicate/dropped
 * job can never cause duplicate or incorrect execution. Returns null if
 * Redis isn't configured — callers must still run a fallback poll.
 */
export function startQueueWorker(processOne, { concurrency = 4, onError } = {}) {
  if (!redisConfigured()) return null;
  const worker = new Worker(QUEUE_NAME, async () => { await processOne(); }, {
    connection: getBullConnection(), concurrency
  });
  worker.on('error', (err) => onError?.(err));
  return worker;
}
