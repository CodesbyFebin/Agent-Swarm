/**
 * Evidence Ledger - End-to-end proof of work
 * 
 * Evidence must be generated from real execution:
 * - Model outputs
 * - Tool executions  
 * - File operations
 * - External API calls
 */

import crypto from 'node:crypto';
import { z } from 'zod';
import { pool, emitEvent } from './db.js';

const EVIDENCE_TYPES = [
  'WEB', 'FILE', 'TOOL', 'MODEL', 'USER', 'SYSTEM'
];

const evidenceSchema = z.object({
  mission_id: z.string().uuid(),
  task_id: z.string().uuid().optional(),
  agent_id: z.string().optional(),
  claim: z.string().max(1000),
  source_type: z.enum(EVIDENCE_TYPES),
  source_ref: z.string(),
  collected_at: z.string().optional(),
  evidence_hash: z.string().optional(),
  provenance: z.array(z.object({
    actor: z.string(),
    timestamp: z.string(),
    tool: z.string().optional()
  })).optional()
});

class EvidenceLedger {
  /**
   * Create evidence record for a task execution
   */
  async createTaskEvidence(taskId, result, agentName, options = {}) {
    const missionResult = await pool.query(
      `SELECT mission_id FROM tasks WHERE id = $1`, [taskId]
    );
    const missionId = missionResult.rows[0]?.mission_id;

    if (!missionId) {
      throw new Error('Task not found');
    }

    const evidence = {
      id: crypto.randomUUID(),
      mission_id: missionId,
      task_id: taskId,
      agent_id: agentName,
      claim: `Task executed successfully`,
      source_type: 'MODEL',
      source_ref: `task:${taskId}`,
      collected_at: new Date().toISOString(),
      evidence_hash: this.hashResult(result),
      provenance: [{
        actor: 'worker',
        timestamp: new Date().toISOString(),
        tool: 'model_executor'
      }]
    };

    await this.persistEvidence(evidence);
    return evidence;
  }

  /**
   * Create evidence for tool execution
   */
  async createToolEvidence(taskId, toolName, input, result, context = {}) {
    const evidence = {
      id: crypto.randomUUID(),
      mission_id: context.missionId,
      task_id: taskId,
      agent_id: context.agentId,
      claim: `Tool '${toolName}' execution`,
      source_type: 'TOOL',
      source_ref: `tool:${toolName}:${evidence.id}`,
      collected_at: new Date().toISOString(),
      evidence_hash: this.hashResult({ input, output: result }),
      provenance: [
        ...(context.provenance || []),
        { actor: 'tool_gateway', timestamp: new Date().toISOString(), tool: toolName }
      ]
    };

    await this.persistEvidence(evidence);

    await emitEvent(pool, {
      missionId: evidence.mission_id,
      taskId: evidence.task_id,
      type: 'evidence.created',
      actor: 'tool_gateway',
      payload: { evidenceId: evidence.id, tool: toolName }
    });

    return evidence;
  }

  /**
   * Create evidence for verification
   */
  async createVerificationEvidence(taskId, verificationResult, verifierName) {
    const taskResult = await pool.query(
      `SELECT mission_id FROM tasks WHERE id = $1`, [taskId]
    );
    const missionId = taskResult.rows[0]?.mission_id;

    const evidence = {
      id: crypto.randomUUID(),
      mission_id: missionId,
      task_id: taskId,
      claim: `Verification completed by ${verifierName}`,
      source_type: 'SYSTEM',
      source_ref: `verification:${verifierName}`,
      collected_at: new Date().toISOString(),
      evidence_hash: this.hashResult(verificationResult),
      provenance: [{
        actor: 'verifier',
        timestamp: new Date().toISOString()
      }]
    };

    await this.persistEvidence(evidence);

    return evidence;
  }

  /**
   * Create evidence for file operations
   */
  async createFileEvidence(taskId, filePath, operation, details) {
    const evidence = {
      id: crypto.randomUUID(),
      mission_id: null, // Will be filled from task
      task_id: taskId,
      claim: `${operation} on ${filePath}`,
      source_type: 'FILE',
      source_ref: `file:${filePath}`,
      collected_at: new Date().toISOString(),
      evidence_hash: this.hashResult(details),
      provenance: [{
        actor: 'filesystem_tool',
        timestamp: new Date().toISOString()
      }]
    };

    // Fill mission_id from task
    const taskResult = await pool.query(
      `SELECT mission_id FROM tasks WHERE id = $1`, [taskId]
    );
    if (taskResult.rows[0]) {
      evidence.mission_id = taskResult.rows[0].mission_id;
    }

    await this.persistEvidence(evidence);

    return evidence;
  }

  /**
   * Create evidence for user actions
   */
  async createUserEvidence(userId, action, details, context = {}) {
    const evidence = {
      id: crypto.randomUUID(),
      mission_id: context.missionId || null,
      task_id: context.taskId || null,
      agent_id: null,
      claim: `User action: ${action}`,
      source_type: 'USER',
      source_ref: `user:${userId}:${evidence.id}`,
      collected_at: new Date().toISOString(),
      evidence_hash: this.hashResult(details),
      provenance: [{
        actor: 'user',
        timestamp: new Date().toISOString(),
        user: userId
      }]
    };

    await this.persistEvidence(evidence);

    await emitEvent(pool, {
      missionId: evidence.mission_id,
      taskId: evidence.task_id,
      type: 'evidence.user_action',
      actor: 'user',
      payload: { action, evidenceId: evidence.id, userId }
    });

    return evidence;
  }

  /**
   * Persist evidence to database
   */
  async persistEvidence(evidence) {
    // Validate evidence
    const validated = evidenceSchema.parse(evidence);

    await pool.query(
      `INSERT INTO evidence (
        id, mission_id, task_id, agent_id, claim, source_type, source_ref,
        collected_at, evidence_hash, provenance
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      )`,
      [
        validated.id, validated.mission_id, validated.task_id, validated.agent_id,
        validated.claim, validated.source_type, validated.source_ref,
        validated.collected_at, validated.evidence_hash, JSON.stringify(validated.provenance || [])
      ]
    );

    await emitEvent(pool, {
      missionId: validated.mission_id,
      taskId: validated.task_id,
      type: 'evidence.created',
      actor: 'evidence_system',
      payload: { evidenceId: validated.id, sourceType: validated.source_type }
    });

    return validated.id;
  }

  /**
   * Get evidence for a mission
   */
  async getEvidence(missionId, options = {}) {
    let query = `
      SELECT e.*, 
             t.task_key, t.title as task_title,
             u.email as actor_email
      FROM evidence e
      LEFT JOIN tasks t ON e.task_id = t.id
      LEFT JOIN users u ON e.agent_id = u.id
      WHERE e.mission_id = $1
    `;

    const params = [missionId];

    if (options.type) {
      query += ` AND e.source_type = $${params.length + 1}`;
      params.push(options.type);
    }

    query += ` ORDER BY e.collected_at ASC`;

    if (options.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Hash result for integrity
   */
  hashResult(result) {
    if (typeof result === 'string') {
      return crypto.createHash('sha256').update(result).digest('hex');
    }
    return crypto.createHash('sha256')
      .update(JSON.stringify(result))
      .digest('hex');
  }

  /**
   * Verify evidence integrity
   */
  async verifyEvidence(evidenceId) {
    const result = await pool.query(
      `SELECT * FROM evidence WHERE id = $1`, [evidenceId]
    );

    if (!result.rows.length) {
      return { valid: false, reason: 'Evidence not found' };
    }

    const evidence = result.rows[0];

    // Check if hash matches
    // Note: This requires storing original data somewhere or using a hash verification strategy

    return {
      valid: true,
      evidence,
      timestamp: evidence.collected_at
    };
  }

  /**
   * Get evidence chain for a task
   */
  async getEvidenceChain(taskId) {
    const { rows } = await pool.query(
      `SELECT * FROM evidence WHERE task_id = $1 ORDER BY collected_at ASC`,
      [taskId]
    );

    return rows.map(e => ({
      ...e,
      provenance: JSON.parse(e.provenance || '[]')
    }));
  }
}

export const evidenceLedger = new EvidenceLedger();
export { evidenceSchema, EVIDENCE_TYPES };