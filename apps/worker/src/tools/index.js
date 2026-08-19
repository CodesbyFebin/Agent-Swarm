/**
 * Tool Gateway - Secure tool execution layer
 * 
 * Every tool call passes through:
 * Policy → Approval → Adapter → Execution → Event → Evidence
 */

import crypto from 'node:crypto';
import { z } from 'zod';
import { pool, emitEvent } from '../db.js';

// Tool registry - all available tools
const TOOL_REGISTRY = new Map();

// Tool base class for all tool adapters
export class ToolAdapter {
  constructor(name, description, categories = []) {
    this.name = name;
    this.description = description;
    this.categories = categories; // ['filesystem', 'shell', 'git', etc.]
  }

  // Must be overridden by subclasses
  async execute(params, context) {
    throw new Error(`${this.name} must implement execute()`);
  }

  // Validate parameters
  validate(params) {
    return true;
  }

  // Generate evidence
  async generateEvidence(toolCall, result, context) {
    const evidence = {
      id: crypto.randomUUID(),
      mission_id: context.missionId,
      task_id: context.taskId,
      agent_id: context.agentId,
      claim: `Tool ${this.name} executed`,
      source_type: 'TOOL',
      source_ref: toolCall.id,
      collected_at: new Date().toISOString(),
      evidence_hash: crypto.createHash('sha256').update(JSON.stringify(result)).digest('hex'),
      provenance: [...(context.provenance || []), {
        actor: 'tool_gateway',
        timestamp: new Date().toISOString(),
        tool: this.name
      }]
    };

    await pool.query(
      `INSERT INTO evidence (id, mission_id, task_id, agent_id, claim, source_type, source_ref, 
                             collected_at, evidence_hash, provenance)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        evidence.id, evidence.mission_id, evidence.task_id, evidence.agent_id,
        evidence.claim, evidence.source_type, evidence.source_ref,
        evidence.collected_at, evidence.evidence_hash, JSON.stringify(evidence.provenance)
      ]
    );

    await emitEvent(pool, {
      missionId: evidence.mission_id,
      taskId: evidence.task_id,
      type: 'tool.executed',
      actor: 'tool_gateway',
      payload: { tool: this.name, toolCallId: toolCall.id, evidenceId: evidence.id }
    });

    return evidence;
  }
}

// ==================== FILESYSTEM TOOL ====================
export class FilesystemTool extends ToolAdapter {
  constructor() {
    super('filesystem', 'File system operations', ['filesystem']);
  }

  async execute(params, context) {
    const { action, path, content, encoding = 'utf-8' } = params;

    switch (action) {
      case 'read':
        const fs = await import('node:fs/promises');
        const data = await fs.readFile(path, encoding);
        return { success: true, data, path };

      case 'write':
        const fs2 = await import('node:fs/promises');
        await fs2.writeFile(path, content, encoding);
        return { success: true, path, written: content.length };

      case 'list':
        const fs3 = await import('node:fs/promises');
        const entries = await fs3.readdir(path, { withFileTypes: true });
        return { 
          success: true, 
          path, 
          entries: entries.map(e => ({ name: e.name, isDirectory: e.isDirectory() }))
        };

      default:
        throw new Error(`Unknown filesystem action: ${action}`);
    }
  }
}

// ==================== SHELL TOOL ====================
export class ShellTool extends ToolAdapter {
  constructor() {
    super('shell', 'Shell command execution', ['shell', 'execution']);
    this.allowedCommands = new Set(process.env.SHELL_ALLOWED_COMMANDS?.split(',') || ['ls', 'pwd', 'echo']);
  }

  async execute(params, context) {
    const { command, timeout = 30000, cwd } = params;

    // Check policy - block dangerous commands
    const dangerousPatterns = ['rm -rf', 'sudo', 'chmod 777', '> /etc/', 'mkfs', 'dd if='];
    for (const pattern of dangerousPatterns) {
      if (command.includes(pattern)) {
        throw new Error(`Blocked dangerous command pattern: ${pattern}`);
      }
    }

    const { exec } = await import('node:child_process');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Command timeout'));
      }, timeout);

      exec(command, { cwd, timeout }, (error, stdout, stderr) => {
        clearTimeout(timer);
        if (error) {
          reject(error);
        } else {
          resolve({ success: true, stdout, stderr });
        }
      });
    });
  }
}

// ==================== GIT TOOL ====================
export class GitTool extends ToolAdapter {
  constructor() {
    super('git', 'Git repository operations', ['git', 'vcs']);
  }

  async execute(params, context) {
    const { action, repo, branch, commit, message } = params;

    switch (action) {
      case 'status':
        const { exec } = await import('node:child_process');
        return new Promise((resolve, reject) => {
          exec(`git -C ${repo} status`, (error, stdout) => {
            if (error) reject(error);
            else resolve({ success: true, output: stdout });
          });
        });

      case 'commit':
        const { exec2 } = await import('node:child_process');
        return new Promise((resolve, reject) => {
          exec2(`git -C ${repo} add .`, (error) => {
            if (error) reject(error);
            else exec2(`git -C ${repo} commit -m "${message}"`, (error2) => {
              if (error2) reject(error2);
              else resolve({ success: true });
            });
          });
        });

      default:
        throw new Error(`Unknown git action: ${action}`);
    }
  }
}

// ==================== WEB FETCH TOOL ====================
export class WebFetchTool extends ToolAdapter {
  constructor() {
    super('web_fetch', 'Fetch web content', ['web', 'http']);
  }

  async execute(params, context) {
    const { url, method = 'GET', headers = {} } = params;

    const response = await fetch(url, { method, headers });
    const content = await response.text();

    return {
      success: true,
      url,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      content
    };
  }
}

// ==================== POSTGRES TOOL ====================
export class PostgresTool extends ToolAdapter {
  constructor() {
    super('postgres', 'PostgreSQL database operations', ['database', 'sql']);
  }

  async execute(params, context) {
    const { sql, params: sqlParams, readOnly = false } = params;

    // Block dangerous operations
    const dangerousSQL = ['DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'CREATE DATABASE', 'DROP DATABASE'];
    const upperSQL = sql.toUpperCase();
    for (const danger of dangerousSQL) {
      if (upperSQL.includes(danger) && !readOnly) {
        throw new Error(`Blocked dangerous SQL: ${danger}`);
      }
    }

    const result = await pool.query(sql, sqlParams);
    return { success: true, rows: result.rows, rowCount: result.rowCount };
  }
}

// ==================== ARTIFACT TOOL ====================
export class ArtifactTool extends ToolAdapter {
  constructor() {
    super('artifact', 'Artifact storage and retrieval', ['storage']);
  }

  async execute(params, context) {
    const { action, id, content, name, kind } = params;

    switch (action) {
      case 'store':
        const artifactId = crypto.randomUUID();
        await pool.query(
          `INSERT INTO artifacts (id, mission_id, task_id, name, kind, content, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, now())`,
          [artifactId, context.missionId, context.taskId, name, kind, content]
        );
        return { success: true, id: artifactId };

      case 'retrieve':
        const result = await pool.query(
          `SELECT * FROM artifacts WHERE id = $1`, [id]
        );
        return { success: true, artifact: result.rows[0] };

      default:
        throw new Error(`Unknown artifact action: ${action}`);
    }
  }
}

// Register all tools
TOOL_REGISTRY.set('filesystem', new FilesystemTool());
TOOL_REGISTRY.set('shell', new ShellTool());
TOOL_REGISTRY.set('git', new GitTool());
TOOL_REGISTRY.set('web_fetch', new WebFetchTool());
TOOL_REGISTRY.set('postgres', new PostgresTool());
TOOL_REGISTRY.set('artifact', new ArtifactTool());

// Register additional tools
TOOL_REGISTRY.set('http', new WebFetchTool()); // Alias
TOOL_REGISTRY.set('storage', new ArtifactTool()); // Alias

// Tool execution with policy and approval
export async function executeTool(toolName, params, context) {
  const tool = TOOL_REGISTRY.get(toolName);
  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  // Generate tool call ID
  const toolCallId = crypto.randomUUID();

  // Validate parameters
  if (!tool.validate(params)) {
    throw new Error(`Invalid parameters for tool ${toolName}`);
  }

  // Check policy and approval requirements
  const requiresApproval = needsApproval(toolName, params);
  if (requiresApproval) {
    await requestToolApproval(toolName, params, context);
    await waitForToolApproval(toolCallId, context);
  }

  // Execute tool
  const result = await tool.execute(params, context);

  // Generate evidence
  const evidence = await tool.generateEvidence(
    { id: toolCallId, toolName, params },
    result,
    context
  );

  return { success: true, result, evidence };
}

// Policy check for tool execution
function needsApproval(toolName, params) {
  const criticalTools = new Set(['shell', 'git', 'postgres', 'filesystem']);
  return criticalTools.has(toolName);
}

// Request approval for tool execution
async function requestToolApproval(toolName, params, context) {
  const approval = {
    mission_id: context.missionId,
    task_id: context.taskId,
    tool: toolName,
    params,
    risk: 'HIGH', // Tool execution is high risk
    reason: `Tool '${toolName}' execution requires approval`
  };

  await pool.query(
    `INSERT INTO tool_approvals (mission_id, task_id, tool_name, params, risk, status)
     VALUES ($1, $2, $3, $4, $5, 'PENDING')`,
    [approval.mission_id, approval.task_id, approval.tool, JSON.stringify(approval.params), approval.risk]
  );

  await emitEvent(pool, {
    missionId: context.missionId,
    taskId: context.taskId,
    type: 'tool.approval.requested',
    actor: 'tool_gateway',
    payload: { tool: toolName, risk: 'HIGH', toolCallId: crypto.randomUUID() }
  });
}

// Wait for tool approval
async function waitForToolApproval(toolCallId, context) {
  const startTime = Date.now();
  const timeout = 600000; // 10 minutes

  while (Date.now() - startTime < timeout) {
    const result = await pool.query(
      `SELECT * FROM tool_approvals WHERE tool_call_id = $1 AND status = 'APPROVED'`,
      [toolCallId]
    );

    if (result.rows[0]) {
      return true;
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error('Tool approval timeout');
}

// Export tool registry
export function listTools() {
  return Array.from(TOOL_REGISTRY.entries()).map(([name, tool]) => ({
    name: tool.name,
    description: tool.description,
    categories: tool.categories
  }));
}

export { TOOL_REGISTRY };