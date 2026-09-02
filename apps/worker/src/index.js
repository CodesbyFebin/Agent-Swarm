import { config } from 'dotenv';
config({ path: '../../../.env' });
import { z } from 'zod';
import { pool, emitEvent } from './db.js';
import { chat, qwenConfigured, openaiConfigured, minimaxConfigured } from './chat.js';
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

// Agent types
const AGENTS = ['planner', 'researcher', 'architect', 'backend', 'frontend', 'qa', 'security', 'devops', 'system'];

// JSON extraction helper
function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text;
}

// Task plan schema
const planSchema = z.object({
  tasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    agent: z.enum(AGENTS),
    task_key: z.string(),
    description: z.string(),
    requiredTools: z.array(z.string()).default([]),
    requiredCapabilities: z.array(z.string()).default([]),
    estimatedDurationMs: z.number().default(30000),
    requiresApproval: z.boolean().default(false),
    risk: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('LOW'),
    dependencies: z.array(z.string()).default([])
  }))
});

// Task execution schema
const taskResultSchema = z.object({
  artifact: z.string(),
  success: z.boolean().default(true),
  error: z.string().optional()
});

// Main worker loop
async function main() {
  console.log(`[AgentSwarm worker] ${WORKER_ID} starting...`);
  
  // Initialize model router
  await initDefaultModels();
  console.log(`[AgentSwarm worker] ${WORKER_ID} initialized with models:`, 
    Array.from(modelRouter.models.keys()).join(', '));
  
  // Start scheduler
  scheduler.start();
  
  // Start queue worker if Redis is configured
  if (redisConfigured()) {
    await startQueueWorker();
    console.log(`[AgentSwarm worker] ${WORKER_ID} started queue worker`);
  }
  
  // Main processing loop
  while (true) {
    try {
      await tryClaimAndProcessOne();
      // Small delay to prevent busy looping
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (err) {
      console.error(`[AgentSwarm worker] ${WORKER_ID} error in main loop:`, err);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// Claim and process one task from the queue
async function tryClaimAndProcessOne() {
  const client = await pool.connect();
  try {
    // Begin transaction
    await client.query('BEGIN');
    
    // Find a READY task to work on
    const taskResult = await client.query(`
      UPDATE tasks 
      SET status = 'LEASED', 
          lease_owner = $2, 
          leased_until = now() + COALESCE($3, '1 second')::interval,
          attempt_count = attempt_count + 1
      WHERE id IN (
        SELECT id FROM tasks 
        WHERE status = 'READY' 
          AND (lease_owner IS NULL OR lease_owner = $2)
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `, [WORKER_ID, LEASE_SECONDS]);
    
    if (taskResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return false; // No work available
    }
    
    const task = taskResult.rows[0];
    console.log(`[AgentSwarm worker] ${WORKER_ID} leased task ${task.id}: ${task.title}`);
    
    // Get mission and project context
    const missionResult = await client.query(`
      SELECT m.*, p.name as project_name, p.slug as project_slug, 
             o.name as org_name
      FROM missions m
      JOIN projects p ON m.project_id = p.id
      JOIN organizations o ON p.organization_id = o.id
      WHERE m.id = $1
    `, [task.mission_id]);
    
    if (missionResult.rowCount === 0) {
      throw new Error(`Mission not found for task ${task.id}`);
    }
    
    const mission = missionResult.rows[0];
    
    // Update task status to RUNNING
    await client.query(`
      UPDATE tasks 
      SET status = 'RUNNING', 
          started_at = now(),
          updated_at = now()
      WHERE id = $1
    `, [task.id]);
    
    await client.query('COMMIT');
    
    // Execute the task
    let result;
    try {
      result = await executeTask(task, mission, client);
      
      // Mark task as completed
      await client.query('BEGIN');
      await client.query(`
        UPDATE tasks 
        SET status = 'SUCCEEDED', 
            completed_at = now(),
            updated_at = now(),
            progress = 100
        WHERE id = $1
      `, [task.id]);
      
      // Save artifact if produced
      if (result.artifact) {
        await client.query(`
          INSERT INTO artifacts (
            id, task_id, mission_id, name, kind, content, created_at
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, now()
          )
        `, [
          task.id,
          mission.id,
          `${task.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-artifact`,
          'text/plain',
          result.artifact
        ]);
      }
      
      await client.query('COMMIT');
      console.log(`[AgentSwarm worker] ${WORKER_ID} task ${task.id} completed successfully`);
      
    } catch (taskError) {
      console.error(`[AgentSwarm worker] ${WORKER_ID} task ${task.id} failed:`, taskError);
      
      // Handle task failure/retry
      await client.query('BEGIN');
      if (task.attempt_count >= MAX_ATTEMPTS) {
        // Max attempts reached - mark as failed
        await client.query(`
          UPDATE tasks 
          SET status = 'FAILED', 
              completed_at = now(),
              updated_at = now(),
              error = $2
          WHERE id = $1
        `, [task.id, taskError.message]);
      } else {
        // Reset to ready for retry
        await client.query(`
          UPDATE tasks 
          SET status = 'READY', 
              lease_owner = NULL,
              leased_until = NULL,
              updated_at = now()
          WHERE id = $1
        `, [task.id]);
      }
      await client.query('COMMIT');
    }
    
    return true;
  } finally {
    client.release();
  }
}

// Execute a task using the appropriate agent logic
async function executeTask(task, mission, client) {
  // Build dependency context
  const deps = await dependencyContext(task);
  
  // Execute via model router
  const result = await chat([
    { role: 'system', content: `You are the ${task.agent} specialist inside AgentSwarm. Execute only the assigned task. Be precise, produce a useful artifact, and clearly state uncertainty.` },
    { role: 'user', content: `Mission goal:\n${mission.goal}\n\nAssigned task:\n${task.title}\n\n${deps ? `Dependency outputs:\n${deps}` : ''}` }
  ], {
    policy: 'BALANCED',
    requiredCapabilities: task.requiredCapabilities
  });
  
  // Record model invocation
  await modelRouter.recordInvocation({
    model: result.model,
    provider: result.provider,
    prompt: JSON.stringify([
      { role: 'system', content: `You are the ${task.agent} specialist inside AgentSwarm.` },
      { role: 'user', content: `Mission: ${mission.goal}\nTask: ${task.title}` }
    ]),
    response: result.content,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    latencyMs: result.latencyMs,
    cost: null, // Would need pricing info
    status: 'success'
  });
  
  return {
    artifact: result.content,
    success: true
  };
}

// Build dependency context from completed tasks
async function dependencyContext(task) {
  if (!task.dependencies || task.dependencies.length === 0) {
    return '';
  }
  
  const client = await pool.connect();
  try {
    const depsResult = await client.query(`
      SELECT t.task_key, t.title, a.content as artifact_content
      FROM tasks t
      LEFT JOIN artifacts a ON a.task_id = t.id
      WHERE t.id = ANY($1)
    `, [task.dependencies]);
    
    if (depsResult.rowCount === 0) {
      return '';
    }
    
    return depsResult.rows.map(dep => 
      `${dep.task_key} (${dep.title}):\n${dep.artifact_content || '[No artifact]'}`).join('\n\n');
  } finally {
    client.release();
  }
}

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  console.log(`[AgentSwarm worker] ${WORKER_ID} received SIGTERM, shutting down...`);
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log(`[AgentSwarm worker] ${WORKER_ID} received SIGINT, shutting down...`);
  process.exit(0);
});

// Run the worker
main().catch(err => {
  console.error(`[AgentSwarm worker] ${WORKER_ID} fatal error:`, err);
  process.exit(1);
});

export { scheduler, evidenceLedger, modelRouter, tryClaimAndProcessOne };
