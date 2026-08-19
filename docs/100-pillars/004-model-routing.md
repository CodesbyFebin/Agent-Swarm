---
title: "Model Routing in AgentSwarm: Intelligent AI Provider Selection for Optimal Performance"
description: "Learn how AgentSwarm's model router intelligently selects the best AI provider for each task based on type, complexity, cost, latency, and quality requirements. Discover our pluggable architecture, honest failure handling, and optimization strategies."
date: "2026-08-19"
---

# Model Routing in AgentSwarm: Intelligent AI Provider Selection for Optimal Performance

## TL;DR: AgentSwarm's model router dynamically selects the optimal AI provider (Qwen, OpenAI, Anthropic, etc.) for each task based on task type, complexity, cost, latency, and quality requirements—never simulating or fabricating responses when providers are unavailable.

## Quick Facts

- **Architecture Pattern**: Provider-neutral adapter with routing policies
- **Supported Providers**: Qwen (default), OpenAI GPT-4, Anthropic Claude, Cohere, Hugging Face endpoints
- **Selection Criteria**: Task type, complexity, cost, latency, quality, user preferences
- **Failure Handling**: Honest reporting of unavailability (no simulation)
- **Routing Policies**: Configurable rules for optimization (cost, speed, quality)
- **Related Pillars**: [001-introduction.md](./001-introduction.md), [002-architecture.md](./002-architecture.md), [003-use-cases.md](./003-use-cases.md), [006-verification-gates.md](./006-verification-gates.md)

## Why Model Routing Matters

Not all AI tasks are created equal, and not all AI providers excel at the same things. AgentSwarm's model routing addresses several critical challenges in AI workforce management:

### The Problem with Static Provider Selection
- **One-size-fits-all inefficiency**: Using the most expensive/model for simple tasks wastes money
- **Task-mismatch results**: Some models excel at reasoning but poorly at code generation
- **Latency mismatches**: Interactive tasks need fast responses; batch processing can tolerate latency
- **Cost optimization opportunities**: Significant savings possible through intelligent routing
- **Provider lock-in risk**: Difficulty switching or testing new providers
- **Honesty requirement**: Fabricating responses when providers are down erodes trust

### AgentSwarm's Solution
Our model routing system provides:
- **Dynamic provider selection per task** based on multiple factors
- **Pluggable architecture** for easy integration of new providers
- **Policy-based optimization** for cost, speed, or quality preferences
- **Honest failure handling** - never simulates when providers are unavailable
- **Fallback mechanisms** for graceful degradation
- **Usage and cost tracking** (when providers report metrics)
- **Specialist agent compatibility** - different agent types can have different provider preferences

## Core Components

### 1. Provider-Neutral Adapter Layer
The foundation of our routing system is an abstraction layer that hides provider-specific differences:

```
┌─────────────────┐    ┌────────────────────┐    ┌────────────────────┐
│   Specialist    │    │   Model Router     │    │ Provider Adapters    │
│   Agent Request │────▶│ (Selection Logic)  │────▶│ (Qwen, OpenAI, etc.) │
└─────────────────┘    └────────────────────┘    └────────────────────┘
                              │
                              ▼
                     ┌────────────────────┐
                     │   Provider API     │
                     │   (Unified Format) │
                     └────────────────────┘
```

This ensures specialist agents don't need to know about specific providers—they simply request completion and receive results.

### 2. Intelligent Selection Logic
The router evaluates multiple factors to choose the optimal provider:

#### Task Type Matching
Different providers excel at different types of tasks:
- **Reasoning/Planning**: Models strong in logical deduction (often larger models)
- **Code Generation**: Models trained on code repositories (Code Llama, StarCoder, specialized GPT variants)
- **Creative Writing**: Models with strong language fluency and creativity
- **Technical Analysis**: Models strong in factual accuracy and domain knowledge
- **Translation**: Models with multilingual training
- **Summarization**: Models excelling at compression and key point extraction

#### Complexity Assessment
Simple tasks (classification, extraction) vs. complex tasks (multi-step reasoning, architecture design) may benefit from different model sizes or types.

#### Cost Optimization
When quality requirements are met, select the most cost-effective option:
- Input/output token pricing variations
- Batch processing discounts
- Provider-specific pricing tiers
- Caching opportunities for repetitive tasks

#### Latency Requirements
Interactive tasks (chat, real-time assistance) need low-latency providers, while batch processing can tolerate higher latency for better quality or lower cost.

#### Quality Thresholds
Some tasks have minimum quality bars (e.g., medical advice, legal analysis) that require specific providers known for reliability in those domains.

#### User Preferences and Policies
Organizations may prefer certain providers due to:
- Existing contracts or enterprise agreements
- Data residency requirements
- Security/compliance certifications
- Historical performance data

### 3. Provider Adapter Architecture
Each provider implements a standard interface:

```javascript
class BaseProvider {
  constructor(config) {
    this.name = config.name;
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.capabilities = config.capabilities || {};
  }
  
  // Check if provider is available and healthy
  async isAvailable() {
    // Implement actual health check (e.g., ping /models endpoint)
    return true; // Placeholder
  }
  
  // Get available models and their properties
  async listModels() {
    // Return array of {id, name, maxTokens, pricing, capabilities}
    return []; // Placeholder
  }
  
  // Execute completion with standard parameters
  async complete(prompt, options = {}) {
    // Implement provider-specific API call
    // Return {text, usage, model, finishReason}
    throw new Error('Not implemented');
  }
  
  // Estimate cost for a prompt/completion
  async estimateCost(prompt, maxTokens) {
    // Calculate based on provider's pricing
    return 0; // Placeholder
  }
}
```

Specialized providers inherit from this base:
- `QwenProvider` - Alibaba Cloud Qwen series
- `OpenAIProvider` - OpenAI GPT series
- `AnthropicProvider` - Claude series
- `CohereProvider` - Cohere Command series
- `HuggingFaceProvider` - Custom Hugging Face endpoints
- `CustomProvider` - Any OpenAI-compatible endpoint

### 4. Routing Policies and Configuration
Routing behavior is configurable through policies that define how to weigh different factors:

#### Default Policy (Balanced)
- Task type matching: 40% weight
- Cost efficiency: 30% weight (when quality/speed acceptable)
- Latency consideration: 20% weight
- Quality assurance: 10% weight

#### Cost-Optimized Policy
- Cost efficiency: 50% weight
- Task type matching: 30% weight
- Latency consideration: 15% weight
- Quality assurance: 5% weight

#### Quality-First Policy
- Quality assurance: 40% weight
- Task type matching: 35% weight
- Latency consideration: 15% weight
- Cost efficiency: 10% weight

#### Speed-Optimized Policy
- Latency consideration: 40% weight
- Task type matching: 30% weight
- Cost efficiency: 20% weight
- Quality assurance: 10% weight

Policies can be set at:
- **System level**: Default for all missions
- **Organization level**: Tenant-specific preferences
- **Project level**: Project-specific optimization goals
- **Mission level**: Override for specific goals
- **Task level**: Per-task routing preferences

## Detailed Implementation

### Model Router Class
The core routing logic lives in `apps/worker/src/models.js`:

```javascript
export class ModelRouter {
  constructor() {
    this.providers = new Map();
    this.routingPolicy = this.getDefaultPolicy();
    this.fallbackProviders = new Set(['qwen']); // Always try Qwen last
  }
  
  // Register a provider
  registerProvider(name, provider) {
    this.providers.set(name, provider);
  }
  
  // Get available providers for a task type
  async getAvailableProviders(taskType, requiredCapabilities = []) {
    const available = [];
    
    for (const [name, provider] of this.providers.entries()) {
      // Check if provider is healthy
      if (!(await provider.isAvailable())) {
        continue;
      }
      
      // Check if provider supports task type
      if (!this.supportsTaskType(provider, taskType)) {
        continue;
      }
      
      // Check if provider has required capabilities
      if (!this.hasCapabilities(provider, requiredCapabilities)) {
        continue;
      }
      
      available.push({ name, provider });
    }
    
    return available;
  }
  
  // Select optimal provider based on policy
  async selectProvider(taskType, options = {}) {
    const available = await this.getAvailableProviders(taskType, options.requiredCapabilities || []);
    
    if (available.length === 0) {
      throw new Error(`No available providers for task type: ${taskType}`);
    }
    
    // If only one available, use it
    if (available.length === 1) {
      return available[0].provider;
    }
    
    // Score each provider based on policy
    const scoredProviders = await Promise.all(
      available.map(async ({ name, provider }) => ({
        name,
        provider,
        score: await this.calculateProviderScore(provider, taskType, options)
      }))
    );
    
    // Sort by score (highest first)
    scoredProviders.sort((a, b) => b.score - a.score);
    
    return scoredProviders[0].provider;
  }
  
  // Calculate provider score based on routing policy
  async calculateProviderScore(provider, taskType, options) {
    let score = 0;
    const maxScore = 100;
    
    // Task type matching (0-40 points)
    score += this.scoreTaskTypeMatch(provider, taskType) * 0.4;
    
    // Cost efficiency (0-30 points)
    score += this.scoreCostEfficiency(provider, taskType, options) * 0.3;
    
    // Latency consideration (0-20 points)
    score += this.scoreLatency(provider, taskType, options) * 0.2;
    
    // Quality assurance (0-10 points)
    score += this.scoreQualityAssurance(provider, taskType, options) * 0.1;
    
    // User preferences/bonuses (0-10 points)
    score += this.scoreUserPreferences(provider, taskType, options) * 0.1;
    
    return Math.min(score, maxScore);
  }
  
  // Execute completion with selected provider
  async completeTask(taskType, prompt, options = {}) {
    const provider = await this.selectProvider(taskType, options);
    
    try {
      const result = await provider.complete(prompt, {
        temperature: options.temperature || 0.7,
        maxTokens: options.maxTokens || 2000,
        ...options
      });
      
      // Track usage if available
      if (result.usage) {
        await this.trackUsage(provider.name, result.usage, taskType);
      }
      
      return {
        ...result,
        provider: provider.name,
        routed: true
      };
    } catch (error) {
      // Handle provider failure with fallback
      return await this.handleProviderFailure(provider, taskType, prompt, options, error);
    }
  }
  
  // Handle provider failure with fallback attempts
  async handleProviderFailure(failedProvider, taskType, prompt, options, error) {
    console.warn(`Provider ${failedProvider.name} failed: ${error.message}`);
    
    // Try fallback providers in order
    const fallbackOrder = Array.from(this.fallbackProviders);
    fallbackOrder.unshift(failedProvider.name); // Try the failed one first in case it was transient
    
    for (const providerName of fallbackOrder) {
      const provider = this.providers.get(providerName);
      if (!provider || provider === failedProvider) continue;
      
      try {
        console.log(`Attempting fallback to provider: ${providerName}`);
        const result = await provider.complete(prompt, {
          temperature: options.temperature || 0.7,
          maxTokens: options.maxTokens || 2000,
          ...options
        });
        
        if (result.usage) {
          await this.trackUsage(provider.name, result.usage, taskType);
        }
        
        return {
          ...result,
          provider: provider.name,
          routed: true,
          fallback: true,
          originalError: error.message
        };
      } catch (fallbackError) {
        console.warn(`Fallback provider ${providerName} also failed: ${fallbackError.message}`);
        continue;
      }
    }
    
    // If all providers fail, throw honest error
    throw new Error(`All available providers failed for task type ${taskType}. Last error: ${error.message}`);
  }
}
```

### Provider Registration and Initialization
During worker startup, providers are registered based on environment configuration:

```javascript
// In apps/worker/src/index.js during initialization
import { QwenProvider } from './providers/qwen-provider.js';
import { OpenAIProvider } from './providers/openai-provider.js';
import { AnthropicProvider } from './providers/anthropic-provider.js';

// Initialize model router
const modelRouter = new ModelRouter();

// Register providers based on environment variables
if (process.env.QWEN_API_KEY && process.env.QWEN_BASE_URL) {
  modelRouter.registerProvider('qwen', new QwenProvider({
    name: 'qwen',
    baseUrl: process.env.QWEN_BASE_URL,
    apiKey: process.env.QWEN_API_KEY,
    capabilities: {
      reasoning: true,
      code: true,
      multilingual: true,
      maxContext: 32768
    }
  }));
}

if (process.env.OPENAI_API_KEY) {
  modelRouter.registerProvider('openai', new OpenAIProvider({
    name: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY,
    capabilities: {
      reasoning: true,
      code: true,
      vision: true,
      maxContext: 128000
    }
  }));
}

if (process.env.ANTHROPIC_API_KEY) {
  modelRouter.registerProvider('anthropic', new AnthropicProvider({
    name: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    apiKey: process.env.ANTHROPIC_API_KEY,
    capabilities: {
      reasoning: true,
      code: false,
      vision: true,
      maxContext: 200000
    }
  }));
}

// Set routing policy based on configuration
const policy = process.env.MODEL_ROUTING_POLICY || 'balanced';
modelRouter.setRoutingPolicy(policy);

// Export for use throughout the worker
export { modelRouter };
```

## Provider Capabilities and Characteristics

### Qwen (Alibaba Cloud)
- **Strengths**: Strong reasoning, multilingual capabilities, good code generation, large context window
- **Best For**: Complex reasoning tasks, multilingual content, balanced cost/performance
- **Typical Use Cases**: Architecture planning, technical research, code generation, document analysis
- **Cost**: Generally competitive pricing
- **Latency**: Moderate to good (depends on region)

### OpenAI GPT-4 Series
- **Strengths**: Industry-leading reasoning, excellent code generation, vision capabilities, broad knowledge
- **Best For**: High-complexity reasoning, creative writing, code generation, vision tasks
- **Typical Use Cases**: Advanced architecture design, creative content, complex code generation, image analysis
- **Cost**: Premium pricing (highest end)
- **Latency**: Good (optimized infrastructure)

### Anthropic Claude Series
- **Strengths**: Excellent reasoning, strong safety characteristics, large context window, good at following instructions
- **Best For**: Long-form writing, detailed analysis, instruction following, safety-critical tasks
- **Typical Use Cases**: Legal documents, compliance reports, detailed technical writing, analysis with constraints
- **Cost**: Mid to high range
- **Latency**: Good to very good

### Cohere Command Series
- **Strengths**: Strong retrieval-augmented generation (RAG), enterprise focus, good for business tasks
- **Best For**: Business writing, summarization, extraction, enterprise applications
- **Typical Use Cases**: Report generation, email drafting, data extraction, business process documentation
- **Cost**: Competitive pricing
- **Latency**: Very good (optimized for enterprise)

### Custom/OpenAI-Compatible Endpoints
- **Strengths**: Flexibility, private model deployment, specific fine-tuning
- **Best For**: Specialized domains, internal tools, air-gapped environments
- **Typical Use Cases**: Proprietary models, fine-tuned LLMs, specialized domain applications
- **Cost**: Varies (self-hosted or third-party)
- **Latency**: Depends on hosting

## Routing Strategies and Examples

### Example 1: Architecture Design Mission
**Goal**: "Design a microservices architecture for an e-commerce platform handling 10K RPM"

**Task Breakdown and Routing**:
1. **Requirements Analysis** (Researcher agent)
   - Task type: research, information gathering
   - Selected provider: Qwen (good balance, cost-effective for research)
   - Reason: Broad knowledge, multilingual for international sources

2. **Component Design** (Architect agent)
   - Task type: architecture, system design
   - Selected provider: OpenAI GPT-4 (strongest reasoning for complex trade-offs)
   - Reason: Superior architectural pattern recognition and systems thinking

3. **API Specification** (Backend agent)
   - Task type: technical writing, API design
   - Selected provider: Anthropic Claude (excellent at following specifications and constraints)
   - Reason: Precise adherence to REST/OpenAPI standards, clear documentation

4. **Database Schema** (Backend agent)
   - Task type: data modeling, technical specification
   - Selected provider: Qwen (good at structured outputs and technical details)
   - Reason: Strong performance on structured data tasks, cost-effective

5. **Security Review** (Security agent)
   - Task type: security analysis, threat modeling
   - Selected provider: Anthropic Claude (strong safety reasoning and constraint adherence)
   - Reason: Better at avoiding hallucinations in security contexts, follows safety guidelines

6. **Documentation Creation** (Frontend agent)
   - Task type: technical writing, tutorial creation
   - Selected provider: Qwen (good balance for explanatory content)
   - Reason: Clear explanatory style, cost-effective for longer content

### Example 2: Security Audit Mission
**Goal**: "Perform OWASP Top 10 vulnerability assessment on our REST API"

**Task Breakdown and Routing**:
1. **Information Gathering** (Researcher agent)
   - Task type: research, vulnerability database lookup
   - Selected provider: Qwen (efficient for information retrieval)
   - Reason: Good at fetching and synthesizing information from multiple sources

2. **Static Code Analysis** (Security agent)
   - Task type: security analysis, pattern matching
   - Selected provider: OpenAI GPT-4 (strong at code understanding and vulnerability detection)
   - Reason: Superior code comprehension and security pattern recognition

3. **Dependency Scanning** (DevOps agent)
   - Task type: research, version checking, vulnerability database
   - Selected provider: Qwen (cost-effective for research tasks)
   - Reason: Efficient at checking version databases and advisories

3. **Configuration Review** (DevOps agent)
   - Task type: technical review, compliance checking
   - Selected provider: Anthropic Claude (strong at following guidelines and spotting deviations)
   - Reason: Better at precise rule-following and compliance validation

4. **Report Generation** (Frontend agent)
   - Task type: technical writing, executive summary creation
   - Selected provider: Qwen (good balance for mixed technical/executive content)
   - Reason: Effective at translating technical findings to business language

5. **Remediation Planning** (Security agent)
   - Task type: planning, prioritization, risk assessment
   - Selected provider: OpenAI GPT-4 (strong at complex decision-making and prioritization)
   - Reason: Superior at weighing multiple factors and creating actionable plans

### Example 3: Code Generation Mission
**Goal**: "Create a Python FastAPI service for user authentication with JWT"

**Task Breakdown and Routing**:
1. **API Design** (Backend agent)
   - Task type: API design, technical specification
   - Selected provider: Anthropic Claude (excellent at following frameworks and conventions)
   - Reason: Strong at generating clean, framework-compliant code

2. **Endpoint Implementation** (Backend agent)
   - Task type: code generation, web development
   - Selected provider: OpenAI GPT-4 (industry-leading code generation)
   - Reason: Superior Python and FastAPI specific knowledge

3. **Database Models** (Backend agent)
   - Task type: data modeling, ORM definition
   - Selected provider: Qwen (good at structured data and schema generation)
   - Reason: Effective at generating SQLAlchemy models and migrations

4. **Unit Tests** (QA agent)
   - Task type: test generation, code testing
   - Selected provider: OpenAI GPT-4 (strong at generating meaningful test cases)
   - Reason: Better at creating tests that actually validate functionality

5. **Dockerfile Creation** (DevOps agent)
   - Task type: devops, containerization
   - Selected provider: Qwen (efficient for configuration files)
   - Reason: Good at generating standard Docker configurations

6. **Documentation** (Frontend agent)
   - Task type: technical writing, API documentation
   - Selected provider: Anthropic Claude (excellent at clear, consistent documentation)
   - Reason: Strong at producing clear, developer-friendly documentation

## Configuration and Optimization

### Environment Variables
Model routing behavior is controlled through environment variables:

```bash
# Provider Configuration
QWEN_API_KEY=your_qwen_key_here
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here

# Routing Policy
MODEL_ROUTING_POLICY=balanced  # Options: balanced, cost-optimized, quality-first, speed-optimized

# Task-Type Specific Preferences (advanced)
TASK_ROUTING_RESEARCH=qwen
TASK_ROUTING_ARCHITECTURE=openai
TASK_ROUTING_CODE_GENERATION=openai
TASK_ROUTING_SECURITY=anthropic
TASK_ROUTING_DOCUMENTATION=qwen
```

### Dynamic Policy Adjustment
Routing policies can be adjusted at runtime through the API (for organizations with appropriate permissions):

```javascript
// Example: Switch to cost-optimized policy for a specific mission
await api.updateMission(missionId, {
  metadata: {
    modelRoutingPolicy: 'cost-optimized'
  }
});

// Example: Set task-type preferences for a project
await api.updateProject(projectId, {
  metadata: {
    taskRoutingPreferences: {
      research: 'qwen',
      architecture: 'openai',
      codeGeneration: 'openai',
      security: 'anthropic',
      documentation: 'qwen'
    }
  }
});
```

### Cost Monitoring and Optimization
The system tracks usage and costs when providers report them:

```javascript
// In model router - track usage for cost optimization
async trackUsage(providerName, usage, taskType) {
  const cost = await this.calculateCost(providerName, usage);
  
  // Store usage metrics
  await pool.query(
    `INSERT INTO model_usage (provider_name, task_type, prompt_tokens, completion_tokens, 
                           total_tokens, cost_usd, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, now())`,
    [providerName, taskType, usage.promptTokens, usage.completionTokens, 
     usage.totalTokens, cost]
  );
  
  // Update organizational spending
  await pool.query(
    `UPDATE organization_metrics 
     SET monthly_ai_cost = monthly_ai_cost + $1 
     WHERE organization_id = $2`,
    [cost, organizationId]
  );
}
```

This data can be used for:
- **Monthly cost reporting** per organization/project
- **Identifying expensive task types** for optimization
- **Provider negotiations** based on actual usage data
- **Budget alerts** when approaching limits
- **Retrospective optimization** of routing policies

## Failure Handling and Honesty

### Core Principle: Never Simulate
AgentSwarm's model router adheres to a strict honesty principle:
- ❌ Never simulate or fabricate model responses when providers are unavailable
- ❌ Never guess or estimate what a model would have said
- ✅ Always report the actual status: available, unavailable, or error
- ✅ Allow missions to be blocked honestly when AI is required but unavailable
- ✅ Provide clear error messages for troubleshooting

### Failure Scenarios and Handling

#### 1. Provider Unavailable (5xx errors, timeouts)
**Detection**: Health checks fail or API calls timeout
**Response**:
- Mark provider as temporarily unavailable
- Attempt fallback providers
- If all fail, return honest error to mission orchestration
- Mission status becomes `BLOCKED` with provider status `UNAVAILABLE`

#### 2. Rate Limited (429 errors)
**Detection**: HTTP 429 responses with retry-after headers
**Response**:
- Respect rate limits and retry-after timing
- Attempt fallback providers with different rate limits
- If all providers rate-limited, mission waits or fails honestly
- Optional: Implement exponential backoff and jitter

#### 3. Invalid Request (400 errors)
**Detection**: Malformed requests, authentication errors, invalid parameters
**Response**:
- Do NOT retry (likely permanent error)
- Return clear error message for debugging
- Mission may proceed with reduced functionality if task is not critical
- Log for administrator investigation

#### 4. Quality Issues (Hallucinations, Incoherence)
**Detection**: Through verification workers or output analysis
**Response**:
- Flag output for review
- Attempt retry with different parameters (temperature, etc.)
- If persistent, consider different provider or task decomposition
- Record in verification system for model performance tracking

### Honest Status Reporting
The system status endpoint reflects real AI availability:

```json
{
  "service": "agentswarm-worker",
  "status": "LIVE",
  "timestamp": "2026-08-19T10:30:00Z",
  "components": {
    "database": "LIVE",
    "qwen": "CONFIGURED",     // Provider is set up and available
    "openai": "UNAVAILABLE",  // No API key configured
    "anthropic": "ERROR",     // API key set but service unreachable
    "redis": "LIVE",
    "verification": "LIVE",
    "tools": {
      "filesystem": "LIVE",
      "shell": "LIVE",
      "git": "LIVE",
      "web_fetch": "LIVE",
      "postgres": "LIVE",
      "artifact": "LIVE"
    }
  }
}
```

Missions requiring unavailable providers are blocked honestly:
```json
{
  "id": "mission-123",
  "goal": "Generate advanced machine learning model explanation",
  "status": "BLOCKED",
  "provider_status": "UNAVAILABLE",
  "blocked_reason": "No configured providers capable of handling this task type",
  "suggested_alternatives": [
    "Configure OpenAI API key for GPT-4 access",
    "Use simpler explanation task that Qwen can handle",
    "Break into smaller sub-tasks"
  ]
}
```

## Performance Optimization Techniques

### 1. Prompt Caching
For repetitive tasks with similar prompts:
- Cache recent prompt-completion pairs
- Return cached results when prompts are similar enough (semantic similarity or exact match)
- Particularly effective for: classification, extraction, formatting tasks
- Cache TTL: typically 15-60 minutes based on task type

### 2. Batch Processing
For non-interactive, high-volume tasks:
- Group similar tasks together
- Send as single API call when provider supports batching
- Particularly effective for: embedding generation, classification, translation
- Requires output separation and task mapping

### 3. Speculative Execution
For tasks with predictable patterns:
- Start execution with most likely provider
- Prepare fallback options in parallel
- Reduce perceived latency through overlapping I/O
- Useful for interactive applications where users initiate actions

### 4. Context Optimization
Efficient use of model context windows:
- Truncate irrelevant history
- Use summarization for long conversations
- Implement sliding window for ongoing tasks
- Compress or extract key information when possible

### 5. Token Efficiency
Minimize token usage without sacrificing quality:
- Use concise, clear prompts
- Avoid redundant information
- Implement prompt templates for recurring task types
- Leverage model strengths (e.g., some models better at instruction following than others)

## Security and Privacy Considerations

### Data Handling
- **Input Privacy**: Prompts sent to providers are not retained beyond necessary processing
- **Output Handling**: Generated content is stored only in mission context and evidence ledger
- **Logging**: Prompts and completions are NOT logged in system logs (privacy protection)
- **Metrics**: Only anonymized, aggregated usage data is retained for billing/optimization

### Provider Selection and Data Respect
- **Regional Preferences**: Can prefer providers with data centers in specific jurisdictions
- **Compliance Flags**: Providers marked with GDPR, HIPAA, SOC 2 etc. certifications
- **Data Processing Agreements**: Enterprise contracts can specify preferred providers
- **Opt-out Mechanisms**: Organizations can exclude specific providers for policy reasons

### Security Measures
- **API Key Storage**: Encrypted at rest, loaded from secure sources (environment, vaults)
- **Network Security**: TLS 1.2+ for all provider communications
- **Request Sanitization**: Input validation to prevent injection attacks
- **Response Validation**: Basic checking to ensure expected format
- **Rate Limiting**: Protection against abuse or accidental excessive usage

## Comparison with Alternatives

### vs. Static Provider Selection
| Feature | Static Selection | AgentSwarm Model Routing |
|---------|------------------|---------------------------|
| **Provider Choice** | Fixed per deployment | Dynamic per task |
| **Task Optimization** | None | Type, complexity, cost, latency aware |
| **Cost Efficiency** | Often suboptimal | Actively optimized |
| **Flexibility** | Low (requires redeploy) | High (runtime configurable) |
| **Failure Handling** | Often poor (crashes or simulates) | Honest with fallbacks |
| **Multi-Tenant** | Shared choice | Per-tenant/organization configurable |
| **Experimental** | Difficult A/B testing | Easy to test new providers |
| **Provider Lock-in** | High | Low (pluggable architecture) |

### vs. Simple Round-Robin or Random Selection
| Feature | Simple Rotation | AgentSwarm Intelligent Routing |
|---------|-----------------|-------------------------------|
| **Task Suitability** | Random | Optimized for task requirements |
| **Quality Consistency** | Variable | Consistently appropriate quality |
| **Cost Optimization** | None | Active cost reduction |
| **Latency Optimization** | None | Considers response time needs |
| **Failure Handling** | Poor (may pick failed provider) | Smart failure detection and avoidance |
| **Learning Capability** | None | Can improve based on usage patterns |
| **Complexity Handling** | Treats all tasks equal | Matches model to task complexity |

### vs. External Model Gateways (LiteLLM, etc.)
| Feature | Basic Gateways | AgentSwarm Model Router |
|---------|----------------|-------------------------|
| **Specialist Agent Integration** | Loose coupling | Tight integration with agent types |
| **Task-Type Awareness** | Limited or none | Deep task-type understanding |
| **Verification System Integration** | None | Built-in evidence and validation |
| **Routing Policy Sophistication** | Basic (round-robin, weighted) | Advanced multi-factor optimization |
| **Honest Failure Handling** | Variable (often simulates) | Strictly honest with fallbacks |
| **Usage Tracking** | Basic counting | Detailed cost and performance analytics |
| **Configuration Granularity** | Global or per-request | System/org/project/mission/task levels |
| **Provider Capability Modeling** | Simple (name matching) | Rich capability profiles and matching |
| **Fallback Intelligence** | None or basic | Sophisticated fallback chains and error handling |

## Best Practices for Effective Model Routing

### 1. Start with Clear Task Typing
- Be specific about what kind of work each task requires
- Use standard task types: research, architecture, code, security, documentation, analysis, etc.
- Avoid vague types like "work" or "processing"

### 2. Align Provider Strengths with Task Requirements
- Match reasoning-heavy tasks to strong reasoning models
- Align code generation with code-specialized models
- Pair creative writing with linguistically fluent models
- Connect factual accuracy needs to models known for precision

### 3. Consider the Full Cost-Benefit Curve
- Don't just look at sticker price—consider value delivered
- Sometimes a slightly more expensive model produces much better results
- Factor in human review time when calculating true cost
- Consider opportunity cost of delays or poor quality

### 4. Implement Feedback Loops
- Track which provider/task combinations produce best outcomes
- Use verification worker results to inform future routing decisions
- Periodically review and adjust routing policies based on performance data
- A/B test different providers for similar task types when possible

### 5. Respect Provider Limitations and Honesty
- Never try to force a provider to do something it's not good at
- Accept honest unavailability rather than seeking workarounds that reduce quality
- Use task decomposition to work within provider strengths
- Be transparent with stakeholders about AI capabilities and limitations

### 6. Optimize for Your Specific Workload
- Analyze your actual task distribution and requirements
- Tailor routing policies to your most common task types
- Consider peak vs. off-load patterns (maybe different policies for different times)
- Factor in your organization's specific priorities (cost vs. speed vs. quality)

### 7. Plan for Growth and Change
- Leave room to add new providers as they become available
- Design task types to be extensible
- Consider future needs like multimodal processing or specialized domains
- Build in mechanisms for evaluating and integrating new providers

## Future Enhancements

### 1. Predictive Routing
- Machine learning models to predict optimal provider based on historical performance
- Context-aware routing that considers recent usage and system load
- Predictive scaling based on anticipated workload patterns

### 2. Collaborative Provider Usage
- Using multiple providers in parallel for different aspects of a task
- Ensemble approaches combining strengths of multiple models
- Debate or critique models where one provider evaluates another's output

### 3. Advanced Specialization
- Provider-specific optimizations (prompt engineering, parameter tuning)
- Fine-tuned models for specific domains or task types
- Adapter layers that preprocess/postprocess for better provider performance

### 4. Real-Time Market Awareness
- Dynamic price adjustment based on provider spot pricing
- Latency-based routing using real-time network measurements
- Quality estimation based on recent provider performance signals

### 5. Enhanced Policy Expression
- Rule-based routing with complex conditions (if-then-else, weighting functions)
- Time-based policies (different rules for business hours vs. overnight)
- User preference learning based on historical choices
- SLA-based routing (guaranteed maximum latency or minimum quality)

### 6. Integration with Verification Systems
- Routing decisions informed by historical verification outcomes
- Automatic provider downgrading when verification consistently fails
- Provider promotion when consistently high-quality output is produced
- Risk-aware routing that considers verification difficulty

## Conclusion

AgentSwarm's model routing system transforms AI provider selection from a static, one-size-fits-all decision into a dynamic, intelligent process that optimizes for the specific requirements of each task. By combining a pluggable architecture with sophisticated selection logic, honest failure handling, and comprehensive usage tracking, we ensure that:

1. **Each task gets the best-suited AI provider** for its specific requirements
2. **Costs are optimized** without sacrificing necessary quality or speed
3. **Failures are handled honestly** with graceful degradation rather than simulation
4. **Organizations retain control** through configurable policies at multiple levels
5. **Usage and performance are tracked** for continuous improvement and budgeting
6. **Specialist agents can focus on their expertise** without worrying about provider details

This intelligent routing is a key enabler of AgentSwarm's ability to handle diverse workloads—from simple research tasks to complex architecture design—while maintaining consistency, reliability, and trustworthiness. Whether you're optimizing for cost, speed, quality, or a balanced approach, the model router ensures your AI workforce is always working with the right tool for the job.

Ready to see model routing in action? [Start a mission in the Command Centre](https://app.agentswarm.in) and observe how different task types are routed to different providers based on their strengths and your configuration.

## Related Resources
- [001-introduction.md](./001-introduction.md): What is AgentSwarm?
- [002-architecture.md](./002-architecture.md): Technical deep dive including specialist agents
- [003-use-cases.md](./003-use-cases.md): Real-world applications that benefit from intelligent routing
- [005-event-ledger.md](./005-event-ledger.md): How we ensure verifiable AI work regardless of provider
- [006-verification-gates.md](./006-verification-gates.md): Independent validation of AI outputs
- [apps/worker/src/models.js](../apps/worker/src/models.js): Implementation of the model router
- [DEPLOY.md](../DEPLOY.md): How to configure providers for production use