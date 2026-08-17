# AgentSwarm

**The control plane for governed AI workforces.**

> One goal. A governed swarm. Verified work.

AgentSwarm is an AI workforce control plane for planning missions, coordinating specialist agents, observing execution, approving sensitive actions, collecting evidence, verifying results, and producing auditable artifacts.

🌐 **Website:** https://agentswarm.in

## Product model

```text
USER GOAL
   ↓
MISSION
   ↓
PLAN / TASK DAG
   ↓
SPECIALIST AGENTS
   ↓
MODEL ROUTER
   ↓
TOOLS / MCP
   ↓
SANDBOXED EXECUTION
   ↓
POLICY + APPROVALS
   ↓
EVIDENCE
   ↓
VERIFICATION
   ↓
ARTIFACTS
   ↓
AUDIT / REPLAY
```

The fundamental unit of work is a **Mission**. A mission decomposes a user goal into dependency-aware tasks that can run sequentially or in parallel across specialist agents.

## Core principles

- **Observable by default** — show what each agent did, with which tool, at what cost, and with what result.
- **Governed execution** — sensitive actions pass through explicit policy and approval gates.
- **Evidence before trust** — outputs can be tied to sources, tool results, verification events, and artifacts.
- **Provider neutral** — agents request capabilities; a model router decides the provider/model according to policy, cost, privacy, quality, and availability.
- **Sandbox first** — execution contexts isolate filesystem, network, credentials, tools, and memory.
- **Durable mission state** — the UI is a projection of runtime state, not the runtime itself.
- **Replayable work** — mission events form an audit trail that can be inspected and replayed.
- **Transparent environments** — LIVE, CONNECTED, VERIFIED, SIMULATED, FIXTURE, UNAVAILABLE, and UNKNOWN states must remain clearly distinguishable.

## Mission lifecycle

```text
DRAFT
→ QUEUED
→ PLANNING
→ RUNNING
→ WAITING_APPROVAL
→ RUNNING
→ VERIFYING
→ COMPLETED
```

Additional terminal/control states include `PAUSED`, `FAILED`, and `CANCELLED`.

## Task lifecycle

```text
DRAFT
→ QUEUED
→ BLOCKED / READY
→ LEASED
→ RUNNING
→ WAITING_APPROVAL
→ RETRY_WAIT
→ SUCCEEDED
```

Terminal states include `FAILED`, `CANCELLED`, and `DEAD_LETTER`.

Production task execution should track distinct `TaskRun`, `TaskAttempt`, `TaskLease`, `TaskResult`, `Evidence`, and `Approval` records so worker crashes, retries, and duplicate execution can be handled safely.

## Canonical specialist agents

The default UI taxonomy includes:

- Planner
- Research Analyst
- Architect
- Backend Developer
- Frontend Developer
- QA Engineer
- Security Reviewer
- DevOps Engineer

These roles are not hard-coded runtime limits. Each agent should be defined by a combination of capabilities, tools, policies, memory scope, model policy, sandbox, and budget.

## Event-driven Command Centre

The Command Centre should be a projection of durable domain events such as:

```text
mission.created
mission.planned
task.created
task.ready
task.started
agent.started
tool.called
tool.completed
approval.requested
approval.granted
approval.rejected
task.completed
verification.started
verification.passed
artifact.created
mission.completed
```

This enables live updates, auditability, recovery, debugging, historical timelines, and Mission Replay.

## Approval Center

Approval is a core product primitive, not a secondary feature.

Examples of gated actions:

- external network access
- write/destructive filesystem operations
- credential or secret access
- database mutation
- git commit/push
- deployment
- production configuration changes

Suggested policy levels:

```text
LOW      → automatic
MEDIUM   → policy-based
HIGH     → human approval
CRITICAL → explicit human approval
```

## Evidence and verification

AgentSwarm aims to connect execution to evidence:

```text
MISSION
  ↓
TASK
  ↓
AGENT
  ↓
ACTION
  ↓
TOOL
  ↓
INPUT / OUTPUT
  ↓
EVIDENCE
  ↓
VERIFICATION
  ↓
ARTIFACT
```

A mission should not be considered complete merely because an agent reports completion. `VERIFYING` is a first-class state and production acceptance gates may include build, typecheck, unit tests, integration tests, security checks, accessibility, performance, and explicit acceptance criteria.

## MCP and tool layer

MCP and native tools sit behind a governed tool gateway.

Connector health should support states such as:

```text
DISCOVERED
AUTHENTICATING
CONNECTED
DEGRADED
DISCONNECTED
ERROR
RATE_LIMITED
UNAVAILABLE
```

A connected state alone must not imply that every capability is healthy or authorized. Track capabilities, authorization, last successful call, latency, and error rate independently.

## Model routing

AgentSwarm should avoid coupling roles to fixed model names. Tasks request capabilities and policy constraints; the model router selects an appropriate provider/model using signals such as:

- capability
- reasoning/coding quality
- context window
- latency
- cost
- privacy
- availability
- organizational policy

## Memory scopes

Production memory should be explicitly scoped:

- User Memory
- Project Memory
- Organization Memory
- Mission Memory
- Agent Memory
- Skill Memory
- Evidence Memory
- Policy Memory

Agents may learn operational knowledge, but must not silently rewrite governance policy.

## Skills

A **Skill** is a reusable, verified workflow with provenance and performance history.

```text
Mission
  ↓
Successful execution
  ↓
Verified workflow
  ↓
Skill candidate
  ↓
Human approval
  ↓
Skill registry
  ↓
Future missions
```

A skill can define its trigger, required tools, steps, inputs, outputs, success criteria, verification requirements, version, provenance, and performance history.

## Target architecture

```text
                         AgentSwarm
                AI Workforce Control Plane
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
        Intent API      Mission Engine    User Workspace
                             │
                         Plan / DAG
                             │
                     Swarm Orchestrator
               ┌─────────────┼─────────────┐
               ▼             ▼             ▼
            Agent A       Agent B       Agent C
               └─────────────┼─────────────┘
                             ▼
                        Model Router
                             │
                         Tool Gateway
                    ┌────────┴────────┐
                    ▼                 ▼
                   MCP            Native Tools
                    └────────┬────────┘
                             ▼
                        Execution
                    ┌────────┴────────┐
                    ▼                 ▼
                 Sandbox            Policy
                    └────────┬────────┘
                             ▼
                       Evidence Ledger
                             │
                         Verification
                             │
                           Artifacts
                             │
                        Domain Events
                             │
                          SSE / WS
                             │
                     Command Centre UI
```

## Development status

AgentSwarm is under active development. Demo/simulated environments must remain clearly labeled and must never be presented as proof of real external execution or deployment.

Production integrations planned around the control plane include model providers, MCP servers, native tools, source control, sandboxes, persistent state, event streaming, approval policies, evidence capture, and deployment infrastructure.

## Repository

This repository is the canonical development home for **AgentSwarm / AgentSwarm.in**.

Default branch: `main`

## Security

Do not commit API keys, access tokens, private credentials, or production secrets. Use environment variables or a managed secret store, enforce least privilege for tools and agents, and require explicit approval for high-risk actions.

## License

License terms will be added before the first public release.
