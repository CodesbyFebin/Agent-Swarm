# QWEN STUDIO — AGENTSWARM.IN PRODUCTION MASTER BUILD PROMPT

You are the **principal product engineer, distributed-systems architect, AI-agent infrastructure engineer, security engineer, and senior product designer** responsible for turning the existing AgentSwarm prototype into a **real production-capable full-stack web and mobile application**.

## PROJECT

**Product:** AgentSwarm  
**Domain:** `https://agentswarm.in`  
**Repository:** `https://github.com/CodesbyFebin/Agent-Swarm`

**Category:** AI Workforce Control Plane / Multi-Agent Mission Orchestration

**Primary promise:**

> One goal. A governed swarm. Verified work.

**Secondary promise:**

> Plan work. Deploy specialists. Observe execution. Approve actions. Verify results.

---

# 0. ABSOLUTE BUILD RULE

DO NOT create another demo.

DO NOT create only a frontend.

DO NOT create only a dashboard mockup.

DO NOT use timers or random values to imitate agent execution.

DO NOT use:

```text
setInterval → random progress → fake completion
```

as the runtime.

DO NOT fabricate:

- model calls
- token counts
- costs
- tool executions
- MCP connections
- GitHub operations
- filesystem operations
- browser actions
- Docker execution
- deployments
- tests
- evidence
- verification
- latency
- health
- authentication
- database state

If something is not connected, display:

```text
UNAVAILABLE
NOT CONFIGURED
DISCONNECTED
UNKNOWN
```

Never display it as LIVE.

The existing UI prototype is the **design/product reference only**.

Replace its simulated runtime with a **real persistent backend architecture**.

---

# 1. END RESULT

Build a genuine AgentSwarm platform consisting of:

```text
AgentSwarm
│
├── Production Web App
├── Native Mobile App
├── API
├── Mission Engine
├── Scheduler
├── Worker Runtime
├── Agent Runtime
├── Model Router
├── Tool Gateway
├── MCP Gateway
├── Sandbox Manager
├── Approval Engine
├── Policy Engine
├── Evidence Ledger
├── Verification Engine
├── Artifact Store
├── Memory System
├── Skills Registry
├── Event Store
├── Realtime Gateway
├── Authentication
├── Organization / Project tenancy
├── Cost & Usage Accounting
└── Audit System
```

The application must work after configuration.

A user must be able to:

1. Sign up.
2. Create an organization/project.
3. Create a mission.
4. Send a real goal to the backend.
5. Generate a plan.
6. Persist the mission.
7. Generate task dependencies.
8. Assign agents.
9. Queue executable tasks.
10. Execute real AI model requests.
11. Execute configured tools.
12. Connect configured MCP servers.
13. stream real runtime events.
14. pause/resume/cancel missions.
15. request approval for consequential operations.
16. approve/reject from web or mobile.
17. collect evidence.
18. run verification gates.
19. generate artifacts.
20. preserve mission history.
21. replay previous execution.
22. inspect actual token/cost usage.
23. promote successful workflows into reusable Skills.

---

# 2. MONOREPO

Create a clean production monorepo.

Recommended structure:

```text
Agent-Swarm/
│
├── apps/
│   ├── web/
│   ├── mobile/
│   ├── api/
│   ├── worker/
│   └── scheduler/
│
├── packages/
│   ├── domain/
│   ├── database/
│   ├── auth/
│   ├── events/
│   ├── agent-runtime/
│   ├── model-router/
│   ├── tool-gateway/
│   ├── mcp/
│   ├── sandbox/
│   ├── policy/
│   ├── evidence/
│   ├── verification/
│   ├── memory/
│   ├── skills/
│   ├── storage/
│   ├── sdk/
│   ├── ui/
│   └── config/
│
├── infra/
│   ├── docker/
│   ├── migrations/
│   └── deployment/
│
├── tests/
├── docs/
├── docker-compose.yml
├── .env.example
├── README.md
└── package.json
```

Use TypeScript across the application unless a component genuinely benefits from another runtime.

Use a workspace package manager and enforce:

```text
typecheck
lint
test
build
```

from the repository root.

---

# 3. REFERENCE STACK

Use a maintainable production stack.

## Web

Use:

```text
Next.js
React
TypeScript
Tailwind CSS
accessible component primitives
```

Preserve AgentSwarm's high-density technical control-plane appearance.

## Mobile

Build an actual mobile application using:

```text
React Native
Expo
TypeScript
```

The mobile app must consume the same API as the web application.

Do not simply wrap the website in a WebView.

## API

Use a dedicated TypeScript backend.

Preferred:

```text
Fastify or an equivalent production Node API framework
Zod validation
structured logging
OpenAPI
```

Do not put the entire runtime inside Next.js API routes.

## Persistent storage

Use:

```text
PostgreSQL
```

with versioned migrations.

Use a TypeScript ORM/query layer such as Drizzle.

## Queue and transient state

Use:

```text
Redis
BullMQ or an equivalent durable job queue
```

## Object storage

Provide an abstraction supporting:

```text
S3-compatible storage
MinIO for self-hosted deployments
```

Use it for:

- uploads
- agent artifacts
- reports
- screenshots
- generated files
- verification outputs

---

# 4. REAL DOMAIN MODEL

Do not keep mission state inside React.

Persist it.

Create entities resembling:

```text
User
Organization
Membership
Project

Mission
MissionRun

Task
TaskDependency
TaskRun
TaskAttempt
TaskLease
TaskResult

AgentProfile
AgentInstance
AgentCapability
AgentPolicy

ModelProvider
ModelPolicy
ModelRoute
ModelInvocation

Connector
MCPServer
MCPTool
ToolInvocation

Sandbox
SandboxExecution

ApprovalRequest
ApprovalDecision

EvidenceSource
EvidencePassage
Claim
ClaimRelation

VerificationRun
VerificationGate

Artifact
ArtifactVersion

Memory
MemoryScope

Skill
SkillVersion
SkillRun

Schedule

UsageRecord
Budget

DomainEvent
AuditEvent

SecretMetadata
```

Every tenant-owned row must include appropriate organization/project ownership.

Never trust an `organizationId` supplied by the frontend without verifying membership server-side.

---

# 5. MISSION LIFECYCLE

Implement mission states as a durable state machine:

```text
DRAFT
QUEUED
PLANNING
RUNNING
WAITING_APPROVAL
PAUSED
VERIFYING
COMPLETED
FAILED
CANCELLED
```

Normal path:

```text
DRAFT
  ↓
QUEUED
  ↓
PLANNING
  ↓
RUNNING
  ↓
WAITING_APPROVAL
  ↓
RUNNING
  ↓
VERIFYING
  ↓
COMPLETED
```

Transitions must occur on the backend.

Every transition must create a domain event.

Invalid transitions must be rejected.

Example:

```text
COMPLETED → RUNNING
```

must not silently succeed.

---

# 6. TASK RUNTIME

Implement distributed-runtime task states:

```text
DRAFT
QUEUED
BLOCKED
READY
LEASED
RUNNING
WAITING_APPROVAL
RETRY_WAIT
SUCCEEDED
FAILED
CANCELLED
DEAD_LETTER
```

Maintain separate concepts for:

```text
Task
TaskRun
TaskAttempt
TaskLease
TaskResult
```

This is mandatory.

A worker crash must not corrupt mission state.

Implement:

- durable leases
- lease expiry
- heartbeat
- retries
- attempt counters
- configurable backoff
- maximum retry limit
- dead-letter state
- idempotency
- cancellation
- timeout
- failure propagation

Multiple workers must be capable of running concurrently.

---

# 7. TASK DAG

Retain the visual DAG concept from the current AgentSwarm interface.

Default software-development swarm may use:

```text
Requirements & Discovery
        │
        ├────────────────┐
        ▼                ▼
 Architecture         Research
        │                │
        └────────┬───────┘
                 ▼
              Backend
              /     \
             /       \
       Frontend       Other Work
             \       /
                 QA
                  │
              Security
                  │
              Deployment
```

But **do not hard-code this DAG as the architecture**.

The planner must be able to generate different DAGs depending on the mission.

Persist dependencies in the database.

A task becomes `READY` only when dependency conditions are satisfied.

Parallel execution should occur naturally where dependencies permit.

---

# 8. AGENT ARCHITECTURE

Keep these built-in AgentSwarm personas as presets:

```text
Planner
Research Analyst
Architect
Backend Developer
Frontend Developer
QA Engineer
Security Reviewer
DevOps Engineer
```

But implement the underlying architecture as:

```text
Agent Profile
      +
Capabilities
      +
Tools
      +
Model Policy
      +
Permissions
      +
Memory Scope
      +
Budget
      +
Sandbox Policy
```

A user must later be able to create custom agents such as:

```text
SEO Auditor
Financial Analyst
Security Auditor
MCP Auditor
Legal Researcher
Content Strategist
Data Analyst
Growth Analyst
```

without modifying frontend code.

---

# 9. REAL AI MODEL ROUTER

Create a provider-neutral model router.

Start with adapters for:

```text
Qwen / Qwen Model Studio
OpenAI
Anthropic
OpenAI-compatible APIs
Ollama / local models
```

Only enable providers that have credentials configured.

Provider configuration must come from environment/secrets.

Never embed API keys in frontend code.

Tasks should request capabilities rather than specific model names.

Example:

```text
role: architect
capability: reasoning
quality: high
latency: normal
privacy: standard
budget: 0.50
```

The router decides the provider/model using:

```text
capability
quality
context requirement
availability
latency
price
privacy policy
organization policy
remaining budget
```

Store actual invocation metadata:

```text
provider
model
request timestamp
response timestamp
latency
input tokens
output tokens
cached tokens if available
provider request ID
estimated cost
actual provider cost when available
status
error
```

Do not manufacture token numbers.

If the provider does not return usage, store:

```text
UNKNOWN
```

instead of inventing it.

---

# 10. QWEN INTEGRATION

Because this project is being built in Qwen Studio, create a proper Qwen provider adapter.

Credentials must be configured through server environment/secrets.

Implement:

```text
health check
model invocation
streaming
structured output
timeouts
retry policy
usage recording
error normalization
```

Use structured JSON output for planning when supported.

Validate all model-generated structured output before persisting it.

A model must never be allowed to directly mutate mission state without validation by the orchestrator.

---

# 11. ORCHESTRATOR

Create a real Swarm Orchestrator.

Responsibilities:

```text
Goal
 ↓
Planning
 ↓
Plan validation
 ↓
Task DAG creation
 ↓
Dependency resolution
 ↓
Agent selection
 ↓
Model routing
 ↓
Task scheduling
 ↓
Tool execution
 ↓
Approval checks
 ↓
Evidence capture
 ↓
Verification
 ↓
Artifacts
 ↓
Completion
```

The orchestrator is authoritative.

The frontend is only a projection of backend state.

---

# 12. TOOL GATEWAY

Create a unified Tool Gateway.

Tool contract should include:

```text
id
name
description
schema
source
risk
permissions
timeout
requiresApproval
execute()
```

Support built-in tools through adapters.

Examples:

```text
http.fetch
filesystem.read
filesystem.write
shell.execute
git.status
git.diff
git.commit
git.push
browser.navigate
browser.extract
database.query
artifact.write
```

Do not expose dangerous tools without policy enforcement.

Record each execution:

```text
tool
task
agent
input
sanitized output
startedAt
finishedAt
duration
status
risk
approval
error
artifact/evidence references
```

Sensitive values must be redacted from logs.

---

# 13. MCP GATEWAY

Implement genuine server-side MCP connectivity through the supported MCP SDK/protocol implementation.

Support appropriate configured transports through adapters.

The MCP system must expose:

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

For every MCP server show:

```text
name
transport
health
capabilities
tools
authorization state
last successful call
latency
error rate
last error
```

Tool discovery must come from the actual connected MCP server.

Never populate fake tools for a LIVE connector.

Maintain strict distinction between:

```text
LIVE connector
FIXTURE connector
UNAVAILABLE connector
```

---

# 14. SANDBOX EXECUTION

Build a Sandbox abstraction.

Initial self-hosted implementation should support isolated Docker execution when Docker is configured.

Each task execution context should include:

```text
sandbox ID
mission
task
filesystem scope
workspace
network policy
environment
CPU limit
memory limit
timeout
tool permissions
secret references
```

Default security:

```text
network = denied/restricted
filesystem = task/project scoped
privileged = false
host mounts = none unless explicitly authorized
secrets = minimal
```

A missing Docker/runtime connection must show:

```text
SANDBOX UNAVAILABLE
```

Do not pretend one exists.

---

# 15. APPROVAL ENGINE

Approval Center is a primary product surface.

Risk levels:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

Default policy:

```text
LOW      → automatic if policy permits
MEDIUM   → configurable
HIGH     → human approval
CRITICAL → explicit human approval
```

Examples requiring approval:

```text
external network request
write outside authorized workspace
git commit
git push
deployment
database mutation
secret access
production action
destructive shell command
billing action
privilege escalation
```

Approval request must store:

```text
mission
task
agent
action
tool
risk
reason
scope
request payload summary
createdAt
expiresAt
status
```

Decision must store:

```text
approved/rejected
user
timestamp
reason
```

The blocked task must genuinely wait.

Approve must resume execution.

Reject must cause the configured rejection path.

Support approvals from both web and mobile.

---

# 16. MOBILE APPROVALS

Implement mobile push notification support through an adapter.

Example notification:

```text
AgentSwarm Approval Required

Security Reviewer requests external network access.

Risk: HIGH
Mission: Build Analytics Platform
```

Tapping opens the exact approval.

Provide:

```text
Approve
Reject
Inspect
```

Require authenticated server-side authorization before accepting the decision.

Never approve based only on a client-side state update.

---

# 17. EVENT STORE

Every meaningful runtime operation must produce a DomainEvent.

Examples:

```text
mission.created
mission.queued
mission.planning_started
mission.planned
mission.started

task.created
task.ready
task.leased
task.started
task.retrying
task.failed
task.completed

agent.started
agent.completed

model.started
model.completed
model.failed

tool.called
tool.completed
tool.failed

approval.requested
approval.granted
approval.rejected

evidence.created
claim.created

artifact.created

verification.started
verification.gate_passed
verification.gate_failed
verification.completed

mission.completed
mission.failed
mission.cancelled
```

Events must contain:

```text
eventId
sequence
organizationId
projectId
missionId
taskId?
agentId?
type
payload
createdAt
traceId
```

Use monotonically ordered mission sequence numbers.

---

# 18. REALTIME SYSTEM

The Command Centre must update from the backend in real time.

Use:

```text
SSE
and/or
WebSocket
```

with:

- reconnect
- cursor/sequence resume
- duplicate suppression
- missed-event replay
- heartbeat
- authorization
- project/mission scoping

Do not poll every 800ms to simulate work.

The client architecture should be:

```text
Runtime
   ↓
Domain Events
   ↓
Event Store
   ↓
Realtime Gateway
   ↓
Client State Projector
   ↓
Command Centre
```

---

# 19. MISSION REPLAY

Create a real Mission Replay view from stored events.

Allow:

```text
Play
Pause
Previous
Next
Jump to event
Change speed
Reset
```

Show:

```text
Goal
Plan
Tasks
Agents
Model calls
Tool calls
Approvals
Retries
Evidence
Artifacts
Verification
Completion
```

Replay must not rerun the mission.

It replays immutable historical events.

---

# 20. EVIDENCE LEDGER

Implement a proper evidence system.

Structure:

```text
SOURCE
 ↓
PASSAGE
 ↓
CLAIM
 ↓
SUPPORT / CONTRADICTION
 ↓
AGENT INFERENCE
 ↓
CONFIDENCE
 ↓
DECISION
```

Store:

```text
source URL
canonical URL
title
publisher
retrieval timestamp
retrieval method
content hash
passage
claim relationships
confidence
task
agent
```

Do not display demo-corpus records as LIVE research.

For live research, evidence must originate from actual tool/model retrieval.

---

# 21. VERIFICATION ENGINE

Mission completion must not mean:

```text
agent says "done"
```

Introduce a first-class:

```text
VERIFYING
```

state.

Verification gates can include:

```text
BUILD
TYPECHECK
LINT
UNIT TEST
INTEGRATION TEST
E2E TEST
SECURITY
ACCESSIBILITY
PERFORMANCE
ACCEPTANCE CRITERIA
CUSTOM
```

Each gate stores:

```text
status
command/check
startedAt
finishedAt
exit code
evidence
output
artifact
```

Mission becomes `COMPLETED` only when its required verification policy succeeds.

If a check did not run, show:

```text
NOT RUN
```

Never fabricate green checks.

---

# 22. ARTIFACT SYSTEM

Artifacts are first-class objects.

Examples:

```text
Generated Code
Research Report
Architecture Document
Test Report
Security Report
Dataset
Deployment Manifest
Screenshot
Build Output
```

Store:

```text
artifact ID
mission
task
creator
type
name
version
object-storage location
hash
mime type
size
verification status
createdAt
```

Support preview/download where appropriate.

Keep versions.

---

# 23. MEMORY SYSTEM

Implement scoped memory.

Scopes:

```text
USER
ORGANIZATION
PROJECT
MISSION
AGENT
SKILL
EVIDENCE
```

Memory requires:

```text
content
scope
source
createdBy
createdAt
confidence
provenance
```

Important governance rule:

> Agents may learn operational knowledge. Agents may not silently rewrite organization governance policy.

Users must be able to:

```text
view
edit
delete
pin
disable
```

memory where policy permits.

---

# 24. SKILLS REGISTRY

A Skill is a reusable verified workflow.

Create:

```text
Skill
 ├── name
 ├── description
 ├── trigger
 ├── inputs
 ├── outputs
 ├── capabilities
 ├── required tools
 ├── workflow
 ├── success criteria
 ├── verification
 ├── provenance
 ├── version
 └── performance history
```

Flow:

```text
Successful Mission
 ↓
Verified workflow
 ↓
Skill Candidate
 ↓
Human Review
 ↓
Skill Version
 ↓
Reusable execution
```

Do not automatically promote every successful task.

---

# 25. WEB APPLICATION

Retain the existing AgentSwarm design language.

## Desktop shell

Use:

```text
Top Global Bar

Left:
Navigation

Center:
Active Workspace

Right:
Inspector

Bottom:
Mission/runtime context where useful
```

Primary navigation:

```text
COMMAND
- Command Centre
- Swarms
- Tasks
- Sessions

WORKSPACE
- Code
- Terminal
- Browser

INTELLIGENCE
- Memory
- Skills

INFRASTRUCTURE
- MCP
- Schedules
- Sandboxes

SYSTEM
- Security
- Settings
```

These must become actual routes/screens rather than decorative placeholders.

---

# 26. COMMAND CENTRE

No active mission:

```text
Good evening.

What shall we build today?

[ Describe a goal... ]

Attach

INSTANT
THINK
AGENT
SWARM
AUTO

Start Mission
```

Default:

```text
SWARM
```

When a mission starts, show:

```text
Mission title
Status
Elapsed time
Progress
Active agents
Tasks
Approvals
Actual/estimated cost
Budget
```

Main tabs:

```text
Overview
Tasks
Workspace
Activity
Evidence
Verification
Artifacts
Replay
```

Inspector:

```text
Agents
Trace
Evidence
Approvals
Cost
```

---

# 27. TASK GRAPH UI

Build a genuinely interactive graph.

Clicking a task opens:

```text
Task
State
Dependencies
Dependents
Agent
Attempt
Lease
Model
Tools
Logs
Evidence
Approval
Output
Verification
Cost
Timeline
```

Active nodes may glow subtly.

Use semantic state colors:

```text
green  = succeeded
blue   = running
amber  = waiting
purple = approval
red    = failed
gray   = inactive
```

Do not turn the DAG into a decorative diagram.

---

# 28. AGENT INSPECTOR

Agent detail:

```text
Name
Role
Capabilities
Status
Current task
Model route
Sandbox
Tools
Permissions
Network policy
Memory
Token usage
Cost
Runtime
Latest action
```

Clearly distinguish:

```text
LIVE
FIXTURE
UNKNOWN
UNAVAILABLE
```

for every telemetry field.

---

# 29. ACTIVITY TRACE

Create high-density observable trace UI.

Filters:

```text
All
Missions
Tasks
Agents
Models
Tools
Approvals
Evidence
Verification
Errors
```

Each row:

```text
timestamp
sequence
actor
event
task
status
duration
trace ID
```

Clicking an event opens its structured payload.

---

# 30. COST INSPECTOR

Show actual collected usage where provider data exists.

Separate:

```text
Estimated
Actual
Reserved
Budget
Remaining
```

Break down by:

```text
mission
agent
provider
model
task
tool
```

Do not use constant fixture price increments.

When pricing information is unavailable:

```text
Actual cost: UNKNOWN
```

---

# 31. WORKSPACE

Create a real project workspace.

Represent:

```text
Project
├── Repository
├── Branch
├── Files
├── Artifacts
├── Environments
├── Runs
├── Missions
├── Skills
└── Integrations
```

Code workspace should support:

```text
file browser
file preview
diff view
artifact preview
terminal execution output
agent ownership
version history
```

Only expose editing/execution if the configured sandbox/tool policy permits it.

---

# 32. GITHUB INTEGRATION

Implement GitHub through a proper server-side integration.

Support:

```text
connect account/app
select repository
read repository
branch
status
diff
commit proposal
push proposal
PR proposal
```

High-risk write actions must pass Approval Engine policy.

Never label GitHub CONNECTED unless authentication and a health request succeed.

---

# 33. MOBILE APP

Mobile is a first-class client.

Do not shrink desktop.

Bottom navigation:

```text
Home
Missions
New
Agents
More
```

## Mobile Home

Show:

```text
Current mission
Status
Progress
Active agents
Pending approvals
Tasks
Recent events
Budget
```

## Mission screen

Use:

```text
summary
task list
compact DAG
activity
evidence
artifacts
verification
```

## Inspector

Open as a bottom sheet.

## Approvals

Large touch-friendly:

```text
REJECT
APPROVE
```

## Mobile requirements

Implement:

```text
secure token storage
deep links
push notifications
reconnect handling
offline cached mission list
loading skeletons
error boundaries
pull to refresh where useful
biometric re-auth for critical approvals if available
```

Do not store API/provider secrets on the device.

---

# 34. AUTHENTICATION

Implement genuine authentication.

Support at minimum:

```text
email/password or email sign-in
secure session handling
logout
password recovery when applicable
```

Architecture must support OAuth providers.

Use:

```text
httpOnly cookies on web where appropriate
secure token storage on mobile
CSRF protection where applicable
rate limiting
session revocation
```

Create:

```text
Organization
Membership
Roles
```

Suggested roles:

```text
OWNER
ADMIN
OPERATOR
MEMBER
VIEWER
```

Approval permissions must be role-aware.

---

# 35. SECRETS

Never store plaintext provider secrets in ordinary tables.

Create a secrets-provider abstraction.

Store only metadata/reference in normal DB records.

Support secure environment-based secrets initially and leave a clean adapter for external vaults.

Logs must redact:

```text
API keys
tokens
cookies
authorization headers
private keys
database passwords
secret environment variables
```

---

# 36. SECURITY

Treat all agent-generated content as untrusted.

Protect against:

```text
prompt injection
tool injection
path traversal
command injection
SSRF
arbitrary network access
cross-tenant data leaks
malicious MCP responses
oversized payloads
secret exfiltration
unsafe file writes
unsafe shell commands
replay attacks
approval spoofing
```

Implement:

```text
input validation
output validation
authorization checks
resource limits
rate limiting
audit logs
secure headers
CORS policy
request IDs
structured errors
redaction
```

No wildcard production permissions.

---

# 37. AUDIT LEDGER

Consequential activity must produce immutable audit entries.

Record:

```text
actor
action
resource
before/after where appropriate
reason
IP/session metadata where appropriate
timestamp
trace ID
```

Audit:

```text
login
membership change
secret/config changes
mission cancellation
approval decisions
tool authorization
git writes
deployment actions
policy changes
skill promotion
```

---

# 38. API

Create a documented API.

Representative routes:

```text
POST   /auth/...
GET    /me

GET    /projects
POST   /projects

POST   /missions
GET    /missions
GET    /missions/:id
POST   /missions/:id/pause
POST   /missions/:id/resume
POST   /missions/:id/cancel

GET    /missions/:id/tasks
GET    /missions/:id/events
GET    /missions/:id/evidence
GET    /missions/:id/artifacts
GET    /missions/:id/verification

GET    /approvals
GET    /approvals/:id
POST   /approvals/:id/approve
POST   /approvals/:id/reject

GET    /agents
POST   /agents

GET    /connectors
POST   /connectors
POST   /connectors/:id/test

GET    /mcp/servers
POST   /mcp/servers
POST   /mcp/servers/:id/connect

GET    /skills
POST   /skills

GET    /memory
POST   /memory

GET    /usage
```

Provide OpenAPI documentation.

Validate every request.

---

# 39. CLIENT SDK

Generate or maintain a typed client package consumed by:

```text
web
mobile
internal services
```

Do not manually duplicate API types across clients.

---

# 40. OBSERVABILITY

Implement structured backend logging.

Include:

```text
requestId
traceId
missionId
taskId
agentId
workerId
```

Add health endpoints:

```text
/health/live
/health/ready
```

Readiness should check critical dependencies.

Expose dependency statuses individually:

```text
Postgres
Redis
Object Storage
Model Providers
Sandbox
```

A partial failure should be represented honestly.

---

# 41. STATUS TRUTH MODEL

This is mandatory throughout AgentSwarm.

Every external/runtime capability must use an explicit provenance/status classification.

Use:

```text
LIVE
CONNECTED
VERIFIED
SIMULATED
FIXTURE
UNAVAILABLE
UNKNOWN
DEGRADED
ERROR
```

Examples:

Real Qwen request succeeded:

```text
LIVE
```

Docker not configured:

```text
UNAVAILABLE
```

Cost provider does not report:

```text
UNKNOWN
```

Demo dataset:

```text
FIXTURE
```

Never convert UNKNOWN into a guessed value.

---

# 42. DESIGN SYSTEM

Visual identity:

```text
background: near-black / deep charcoal
brand: #FF5A1F
green: success
blue: running
amber: waiting
purple: approval
red: failure/risk
gray: inactive
```

Typography:

```text
clean sans-serif for UI
monospace for:
events
logs
IDs
tool calls
code
metrics
```

Style:

```text
technical
premium
dense
precise
operator-oriented
```

Use:

- subtle borders
- restrained radius
- excellent hierarchy
- accessible focus states
- subtle motion
- strong information density

Avoid:

- excessive glassmorphism
- huge gradients
- AI stock imagery
- meaningless charts
- fake KPIs
- excessive empty space

The visual reference is an:

```text
AI engineering control plane
+
developer IDE
+
mission control center
```

---

# 43. ACCESSIBILITY

Target WCAG AA behavior.

Implement:

```text
keyboard navigation
visible focus
semantic labels
screen-reader announcements
focus trapping for dialogs
Escape handling
reduced-motion handling
sufficient contrast
large mobile approval targets
```

Retain the current Cmd/Ctrl + K concept.

Command palette actions should include:

```text
New Mission
Pause Mission
Resume Mission
Cancel Mission
Open Approvals
Open Task Graph
Open Tasks
Open Workspace
Open Activity
Open Evidence
Open Verification
Open Artifacts
Replay Mission
```

---

# 44. RESPONSIVE TARGETS

Test at:

```text
320
375
390
430
768
1024
1280
1440
1920
```

No horizontal overflow except intentional graph/code areas with explicit scroll containers.

---

# 45. DATABASE MIGRATIONS

Do not use runtime schema auto-creation.

Commit migrations.

Provide:

```text
schema
migration history
indexes
foreign keys
unique constraints
tenant indexes
event sequence constraints
idempotency constraints
```

Add appropriate database transactions around critical state transitions.

---

# 46. IDEMPOTENCY

Mission/runtime writes must support safe retries.

Use idempotency keys for consequential operations such as:

```text
mission creation
approval decisions
tool execution
artifact creation
external writes
```

A worker retry must not accidentally:

```text
push twice
deploy twice
charge twice
create duplicate artifacts
approve twice
```

---

# 47. TESTING

Create meaningful automated tests.

Required layers:

```text
unit
integration
API
database
worker
state-machine
authorization
tenant isolation
event ordering
approval
retry/idempotency
web component
mobile component
end-to-end smoke
```

Critical tests:

```text
cross-org access denied
unauthorized approval denied
worker crash recovery
expired task lease recovery
duplicate event rejected
duplicate approval prevented
cancelled mission stops scheduling
failed dependency blocks dependent tasks
high-risk action waits for approval
verification failure prevents completion
unknown telemetry remains UNKNOWN
```

---

# 48. LOCAL DEVELOPMENT

One documented flow should start core infrastructure.

Example:

```text
docker compose up -d
pnpm install
pnpm db:migrate
pnpm dev
```

Docker Compose should provide, where practical:

```text
Postgres
Redis
MinIO
API
Worker
Scheduler
Web
```

Mobile may run through Expo separately.

Do not require paid third-party services to boot the base platform.

Model/provider integrations may remain unavailable until keys are supplied.

---

# 49. ENVIRONMENT

Create a complete `.env.example`.

Group by:

```text
APP
DATABASE
REDIS
STORAGE
AUTH
QWEN
OPENAI
ANTHROPIC
OLLAMA
GITHUB
MCP
SANDBOX
PUSH
OBSERVABILITY
```

Never commit real secrets.

---

# 50. README

Rewrite README as an operator/developer README.

Include:

```text
AgentSwarm positioning
architecture
screenshots
monorepo layout
requirements
quick start
environment variables
database migrations
web development
mobile development
worker development
model providers
MCP
sandboxing
security model
testing
deployment
troubleshooting
status/provenance semantics
```

---

# 51. PRODUCTION DEPLOYMENT

Support containerized deployment.

Provide:

```text
Dockerfiles
docker-compose production reference
health checks
graceful shutdown
migration command
worker scaling instructions
scheduler singleton/leader strategy
persistent volumes where required
```

Separate:

```text
web
api
worker
scheduler
```

processes.

Do not run the distributed worker loop inside the frontend server.

---

# 52. DEVELOPMENT EXECUTION ORDER

Implement in this order.

## PHASE 1 — Foundation

```text
monorepo
database
migrations
auth
organizations
projects
API
web shell
mobile shell
```

## PHASE 2 — Mission Runtime

```text
mission state machine
task DAG
queue
worker
leases
events
realtime
```

## PHASE 3 — Agent Runtime

```text
agent profiles
Qwen adapter
model router
real model invocation
usage accounting
```

## PHASE 4 — Governed Execution

```text
tools
policy
approvals
sandbox abstraction
MCP gateway
```

## PHASE 5 — Trust Layer

```text
evidence
verification
artifacts
audit
```

## PHASE 6 — Intelligence

```text
memory
skills
schedules
replay
```

## PHASE 7 — Production

```text
security hardening
testing
accessibility
mobile polish
observability
Docker
documentation
deployment
```

---

# 53. MIGRATE THE EXISTING PROTOTYPE

Do not throw away the current UI blindly.

Preserve its strongest UX primitives:

```text
mission composer
execution modes
task DAG
eight specialist presets
agent inspector
approval center
activity trace
evidence ledger
workspace
cost view
command palette
desktop 3-pane layout
mobile bottom navigation
mobile inspector bottom sheet
```

But replace client-side fixture state with API-backed state.

Specifically remove production dependence on:

```text
makeMission()
tick()
Math.random()
client-side cost increments
client-side token increments
random tool events
fake evidence corpus
fake connection states
```

The React client must consume real server data.

---

# 54. FIRST REAL END-TO-END MISSION

After implementing the platform, make one safe end-to-end mission work.

Example:

```text
Goal:
"Research the AgentSwarm repository and produce an architecture report."
```

Expected real path:

```text
User creates mission
        ↓
API persists mission
        ↓
Planner calls configured Qwen model
        ↓
Validated plan is persisted
        ↓
Tasks queued
        ↓
Worker leases task
        ↓
Research/analysis executes
        ↓
Events stream to web/mobile
        ↓
Evidence/artifact is persisted
        ↓
Verification checks artifact existence/schema
        ↓
Mission becomes COMPLETED
```

No random progress.

No fake completion.

If Qwen credentials are missing, mission must fail or pause with an explicit provider configuration error.

---

# 55. ACCEPTANCE GATES

Do not declare completion until all applicable gates pass.

## GATE A — BUILD

```text
install succeeds
typecheck passes
lint passes
web builds
API builds
worker builds
mobile typecheck/build validation passes
```

## GATE B — DATABASE

```text
clean DB migrates successfully
schema matches migrations
foreign keys valid
indexes present
```

## GATE C — AUTH

```text
signup/login works
project isolation works
unauthorized access denied
```

## GATE D — MISSION

```text
mission persists
reload preserves it
state transitions occur server-side
```

## GATE E — RUNTIME

```text
task queue works
worker leases work
retries work
events persist
```

## GATE F — AI

With configured credentials:

```text
real Qwen request executes
response recorded
usage metadata recorded
```

## GATE G — REALTIME

```text
web receives events
reconnect resumes correctly
duplicate events do not corrupt UI
```

## GATE H — APPROVAL

```text
high-risk action blocks
approval resumes
rejection follows rejection path
audit record exists
```

## GATE I — VERIFICATION

```text
verification executes
failed required gate blocks COMPLETED
passed required gates allow COMPLETED
```

## GATE J — MOBILE

```text
login
mission list
mission detail
live state
approvals
agent detail
activity
```

work against the same backend.

## GATE K — TRUTHFULNESS

Search the entire repository for:

```text
Math.random
fake
mock
fixture
simulated
hard-coded token
fake connection
```

Fixtures may remain only in explicit demo/test/fixture modules.

They must never drive a production LIVE state.

---

# 56. FINAL COMPLETION REPORT

At completion provide:

```text
1. Final architecture
2. Directory tree
3. Database entities
4. API endpoints
5. Runtime explanation
6. Model-provider status
7. MCP status
8. Sandbox status
9. Web status
10. Mobile status
11. Test results
12. Build results
13. Remaining UNAVAILABLE integrations
14. Security findings
15. Exact commands to run
16. Exact environment variables required
17. Exact commit SHA
```

Use this status table:

```text
COMPONENT                  STATUS
----------------------------------------
Web                        PASS / FAIL
Mobile                     PASS / FAIL
API                        PASS / FAIL
Database                   PASS / FAIL
Redis                      PASS / FAIL
Mission Engine             PASS / FAIL
Worker                     PASS / FAIL
Agent Runtime              PASS / FAIL
Qwen                       LIVE / UNAVAILABLE
Model Router               PASS / FAIL
MCP                        LIVE / PARTIAL / UNAVAILABLE
Sandbox                    LIVE / UNAVAILABLE
Approvals                  PASS / FAIL
Evidence                   PASS / FAIL
Verification               PASS / FAIL
Artifacts                  PASS / FAIL
Memory                     PASS / FAIL
Skills                     PASS / FAIL
Realtime                   PASS / FAIL
Auth                       PASS / FAIL
Security                   PASS / FAIL
Tests                      PASS / FAIL
```

Never turn an `UNAVAILABLE` integration into `PASS`.

---

# 57. EXECUTION DOCTRINE

You are not writing a proposal.

You are implementing the repository.

Inspect the existing project first.

Preserve useful work.

Refactor when necessary.

Create migrations.

Create backend services.

Create web UI.

Create native mobile app.

Wire real persistence.

Wire real queues.

Wire real events.

Wire Qwen where credentials exist.

Wire real approvals.

Wire evidence.

Wire verification.

Add tests.

Run tests.

Fix failures.

Run production builds.

Fix failures.

Document everything.

Do not stop after scaffolding.

Do not stop after producing files.

Do not declare features operational merely because interfaces exist.

A feature is LIVE only when the complete execution path has been exercised successfully.

The final product must satisfy the central AgentSwarm rule:

> **One goal. A governed swarm. Verified work.**

And the engineering rule:

> **SHOW WHAT ACTUALLY HAPPENED.**