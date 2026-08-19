---
title: "What is AgentSwarm? The Complete Guide to AI Workforce Control Plane"
description: "Learn what AgentSwarm is, how it works, and why it's the leading platform for building and managing AI agent workforces. Discover features, benefits, and use cases."
date: "2026-08-19"
---

# What is AgentSwarm? The Complete Guide to AI Workforce Control Plane

## TL;DR: AgentSwarm is a control plane for AI workforces that enables you to describe a goal, decompose it into specialist agent tasks, execute with real models, require human approval for consequential actions, and verify every step with a durable event ledger.

## Quick Facts

- **Type**: AI Workforce Control Plane
- **Primary Function**: Plan, execute, and verify AI agent missions
- **Key Components**: Mission Planner, Specialist Agents, Model Router, Approval Gates, Event Ledger
- **Execution Backend**: PostgreSQL-authoritative with Redis/BullMQ coordination
- **Human Oversight**: Approval gates for consequential tasks
- **Verification**: Tamper-evident evidence ledger with cryptographic hashing
- **Open Source**: Available on [GitHub](https://github.com/CodesbyFebin/Agent-Swarm)

## Core Concept

AgentSwarm transforms how organizations leverage AI by treating AI agents as a specialized workforce. Instead of ad-hoc prompts and fragile integrations, AgentSwarm provides:

1. **Goal-Oriented Planning**: Describe what you want to achieve in natural language
2. **Specialist Agent Assignment**: Tasks are routed to agents with matching expertise (Planner, Researcher, Architect, Backend, Frontend, QA, Security, DevOps)
3. **Governed Execution**: Consequential actions require explicit human approval
4. **Durable Verification**: Every state change is persisted as a sequenced, replayable event
5. **Multi-Tenant Isolation**: Organizations and projects are strictly isolated at the data layer

## How AgentSwarm Works

### 1. Mission Creation
You describe a goal: _"Create a security review checklist for an AI worker runtime"_

### 2. Planning Phase
The Planner agent:
- Decomposes the goal into a dependency-aware task graph (typically 3-12 tasks)
- Validates the plan with Zod schemas
- Checks for cycles and optimizes execution order
- Persists the plan to PostgreSQL

### 3. Task Routing
Each task is assigned to a specialist agent based on the task's requirements:
- Research tasks → Researcher agent
- Code tasks → Backend/Frontend agents
- Security analysis → Security agent
- Infrastructure tasks → DevOps agent

### 4. Model Integration
AgentSwarm uses a provider-neutral adapter that:
- Talks to any OpenAI-compatible endpoint
- Ships with Qwen support by default
- Honestly reports when providers are unavailable (never simulates)

### 5. Human Approval Gates
Tasks can declare:
- `requiresApproval`: Boolean flag
- `riskLevel`: LOW, MEDIUM, HIGH, CRITICAL

When reached, the task:
- Genuinely stops in `WAITING_APPROVAL` state
- Creates a persisted approval record
- Requires an operator with appropriate role to approve or reject
- Only resumes on explicit approval

### 6. Execution & Verification
- Tasks execute with real models and tools
- Every state change is an event in the PostgreSQL event ledger
- Events are streamed via Server-Sent Events with durable backlog replay
- Completion requires verification of real artifact existence

## Key Features

### Dynamic Mission Planning
Unlike hard-coded workflows, AgentSwarm's planner creates custom task graphs for each goal, ensuring optimal execution paths.

### Eight Specialist Agents
Each agent type has deep expertise in its domain, ensuring high-quality output for specialized tasks.

### Real Event Ledger
The system of record is a PostgreSQL-backed event stream, not client-side timers or simulations. This enables:
- True reproducibility
- Audit trails
- Recovery from worker crashes
- Cross-organization transparency

### Governed Approvals
Consequential actions (like code deployment or data modification) cannot proceed without explicit human oversight, reducing risk in AI-driven operations.

### Durable Dispatch
Postgres row-level locking (`FOR UPDATE SKIP LOCKED`) is the sole authority on task claims, with Redis/BullMQ providing low-latency wake-up signals. This architecture survives real Redis outages and worker crashes.

### Multi-Tenant by Design
Every mission belongs to exactly one organization and project. Cross-organization access returns genuine 404 errors, not hidden UI elements with data leakage.

## Benefits

### For Engineering Teams
- **Reduced Context Switching**: AI handles routine tasks, freeing engineers for complex problems
- **Increased Reliability**: Deterministic execution with verification gates
- **Faster Delivery**: Parallel execution of independent tasks
- **Better Compliance**: Immutable audit trails for all AI actions

### For Business Leaders
- **Predictable Outcomes**: Work completes as designed, not subject to AI whims
- **Risk Mitigation**: Human approval gates prevent unauthorized actions
- **Resource Optimization**: AI workforce scales with demand
- **Transparent ROI**: Clear metrics on AI utilization and output quality

### For AI Practitioners
- **Focus on Innovation**: Spend less time on plumbing, more on novel AI applications
- **Best Practices Built-In**: Zod validation, approval patterns, event sourcing
- **Community & Ecosystem**: Share and reuse mission templates and agent skills

## Use Cases

AgentSwarm excels at scenarios requiring:
- Complex, multi-step reasoning
- Integration with existing systems (databases, APIs, file systems)
- High-stakes decisions requiring human oversight
- Reproducible, auditable AI operations
- Team collaboration on AI-driven projects

Common applications include:
- Architecture review and design
- Security audit and compliance checking
- Research synthesis and report generation
- Code generation and refactoring
- Data analysis and visualization
- Technical documentation creation
- Migration planning and execution
- Incident response and post-mortem analysis

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- (Optional) Redis 7+ for reduced dispatch latency
- (Optional) Qwen API key for model access

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/CodesbyFebin/Agent-Swarm.git
   cd Agent-Swarm
   ```

2. Install dependencies:
   ```bash
   npm ci
   ```

3. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your database connection and optional Qwen credentials
   ```

4. Initialize database:
   ```bash
   npm run migrate
   ```

5. Start the development environment:
   ```bash
   npm run dev
   ```

### Production Deployment
See [DEPLOY.md](DEPLOY.md) for instructions on deploying to Fly.io or other platforms.

## Frequently Asked Questions

### Is AgentSwarm real or just a demo?
AgentSwarm is real. There are no client-side timers or random-number engines driving progress. The backend owns the authoritative state, verified by deliberately creating missions during real Redis outages and killed worker processes.

### What happens if a model provider isn't configured?
The mission is persisted and honestly moves to `BLOCKED` status with provider status `UNAVAILABLE`. It is never simulated as running or completed.

### How does approval actually work?
When a task requires approval, it genuinely stops in `WAITING_APPROVAL` until an operator with the appropriate role decides. Approval resumes the exact task; rejection fails the mission.

### Is there real multi-tenancy?
Yes. Every mission belongs to exactly one organization and project, assigned server-side from verified membership checks. Users outside that organization get genuine 404s on missions.

### What isn't built yet?
The public roadmap includes:
- MCP tool registry and gateway
- Sandboxed / isolated task workspaces
- Persistent memory and reusable skills
- Scheduler for recurring or webhook-triggered missions
- Cost engine backed by real provider-reported usage
- Richer verification gates (build, typecheck, security scan, accessibility)

## Conclusion

AgentSwarm represents a new paradigm in AI application development: treating AI as a governed workforce rather than a mystical black box. By combining specialist agents, human oversight, and durable verification, it enables organizations to reliably leverage AI for complex, consequential work.

Ready to build your first AI workforce? [Start with the Command Centre](https://app.agentswarm.in) or [deploy your own instance](https://github.com/CodesbyFebin/Agent-Swarm).

## Related Pillars
- [002-architecture.md](./002-architecture.md): Deep dive into AgentSwarm's technical architecture
- [003-use-cases.md](./003-use-cards.md): Detailed examples of AgentSwarm in action
- [010-model-routing.md](./010-model-routing.md): How AgentSwarm routes tasks to different AI providers
- [025-event-ledger.md](./025-event-ledger.md): The technical details of our durable event sourcing system