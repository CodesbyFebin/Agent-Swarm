/**
 * Model Router - Multi-model support with routing policies
 */

import { z } from 'zod';

const MODEL_CONFIG_SCHEMA = z.object({
  name: z.string(),
  provider: z.enum(['openai', 'qwen', 'kimi', 'minimax', 'local', 'custom']),
  baseUrl: z.string().url().optional(),
  apiKey: z.string().optional(),
  modelName: z.string(),
  capabilities: z.array(z.string()).default([]),
  maxTokens: z.number().default(4000),
  temperature: z.number().default(0.7),
  latencyMs: z.number().optional(),
  costPer1k: z.number().optional(),
  status: z.enum(['LIVE', 'UNAVAILABLE', 'DEGRADED', 'CONFIGURED']).default('UNAVAILABLE')
});

class ModelRouter {
  constructor() {
    this.models = new Map();
    this.routingPolicies = {
      AUTO: 'auto',
      QUALITY: 'quality',
      SPEED: 'speed',
      COST: 'cost',
      PRIVACY: 'local',
      LOCAL: 'local',
      BALANCED: 'balanced'
    };
  }

  // Register a model
  registerModel(config) {
    const validated = MODEL_CONFIG_SCHEMA.parse(config);
    this.models.set(validated.name, validated);
    return validated;
  }

  // Unregister a model
  unregisterModel(name) {
    this.models.delete(name);
  }

  // Get available models
  getModels() {
    return Array.from(this.models.values());
  }

  // Route to appropriate model based on policy
  async route(prompt, options = {}) {
    const { policy = 'AUTO', requiredCapabilities = [], context = {} } = options;
    // Get available models matching capabilities
    const candidates = Array.from(this.models.values())
      .filter(m => requiredCapabilities.length === 0 || m.capabilities.some(c => requiredCapabilities.includes(c)));

    // If no candidates match, throw error
    if (!candidates.length) {
      throw new Error('No models available for required capabilities');
    }

    let selected = null;

    switch (policy.toUpperCase()) {
      case 'QUALITY':
        selected = candidates.reduce((best, current) => 
          (current.qualityScore || 0) > (best.qualityScore || 0) ? current : best
        );
        break;

      case 'SPEED':
        selected = candidates.reduce((best, current) => 
          (current.latencyMs || Infinity) < (best.latencyMs || Infinity) ? current : best
        );
        break;

      case 'COST':
        selected = candidates.reduce((best, current) => 
          (current.costPer1k || Infinity) < (best.costPer1k || Infinity) ? current : best
        );
        break;

      case 'PRIVACY':
      case 'LOCAL':
        selected = candidates.find(m => m.provider === 'local');
        if (!selected) throw new Error('No local model available');
        break;

      case 'BALANCED':
        selected = candidates.reduce((best, current) => {
          const bestScore = (best.qualityScore || 0) * 0.5 + (1 / (best.latencyMs || 1)) * 0.3 + (1 / (best.costPer1k || 1)) * 0.2;
          const currentScore = (current.qualityScore || 0) * 0.5 + (1 / (current.latencyMs || 1)) * 0.3 + (1 / (current.costPer1k || 1)) * 0.2;
          return currentScore > bestScore ? current : best;
        });
        break;

      case 'AUTO':
      default:
        // Select based on context and capabilities
        selected = candidates[0];
        break;
    }

    return {
      model: selected.name,
      provider: selected.provider,
      baseUrl: selected.baseUrl,
      options: {
        maxTokens: selected.maxTokens,
        temperature: selected.temperature
      }
    };
  }

  // Create model invocation record
  async recordInvocation(invocation) {
    const { model, provider, prompt, response, inputTokens, outputTokens, latencyMs, cost, status } = invocation;

    const result = await pool.query(`
      INSERT INTO model_invocations (
        id, model, provider, prompt, response, 
        input_tokens, output_tokens, latency_ms, cost, status, created_at
      ) VALUES (
        gen_random_uuid(), $2, $3, $4, $5,
        $6, $7, $8, $9, $10, now()
      ) RETURNING *
    `, [
      model, provider, prompt, response,
      inputTokens, outputTokens, latencyMs, cost, status
    ]);

    return result.rows[0];
  }

  // Health check for all models
  async health() {
    const healthStatus = {};

    for (const [name, config] of this.models) {
      try {
        const response = await fetch(`${config.baseUrl}/models/${config.modelName}`, {
          headers: { Authorization: `Bearer ${config.apiKey}` }
        });

        healthStatus[name] = response.ok ? 'LIVE' : 'DEGRADED';
      } catch (error) {
        healthStatus[name] = 'UNAVAILABLE';
      }
    }

    return healthStatus;
  }

  // Get model by name
  getModel(name) {
    return this.models.get(name);
  }
}

// Import pool for database operations
import { pool } from './db.js';

export const modelRouter = new ModelRouter();

// Pre-configured models (would be loaded from config/env in production)
export function initDefaultModels() {
  // Qwen model
  if (process.env.QWEN_API_KEY && process.env.QWEN_BASE_URL) {
    modelRouter.registerModel({
      name: 'qwen-plus',
      provider: 'qwen',
      baseUrl: process.env.QWEN_BASE_URL,
      apiKey: process.env.QWEN_API_KEY,
      modelName: process.env.QWEN_MODEL || 'qwen-plus',
      capabilities: ['reasoning', 'coding', 'analysis'],
      maxTokens: 8000,
      temperature: 0.2,
      status: 'CONFIGURED'
    });
  }

  // OpenAI model (if configured)
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_BASE_URL) {
    modelRouter.registerModel({
      name: 'gpt-4',
      provider: 'openai',
      baseUrl: process.env.OPENAI_BASE_URL,
      apiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4',
      capabilities: ['reasoning', 'coding', 'analysis', 'creative'],
      maxTokens: 8000,
      temperature: 0.7,
      status: 'CONFIGURED'
    });
  }

  // MiniMax model (if configured)
  if (process.env.MINIMAX_API_KEY && process.env.MINIMAX_BASE_URL) {
    modelRouter.registerModel({
      name: process.env.MINIMAX_MODEL_NAME || "abab6.5s-chat",
      provider: "minimax",
      baseUrl: process.env.MINIMAX_BASE_URL,
      apiKey: process.env.MINIMAX_API_KEY,
      modelName: process.env.MINIMAX_MODEL || "abab6.5s-chat",
      capabilities: ["reasoning", "coding", "analysis"],
      maxTokens: 8000,
      temperature: 0.2,
      status: "CONFIGURED"
    });
  }

  // Local model (if configured)
  if (process.env.LOCAL_MODEL_URL) {
    modelRouter.registerModel({
      name: 'local-llm',
      provider: 'local',
      baseUrl: process.env.LOCAL_MODEL_URL,
      modelName: process.env.LOCAL_MODEL_NAME || 'local-model',
      capabilities: ['reasoning', 'coding'],
      maxTokens: 4000,
      temperature: 0.7,
      status: 'CONFIGURED'
    });
  }

  console.log('[model-router] Models registered:', 
    Array.from(modelRouter.models.keys())
  );
}

export async function getModelRouter() {
  await initDefaultModels();
  return modelRouter;
}
