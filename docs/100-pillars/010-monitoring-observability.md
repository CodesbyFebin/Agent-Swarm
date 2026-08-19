---
title: "AgentSwarm Monitoring and Observability: Gain Insight into System Behavior and Performance"
description: "Learn how to monitor and observe AgentSwarm to gain deep insights into system behavior, performance, and health. Covers logging, metrics, tracing, alerting, debugging, and compliance."
date: "2026-08-19"
---

# AgentSwarm Monitoring and Observability: Gain Insight into System Behavior and Performance

## TL;DR: Implement comprehensive monitoring and observability in AgentSwarm using structured logging, metrics collection, distributed tracing, health checks, and alerting to gain deep insights into system behavior, detect issues early, and ensure reliable operation.

## Quick Facts

- **Observability Pillars**: Logs, Metrics, Traces (the three pillars of observability)
- **Key Metrics**: Mission throughput, worker utilization, queue depths, error rates, latency percentiles, resource utilization
- **Logging Standards**: Structured JSON logging with consistent fields, correlation IDs, and appropriate log levels
- **Tracing**: OpenTelemetry-compatible distributed tracing with mission/task/spans hierarchy
- **Alerting**: Multi-level alerting (warning, critical, emergency) with escalation policies
- **Monitoring Stack**: Prometheus + Grafana + Loki + Tempo (or equivalent)
- **Related Pillars**: [001-introduction.md](./001-introduction.md), [002-architecture.md](./002-architecture.md), [003-use-cases.md](./003-use-cases.md), [004-model-routing.md](./004-model-routing.md), [005-event-ledger.md](./005-event-ledger.md), [006-verification-gates.md](./006-verification-gates.md), [007-deployment-guide.md](./007-deployment-guide.md), [008-security-best-practices.md](./008-security-best-practices.md), [009-performance-optimization.md](./009-performance-optimization.md)

## Observability Philosophy

Observability in AgentSwarm follows the principle that you should be able to understand the internal state of the system by examining its external outputs. This is achieved through:

```
Instrument → Collect → Analyze → Act
```

### Key Principles
1. **Instrument Everything**: Capture relevant data at all system boundaries and key internal points
2. **Correlate Data**: Link logs, metrics, and traces using consistent identifiers (mission ID, task ID, etc.)
3. **Make Data Actionable**: Ensure collected data leads to clear insights and actions
4. **Respect Privacy and Security**: Don't log sensitive information; implement proper access controls
5. **Balance Detail and Overhead**: Collect enough data to be useful without overwhelming storage or impacting performance
6. **Standardize Formats**: Use consistent formats for logs, metrics, and traces to enable tooling
7. **Plan for Retention**: Implement appropriate data retention policies based on data type and compliance requirements
8. **Enable Self-Service**: Allow teams to create their own dashboards and alerts within guardrails

## The Three Pillars of Observability

### 1. Logging
Structured, searchable records of discrete events that happened in the system.

### 2. Metrics
Numerical measurements of system behavior over time, useful for alerting and trend analysis.

### 3. Tracing
Records of the progression of a single request or transaction as it moves through distributed systems.

## Logging Strategy

### Log Structure
All AgentSwarm components emit structured JSON logs with the following standard fields:

```json
{
  "timestamp": "2026-08-19T10:30:00.000Z",
  "level": "info",
  "logger": "worker.scheduler",
  "missionId": "mission-123",
  "taskId": "task-456",
  "agentId": "agent-789",
  "traceId": "trace-abc",
  "spanId": "span-def",
  "message": "Mission started successfully",
  "context": {
    "goal": "Analyze market trends",
    "mode": "SWARM",
    "workerId": "worker-01"
  }
}
```

### Log Levels
- **fatal**: The application is crashing or unusable
- **error**: An error occurred that requires attention but doesn't crash the application
- **warn**: Something unexpected happened that might indicate a problem
- **info**: Normal operational messages
- **debug**: Detailed information useful for troubleshooting
- **trace**: Very detailed information, typically only enabled in development

### Component-Specific Logging
#### API Server Logs
- Request/response logging (method, path, status, duration)
- Authentication events
- Rate limiting events
- Error conditions

#### Worker Logs
- Mission lifecycle events (queued, started, completed, failed)
- Task execution events
- Tool execution events
- Verification events
- Heartbeat/status updates

#### Scheduler Logs
- Job scheduling events
- Job execution events
- Misfire handling
- Pause/resume events
- Conflict detection

#### Model Router Logs
- Provider selection events
- Fallback events
- Provider health checks
- Token usage tracking

### Logging Implementation Examples
#### Node.js Winston Logger
```javascript
const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({ format: 'ISO' }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: 'agent-swarm-worker' },
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    new transports.File({ filename: 'logs/combined.log' })
  ]
});

// Add default context
const contextualLogger = logger.child({
  missionId: process.env.MISSION_ID,
  taskId: process.env.TASK_ID,
  agentId: process.env.AGENT_ID
});

// Usage
contextualLogger.info('Mission started', { goal: mission.goal, mode: mission.mode });
contextualLogger.error('Task failed', { error: err.message, taskId: task.id });
```

#### Structured Logging Middleware (Express/Fastify)
```javascript
// Fastify plugin for request logging
async function loggingPlugin(fastify) {
  fastify.addHook('onRequest', (request, reply, done) => {
    const startTime = Date.now();
    request.log = request.log.child({
      reqId: request.id,
      method: request.method,
      url: request.url,
      ip: request.ip
    });
    request.log.info('Incoming request');
    done();
  });

  fastify.addHook('onResponse', (request, reply, done) => {
    const responseTime = Date.now() - request.startTime;
    request.log.info('Request completed', {
      statusCode: reply.statusCode,
      responseTime
    });
    done();
  });
}
```

### Log Storage and Retention
- **Hot Storage**: Recent logs (hours to days) in fast storage for real-time querying
- **Warm Storage**: Older logs (days to weeks) in cost-effective storage
- **Cold Storage**: Archived logs (weeks to years) for compliance and forensic analysis
- **Retention Policies**: 
  - Debug/Trace logs: 1-7 days
  - Info/Warn logs: 14-30 days
  - Error/Fatal logs: 90-365 days
  - Audit logs: As required by compliance (often 7+ years)

## Metrics Strategy

### Metric Types
#### 1. Counters
Monotonically increasing values for counting events
- `missions_total`: Total number of missions created
- `tasks_total`: Total number of tasks executed
- `errors_total`: Total number of errors encountered
- `tool_calls_total`: Total number of tool executions

#### 2. Gauges
Values that can go up or down
- `missions_active`: Number of currently active missions
- `workers_busy`: Number of workers currently processing tasks
- `queue_depth`: Number of tasks waiting in queue
- `memory_usage`: Current memory usage
- `cpu_utilization`: Current CPU utilization percentage

#### 3. Histograms
Track distribution of values over time
- `mission_duration`: Distribution of mission completion times
- `task_duration`: Distribution of task execution times
- `api_response_time`: Distribution of API response times
- `database_query_time`: Distribution of database query times

#### 4. Summaries
Similar to histograms but calculated on the client side
- `api_response_time_summary`: Summary of API response times
- `task_duration_summary`: Summary of task durations

### Standard Metrics Namespace
All metrics use the `agent_swarm_` prefix to avoid collisions:
- `agent_swarm_missions_total`
- `agent_swarm_tasks_total`
- `agent_swarm_errors_total`
- `agent_swarm_missions_active`
- `agent_swarm_workers_busy`
- `agent_swarm_queue_depth`

### Metrics Implementation Examples
#### Node.js Prometheus Client
```javascript
const client = require('prom-client');

// Define metrics
const missionsTotal = new client.Counter({
  name: 'agent_swarm_missions_total',
  help: 'Total number of missions created',
  labelNames: ['mode', 'status']
});

const missionsActive = new client.Gauge({
  name: 'agent_swarm_missions_active',
  help: 'Number of currently active missions'
});

const missionDuration = new client.Histogram({
  name: 'agent_swarm_mission_duration_seconds',
  help: 'Duration of missions in seconds',
  labelNames: ['mode', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600, 1800, 3600, 7200, 14400, 28800, 86400]
});

// Register metrics
client.collectDefaultMetrics({ prefix: 'agent_swarm_' });

// Usage in code
missionsTotal.inc({ mode: mission.mode, status: mission.status });
missionsActive.set(activeMissionCount);

const end = missionDuration.startTimer();
// ... mission execution ...
end({ mode: mission.mode, status: mission.status });
```

### Key Metrics to Monitor
#### Mission-Level Metrics
| Metric | Description | Type | Labels | Use Case |
|--------|-------------|------|--------|----------|
| `agent_swarm_missions_total` | Total missions created | Counter | mode, status | Trend analysis, capacity planning |
| `agent_swarm_missions_active` | Currently active missions | Gauge | None | Resource planning, overload detection |
| `agent_swarm_mission_duration_seconds` | Mission completion time | Histogram | mode, status | SLA monitoring, bottleneck identification |
| `agent_swarm_mission_success_rate` | Percentage of successful missions | Gauge (derived) | mode | Quality assessment, regression detection |

#### Task-Level Metrics
| Metric | Description | Type | Labels | Use Case |
|--------|-------------|------|--------|----------|
| `agent_swarm_tasks_total` | Total tasks executed | Counter | agent, status, type | Workload analysis, agent performance |
| `agent_swarm_task_duration_seconds` | Task execution time | Histogram | agent, type | Performance optimization, SLA monitoring |
| `agent_swarm_task_retry_count` | Number of task retries | Counter | agent, type, reason | Reliability assessment, issue identification |
| `agent_swarm_task_queue_depth` | Tasks waiting in queue | Gauge | priority | Backpressure detection, scaling triggers |

#### Worker-Level Metrics
| Metric | Description | Type | Labels | Use Case |
|--------|-------------|------|--------|----------|
| `agent_swarm_workers_total` | Total workers in pool | Gauge | None | Capacity planning |
| `agent_swarm_workers_busy` | Workers currently processing tasks | Gauge | agent_type | Utilization monitoring, scaling decisions |
| `agent_swarm_worker_idle_time` | Time workers spend idle | Histogram | agent_type | Efficiency analysis, cost optimization |
| `agent_swarm_worker_heartbeat_timestamp` | Last heartbeat from worker | Gauge | worker_id | Failure detection, liveness monitoring |

#### System-Level Metrics
| Metric | Description | Type | Labels | Use Case |
|--------|-------------|------|--------|----------|
| `agent_swarm_api_requests_total` | Total API requests | Counter | method, endpoint, status_code | Traffic analysis, error tracking |
| `agent_swarm_api_request_duration_seconds` | API request duration | Histogram | method, endpoint | Performance monitoring, SLA tracking |
| `agent_swarm_database_connections` | Active database connections | Gauge | state (idle/active) | Connection pool sizing, leak detection |
| `agent_swarm_database_query_duration_seconds` | Database query duration | Histogram | operation, success | Query optimization, performance tuning |
| `agent_swarm_event_ledger_size` | Size of event ledger | Gauge | None | Storage planning, archival triggers |
| `agent_swarm_verification_pass_rate` | Percentage of verifications passed | Gauge | verification_type | Quality assessment, process improvement |

### Metrics Collection and Storage
- **Collection**: Use Prometheus client libraries in each service to expose `/metrics` endpoint
- **Storage**: Prometheus server scrapes metrics from endpoints and stores in TSDB
- **Visualization**: Grafana dashboards for visualizing metrics over time
- **Long-term Storage**: Thanos or Cortex for long-term metric retention and global querying
- **Alerting**: Alertmanager for deduplication, grouping, and routing of alerts

## Distributed Tracing

### Trace Context Propagation
All AgentSwarm services propagate trace context using the W3C TraceContext standard:
- `trace-id`: Unique identifier for the entire trace
- `parent-id`: Identifier of the parent span
- `trace-flags`: Sampling decisions and other flags

### Span Structure
Each operation creates a span with the following attributes:
- **name**: Operation name (e.g., "execute_mission", "run_task")
- **kind**: Span kind (SERVER, CLIENT, INTERNAL, PRODUCER, CONSUMER)
- **start_time**: Timestamp when the span started
- **end_time**: Timestamp when the span ended
- **status**: Status code (UNSET, OK, ERROR)
- **attributes**: Key-value pairs providing context about the operation
- **events**: Timestamped occurrences during the span's lifetime
- **links**: Associations to other spans in the same or different traces

### Mission/Task Trace Hierarchy
```
Trace (Mission)
├── Span: Mission Lifecycle
│   ├── Event: Mission Created
│   ├── Event: Mission Started
│   │   ├── Span: Planning Phase
│   │   │   ├── Span: Agent Planning (planner agent)
│   │   │   └── Span: Task Generation
│   │   ├── Span: Task Execution Phase
│   │   │   ├── Span: Task 1 Execution
│   │   │   │   ├── Event: Task Leased
│   │   │   │   ├── Span: Tool Execution (filesystem.read)
│   │   │   │   ├── Event: Tool Result
│   │   │   │   └── Event: Task Completed
│   │   │   ├── Span: Task 2 Execution
│   │   │   │   └── ...
│   │   │   └── Span: Verification Phase
│   │   │       ├── Span: Build Verification
│   │   │       ├── Span: Test Verification
│   │   │       └── ...
│   │   └── Event: Mission Completed
│   └── Event: Mission Archived
```

### Tracing Implementation Examples
#### Node.js OpenTelemetry
```javascript
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const { ConsoleMetricExporter } = require('@opentelemetry/metrics');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');
const { Resource } = require('@opentelemetry/resources');

// Set up tracing provider
const provider = new NodeTracerProvider({
  resource: new Resource({
    'service.name': 'agent-swarm-worker',
    'service.version': process.env.VERSION || 'unknown',
    'deployment.environment': process.env.NODE_ENV || 'development'
  })
});

// Configure OTLP exporter (sends to Jaeger, Tempo, etc.)
const otlpExporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317',
});

// Add span processor
provider.addSpanProcessor(new BatchSpanProcessor(otlpExporter));
provider.register();

// Instrument HTTP and Express
registerInstrumentations({
  instrumentations: [
    new HttpInstrumentation(),
    new ExpressInstrumentation()
  ]
});

// Get tracer
const tracer = provider.getTracer('agent-swarm-worker');

// Usage in code
async function executeMission(mission) {
  // Create a span for the entire mission execution
  const span = tracer.startSpan('execute_mission', {
    kind: SpanKind.INTERNAL,
    attributes: {
      'mission.id': mission.id,
      'mission.goal': mission.goal.substring(0, 100), // Truncate for attribute size limits
      'mission.mode': mission.mode,
      'worker.id': process.env.WORKER_ID || 'unknown'
    }
  });

  try {
    // Execute mission logic here
    const result = await performMissionExecution(mission);
    
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (err) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: err.message
    });
    span.recordException(err);
    throw err;
  } finally {
    span.end();
  }
}

// Creating child spans for subtasks
async function performMissionExecution(mission) {
  const span = tracer.startSpan('perform_mission_execution', {
    kind: SpanKind.INTERNAL,
    attributes: {
      'mission.id': mission.id
    }
  });

  try {
    // Planning phase
    const planningSpan = tracer.startSpan('planning_phase', {
      kind: SpanKind.INTERNAL,
      attributes: { 'mission.id': mission.id }
    });
    
    const plan = await createMissionPlan(mission);
    planningSpan.end();
    
    // Task execution phase
    const taskExecutionSpan = tracer.startSpan('task_execution_phase', {
      kind: SpanKind.INTERNAL,
      attributes: { 'mission.id': mission.id }
    });
    
    const results = await executeMissionTasks(mission, plan);
    taskExecutionSpan.end();
    
    // Verification phase
    const verificationSpan = tracer.startSpan('verification_phase', {
      kind: SpanKind.INTERNAL,
      attributes: { 'mission.id': mission.id }
    });
    
    const verificationResults = await runVerifications(mission, results);
    verificationSpan.end();
    
    return { plan, results, verificationResults };
  } catch (err) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: err.message
    });
    span.recordException(err);
    throw err;
  } finally {
    span.end();
  }
}
```

### Trace Storage and Visualization
- **Storage**: Tempo, Jaeger, or Zipkin for storing trace data
- **Querying**: TraceQL or similar query languages for finding specific traces
- **Visualization**: Jaeger UI, Tempo/Grafana integration, or Zipkin UI
- **Correlation**: Ability to trace from a log entry to its corresponding trace span
- **Sampling**: Adaptive sampling to balance detail with storage costs
  - Always sample errors
  - Sample a percentage of successful operations (e.g., 10%)
  - Sample based on operation type or duration

## Health Checks and Alerting

### Health Check Levels
#### 1. Liveness Probe
- **Purpose**: Determine if the application is running and not deadlocked
- **Frequency**: Every 10-30 seconds
- **Failure Threshold**: 3 consecutive failures
- **Action**: Container restart
- **Checks**: 
  - Process is running
  - Event loop is not blocked (for Node.js)
  - Basic connectivity to dependencies (database, message queue)

#### 2. Readiness Probe
- **Purpose**: Determine if the application is ready to serve traffic
- **Frequency**: Every 5-15 seconds
- **Failure Threshold**: 3 consecutive failures
- **Action**: Remove from service endpoints (load balancer)
- **Checks**: 
  - Liveness checks pass
  - Can connect to database and perform simple query
  - Can connect to message queue/Redis
  - Required configuration is present
  - Critical dependencies are available

#### 3. Startup Probe
- **Purpose**: Determine when the application has finished starting up
- **Frequency**: Every 5-15 seconds
- **Failure Threshold**: 30 consecutive failures (longer startup time allowed)
- **Action**: Container considered started after success
- **Checks**: 
  - All readiness checks pass
  - Caches are warmed
  - Background processes are initialized
  - Worker pool is populated

### Health Check Implementation Examples
#### Node.js Health Checks
```javascript
const healthCheck = {
  liveness: async () => {
    // Check if process is responsive
    const loopDelay = checkEventLoopDelay();
    if (loopDelay > 1000) { // More than 1 second delay
      return { status: 'fail', reason: 'Event loop blocked' };
    }
    
    // Check memory usage
    const memoryUsage = process.memoryUsage();
    const heapUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    if (heapUsagePercent > 95) {
      return { status: 'fail', reason: 'Heap usage too high' };
    }
    
    return { status: 'pass' };
  },
  
  readiness: async () => {
    // Check database connectivity
    try {
      await pool.query('SELECT 1');
    } catch (err) {
      return { status: 'fail', reason: 'Database unavailable' };
    }
    
    // Check Redis connectivity (if used)
    if (process.env.REDIS_URL) {
      try {
        await redis.ping();
      } catch (err) {
        return { status: 'fail', reason: 'Redis unavailable' };
      }
    }
    
    // Check that worker pool is initialized
    if (!workerPool || workerPool.size === 0) {
      return { status: 'fail', reason: 'Worker pool not ready' };
    }
    
    return { status: 'pass' };
  },
  
  startup: async () => {
    // Run readiness checks
    const readinessResult = await healthCheck.readiness();
    if (readinessResult.status !== 'pass') {
      return readinessResult;
    }
    
    // Additional startup-specific checks
    // Verify that all required services are registered
    if (!verifyServiceRegistrations()) {
      return { status: 'fail', reason: 'Service registrations incomplete' };
    }
    
    // Verify that configuration is valid
    if (!validateConfiguration()) {
      return { status: 'fail', reason: 'Invalid configuration' };
    }
    
    return { status: 'pass' };
  }
};

// Helper function to check event loop delay
function checkEventLoopDelay() {
  const start = Date.now();
  setImmediate(() => {
    const delay = Date.now() - start;
    // Store delay for monitoring
    eventLoopDelay.set(delay);
  });
  return 0; // Immediate return, actual delay measured in callback
}
```

### Alerting Strategy
#### Alert Categories
1. **Critical (PagerDuty/Phone)**: System is down or severely degraded
   - API server unavailable
   - Database unavailable for >5 minutes
   - No workers available for >2 minutes
   - Mission queue depth >1000 for >5 minutes
   - Error rate >5% for >5 minutes

2. **Warning (Slack/Email)**: Something requires attention but not emergency
   - Worker utilization >90% for >15 minutes
   - Mission queue depth >100 for >15 minutes
   - Error rate >1% for >15 minutes
   - Average mission duration >2x baseline for >15 minutes
   - Disk usage >85%

3. **Info (Log-only)**: For awareness and trend analysis
   - New worker registered
   - Configuration changed
   - Deployment completed
   - Backup completed successfully

#### Alerting Implementation
```javascript
// Using a simple alerting framework (in practice, use Alertmanager or similar)
class AlertManager {
  constructor() {
    this.alertRules = [];
    this.notificationChannels = [];
    this.activeAlerts = new Map();
  }
  
  addRule(rule) {
    this.alertRules.push(rule);
  }
  
  addChannel(channel) {
    this.notificationChannels.push(channel);
  }
  
  async evaluate(metrics) {
    for (const rule of this.alertRules) {
      try {
        const shouldAlert = await rule.evaluate(metrics);
        const alertKey = rule.getAlertKey(metrics);
        
        if (shouldAlert) {
          // Alert should be firing
          if (!this.activeAlerts.has(alertKey)) {
            // New alert - fire it
            const alert = {
              ...rule.getAlertDetails(metrics),
              key: alertKey,
              startedAt: new Date(),
              status: 'firing'
            };
            
            this.activeAlerts.set(alertKey, alert);
            await this.sendNotification(alert);
          }
        } else {
          # Alert should not be firing
          if (this.activeAlerts.has(alertKey)) {
            # Alert was firing, now resolved
            const alert = this.activeAlerts.get(alertKey);
            alert.endedAt = new Date();
            alert.status = 'resolved';
            
            await this.sendNotification(alert);
            this.activeAlerts.delete(alertKey);
          }
        }
      } catch (err) {
        console.error(`Error evaluating alert rule ${rule.name}:`, err);
      }
    }
  }
  
  async sendNotification(alert) {
    for (const channel of this.notificationChannels) {
      try {
        await channel.send(alert);
      } catch (err) {
        console.error(`Error sending alert via ${channel.type}:`, err);
      }
    }
  }
}

// Example alert rules
const alertManager = new AlertManager();

// Critical: API unavailable
alertManager.addRule({
  name: 'APIUnavailable',
  evaluate: async (metrics) => {
    const apiUp = metrics.get('agent_swarm_api_up') || 0;
    return apiUp === 0; // Assuming 1 = up, 0 = down
  },
  getAlertKey: () => 'APIUnavailable',
  getAlertDetails: () => ({
    severity: 'critical',
    summary: 'API server is unavailable',
    description: 'The AgentSwarm API server is not responding to health checks.'
  })
});

// Warning: High worker utilization
alertManager.addRule({
  name: 'HighWorkerUtilization',
  evaluate: async (metrics) => {
    const workersTotal = metrics.get('agent_swarm_workers_total') || 1;
    const workersBusy = metrics.get('agent_swarm_workers_busy') || 0;
    const utilization = workersBusy / workersTotal;
    return utilization > 0.9; // >90% utilization
  },
  getAlertKey: () => 'HighWorkerUtilization',
  getAlertDetails: (metrics) => ({
    severity: 'warning',
    summary: 'High worker utilization detected',
    description: `Worker utilization is ${((metrics.get('agent_swarm_workers_busy') || 0) / (metrics.get('agent_swarm_workers_total') || 1) * 100).toFixed(1)}%`
  })
});

// Info: New deployment
alertManager.addRule({
  name: 'NewDeployment',
  evaluate: async (metrics) => {
    const deploymentTimestamp = metrics.get('agent_swarm_deployment_timestamp') || 0;
    const lastAlerted = this.activeAlerts.get('NewDeployment')?.alertedAt || 0;
    return deploymentTimestamp > lastAlerted;
  },
  getAlertKey: () => 'NewDeployment',
  getAlertDetails: (metrics) => ({
    severity: 'info',
    summary: 'New AgentSwarm deployment detected',
    description: `Deployed at ${new Date(metrics.get('agent_swarm_deployment_timestamp')).toISOString()}`
  }),
  // Special handling - only alert once per deployment
  afterSend: (alert) => {
    alert.alertedAt = Date.now();
  }
});
```

## Debugging and Troubleshooting

### Common Issues and Diagnostic Approaches
#### 1. Mission Stuck in QUEUED State
**Symptoms**: Missions remain in QUEUED state and never progress to PLANNING or RUNNING.

**Diagnostic Steps**:
1. Check worker availability: `agent_swarm_workers_total` and `agent_swarm_workers_busy` metrics
2. Check queue depth: `agent_swarm_task_queue_depth` metric
3. Examine worker logs for connection issues or errors
4. Verify scheduler is running and processing queued missions
5. Check for database locks or long-running transactions

**Resolution**:
- Scale worker pool if utilization is high
- Fix worker connectivity issues
- Restart scheduler if stuck
- Resolve database blocking issues

#### 2. High Mission Failure Rate
**Symptoms**: Increased percentage of missions ending in FAILED state.

**Diagnostic Steps**:
1. Check error logs for patterns in failure messages
2. Examine verification results to see if failures are occurring during verification
3. Check tool execution logs for tool-specific failures
4. Review recent changes (deployments, configuration changes)
5. Look at mission-specific data to see if certain types of missions are failing more often

**Resolution**:
- Fix underlying issues causing failures
- Adjust verification thresholds if too strict
- Roll back recent changes if they introduced regressions
- Provide better error handling for transient failures

#### 3. Performance Degradation
**Symptoms**: Increased mission duration or decreased throughput over time.

**Diagnostic Steps**:
1. Check resource utilization metrics (CPU, memory, disk I/O, network)
2. Look for increasing trends in latency histograms
3. Check for garbage collection pressure (in Node.js applications)
4. Examine database query performance
5. Look for increasing queue depths indicating bottlenecks

**Resolution**:
- Scale resources if utilization is consistently high
- Optimize slow database queries
- Address memory leaks if present
- Optimize application code based on profiling
- Consider architectural changes if bottlenecks are systemic

#### 4. Tool Execution Failures
**Symptoms**: Specific tools consistently failing when called by agents.

**Diagnostic Steps**:
1. Check tool execution logs for error messages
2. Verify tool approvals are not blocking execution
3. Check tool-specific health (e.g., filesystem permissions, network connectivity)
4. Look for patterns in failure messages
5. Verify tool configuration and environment variables

**Resolution**:
- Fix tool-specific issues (permissions, connectivity, etc.)
- Adjust tool approval policies if overly restrictive
- Update tool implementations to handle edge cases
- Provide better error messages and fallback options

### Diagnostic Tools and Techniques
#### 1. Logging-Based Debugging
- **Correlation IDs**: Use mission ID, task ID to trace related log entries
- **Time-range queries**: Look at logs within specific time windows
- **Level-based filtering**: Focus on error and warn logs during troubleshooting
- **Contextual searching**: Search for specific values in log context fields

#### 2. Metrics-Based Debugging
- **Comparative analysis**: Compare current metrics to baseline or historical values
- **Correlation analysis**: Look for relationships between different metrics
- **Anomaly detection**: Identify metric values that deviate significantly from expected patterns
- **Dashboard drilling**: Start with high-level dashboards and drill down to specific components

#### 3. Trace-Based Debugging
- **Trace exploration**: Find traces related to problematic missions or tasks
- **Span analysis**: Examine individual spans to see where time is spent or errors occur
- **Dependency analysis**: Understand how different services interact during a request
- **Latency analysis**: Identify which spans contribute most to overall latency

#### 4. Profiling and Debugging Tools
- **Node.js Inspector**: For CPU profiling, heap snapshots, and debugging
- **clinic.js**: For detecting performance issues in Node.js applications
- **perf/eftrace/Windows Performance Analyzer**: For low-level system profiling
- **Database explain plans**: For understanding query execution
- **Network tracing tools**: (tcpdump, Wireshark) for network-level issues

### Emergency Response Procedures
#### 1. Incident Detection
- **Automated**: Alerting system detects issue and pages on-call engineer
- **Manual**: User reports problem or engineer notices anomaly in dashboards

#### 2. Initial Triage
- **Acknowledge alert**: Start incident response process
- **Gather information**: Check dashboards, logs, and metrics
- **Determine impact**: Assess how many users/missions are affected
- **Initial diagnosis**: Form hypothesis about root cause

#### 3. Mitigation
- **Immediate actions**: Restart services, scale resources, rollback changes
- **Traffic management**: Implement circuit breakers, rate limiting, or fallback modes
- **Communication**: Notify stakeholders of issue and expected resolution time

#### 4. Root Cause Analysis
- **Deep investigation**: Examine logs, traces, and metrics in detail
- **Reproduction**: Attempt to reproduce issue in staging environment
- **Confirmation**: Verify hypothesis with additional evidence
- **Documentation**: Record findings for future reference

#### 5. Resolution and Recovery
- **Fix implementation**: Deploy fix to resolve root cause
- **Verification**: Confirm that issue is resolved and no regressions introduced
- **Recovery**: Return system to normal operating state
- **Follow-up**: Monitor for recurrence and implement preventive measures

#### 6. Post-Incident Process
- **Incident report**: Document what happened, why, and how it was fixed
- **Action items**: Identify improvements to prevent recurrence
- **Knowledge sharing**: Share learnings with team
- **Process updates**: Update runbooks and procedures based on incident

## Audit Trails and Compliance

### Immutable Audit Logging
AgentSwarm implements tamper-evident audit trails for compliance and forensic analysis:

#### Event Ledger (from 005-event-ledger.md)
All significant system events are cryptographically sealed and stored in an immutable ledger:
- Mission creation, modification, and completion
- Task execution and results
- Tool invocations and approvals
- Verification outcomes
- Configuration changes
- User authentication and authorization events

#### Sealing Mechanism
- Events are grouped into batches
- Each batch is cryptographically sealed using HMAC-SHA256 with a rotating key
- Seals are stored separately from the events they protect
- Chain integrity verification ensures no tampering has occurred
- Regular audits verify the integrity of the entire ledger

### Compliance Features
#### 1. Data Retention and Deletion
- Configurable retention policies for different data types
- Secure deletion mechanisms for GDPR "right to be forgotten"
- Archival strategies for long-term storage requirements
- Legal hold capabilities for litigation preservation

#### 2. Access Controls
- Role-based access control (RBAC) for system access
- Fine-grained permissions for different data types
- Just-in-time access for privileged operations
- Comprehensive audit logging of all access attempts

#### 3. Data Protection
- Encryption at rest for sensitive data
- Encryption in transit using TLS 1.3
- Key management using industry-standard practices
- Separation of duties for key management operations

#### 4. Reporting and Export
- Standardized export formats for audit data
- Configurable reporting schedules
- Customizable report templates
- Secure delivery mechanisms for sensitive reports

### Implementation Examples
#### Audit Logging Middleware
```javascript
// Audit logging middleware for Express/Fastify
async function auditLoggingPlugin(fastify) {
  fastify.addHook('onRequest', async (request, reply) => {
    // Skip audit logging for health checks and static assets
    if (request.url.startsWith('/health') || request.url.startsWith('/static/')) {
      return;
    }
    
    // Create audit log entry
    const auditEntry = {
      timestamp: new Date().toISOString(),
      requestId: request.id,
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      userId: request.user?.id || 'anonymous',
      sessionId: request.headers['cookie']?.match(/session=([^;]+)/)?.[1] || null,
      requestBody: request.method in ['POST', 'PUT', 'PATCH'] ? 
        JSON.stringify(request.body) : 
        null, // Be careful with logging sensitive data
      // Note: In practice, you would sanitize requestBody to remove sensitive fields
    };
    
    // Store audit log entry (would typically go to a dedicated audit table or service)
    await storeAuditLog(auditEntry);
  });
  
  fastify.addHook('onResponse', async (request, reply) => {
    // Update audit log with response information
    const auditEntry = {
      timestamp: new Date().toISOString(),
      requestId: request.id,
      statusCode: reply.statusCode,
      responseTime: Date.now() - request.startTime,
      responseSize: reply.res.getHeader('content-length') || 0
    };
    
    await updateAuditLog(request.id, auditEntry);
  });
}
```

#### Cryptographic Sealing Implementation
```javascript
const crypto = require('node:crypto');

class EventLedger {
  constructor(keyProvider) {
    this.keyProvider = keyProvider; // Service that provides sealing keys
    this.batch = [];
    this.batchSize = 1000; // Seal after 1000 events
    this.lastSeal = null; // Hash of previous seal for chaining
  }
  
  async addEvent(event) {
    // Add event to current batch
    this.batch.push({
      ...event,
      sequenceNumber: this.batch.length + 1,
      timestamp: new Date().toISOString()
    });
    
    // Seal batch if it's full
    if (this.batch.length >= this.batchSize) {
      await this.sealBatch();
    }
  }
  
  async sealBatch() {
    if (this.batch.length === 0) {
      return;
    }
    
    // Get current sealing key
    const key = await this.keyProvider.getCurrentKey();
    
    // Create batch data to seal
    const batchData = {
      events: this.batch,
      lastSeal: this.lastSeal, // Chain to previous seal
      sealedAt: new Date().toISOString(),
      batchSize: this.batch.length
    };
    
    // Create HMAC-SHA256 seal
    const seal = crypto.createHmac('sha256', key)
      .update(JSON.stringify(batchData))
      .digest('hex');
    
    // Store seal and batch data (in practice, these would go to separate storage)
    await storeSeal({
      seal,
      batchData,
      sealedAt: new Date().toISOString(),
      previousSeal: this.lastSeal
    });
    
    // Update last seal for chaining
    this.lastSeal = seal;
    
    // Clear batch
    this.batch = [];
    
    return seal;
  }
  
  async verifyChain() {
    // Verify the integrity of the entire seal chain
    const seals = await getAllSealsOrderedByTime();
    
    let previousSeal = null;
    for (const sealRecord of seals) {
      // Recompute seal from batch data
      const computedSeal = crypto.createHmac('sha256', await this.keyProvider.getKeyAtTime(sealRecord.sealedAt))
        .update(JSON.stringify(sealRecord.batchData))
        .digest('hex');
      
      // Check if computed seal matches stored seal
      if (computedSeal !== sealRecord.seal) {
        return {
          valid: false,
          error: `Seal mismatch at index ${seals.indexOf(sealRecord)}`,
          expected: sealRecord.seal,
          actual: computedSeal
        };
      }
      
      // Check chaining (except for first seal)
      if (previousSeal !== null && sealRecord.previousSeal !== previousSeal) {
        return {
          valid: false,
          error: `Chain break at index ${seals.indexOf(sealRecord)}`,
          expectedPreviousSeal: previousSeal,
          actualPreviousSeal: sealRecord.previousSeal
        };
      }
      
      previousSeal = sealRecord.seal;
    }
    
    return { valid: true };
  }
}
```

## Integration with Observability Stacks

### Recommended Stack: Prometheus + Grafana + Loki + Tempo
#### 1. Prometheus (Metrics)
- **Service Discovery**: Automatically discovers services via Kubernetes annotations or Consul
- **Scraping**: Collects metrics from exposed `/metrics` endpoints
- **Storage**: Efficient time-series database with built-in summarization
- **Querying**: Powerful PromQL language for complex queries
- **Alerting**: Integrated with Alertmanager for notification routing

#### 2. Grafana (Visualization)
- **Dashboards**: Rich, interactive dashboards for metrics visualization
- **Explore**: Ad-hoc querying and correlation across data sources
- **Alerting**: Unified alerting interface (can also use Alertmanager separately)
- **Plugins**: Extensive plugin ecosystem for additional visualizations and data sources
- **Permissions**: Role-based access control for dashboard and data source access

#### 3. Loki (Logs)
- **Label-based indexing**: Efficient log storage and querying using labels similar to Prometheus
- **Integration**: Works seamlessly with Prometheus and Grafana
- **Query Language**: LogQL for powerful log querying
- **Horizontal scaling**: Designed to scale efficiently with log volume
- **Multi-tenant support**: Built-in support for multiple tenants or teams

#### 4. Tempo (Traces)
- **High-volume trace storage**: Optimized for storing large volumes of trace data
- **Backend agnostic**: Can use various backends (GCS, S3, local disk, etc.)
- **TraceQL**: Powerful query language for finding specific traces
- **Integration**: Works with Grafana for trace visualization
- **OpenTelemetry native**: Full support for OpenTelemetry protocol

### Deployment Architecture
```
+----------------+    +----------------+    +----------------+    +----------------+
|   AgentSwarm   |    |   AgentSwarm   |    |   AgentSwarm   |    |   AgentSwarm   |
|    API Server  |    |    Worker 1    |    |    Worker 2    |    |   Scheduler  |
+----------------+    +----------------+    +----------------+    +----------------+
         |                   |                   |                   |
         |                   |                   |                   |
         v                   v                   v                   v
+---------------------------------------------------------------+
|                    Sidecar Agents                             |
|  (Prometheus exporter, Loki agent, OpenTelemetry collector)  |
+---------------------------------------------------------------+
         |                   |                   |                   |
         |                   |                   |                   |
         v                   v                   v                   v
+----------------+    +----------------+    +----------------+    +----------------+
| Prometheus     |    | Loki           |    | Tempo          |    | Alertmanager |
| (Metrics)      |    | (Logs)         |    | (Traces)       |    | (Alerting)   |
+----------------+    +----------------+    +----------------+    +----------------+
         \                   |                   /                   /
          \                  |                  /                   /
           \                 |                 /                   /
            \                |                /                   /
             \               |               /                   /
              \              |              /                   /
               \             |             /                   /
                \            |            /                   /
                 \           |           /                   /
                  \          |          /                   /
                   \         |         /                   /
                    \        |        /                   /
                     \       |       /                   /
                      \      |      /                   /
                       \     |     /                   /
                        \    |    /                   /
                         \   |   /                   /
                          \  |  /                   /
                           \ | /                   /
                            \|/                   /
                         +---------------------+
                         |     Grafana         |
                         | (Visualization)     |
                         +---------------------+
```

### Configuration Examples
#### Prometheus Configuration (prometheus.yml)
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'agent-swarm-api'
    kubernetes_sd_configs:
      - role: endpoints
    relabel_configs:
      - source_labels: [__meta_kubernetes_service_label_app_kubernetes_io_name]
        action: keep
        regex: agent-swarm-api
      - source_labels: [__meta_kubernetes_endpoint_port_name]
        action: keep
        regex: metrics

  - job_name: 'agent-swarm-worker'
    kubernetes_sd_configs:
      - role: endpoints
    relabel_configs:
      - source_labels: [__meta_kubernetes_service_label_app_kubernetes_io_name]
        action: keep
        regex: agent-swarm-worker
      - source_labels: [__meta_kubernetes_endpoint_port_name]
        action: keep
        regex: metrics

  - job_name: 'agent-swarm-scheduler'
    kubernetes_sd_configs:
      - role: endpoints
    relabel_configs:
      - source_labels: [__meta_kubernetes_service_label_app_kubernetes_io_name]
        action: keep
        regex: agent-swarm-scheduler
      - source_labels: [__meta_kubernetes_endpoint_port_name]
        action: keep
        regex: metrics

rule_files:
  - "alert_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

#### Grafana Provisioning (dashboards.yml)
```yaml
apiVersion: 1

providers:
  - name: 'AgentSwarm Dashboards'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards/agentswarm
```

#### Loki Configuration (loki.yml)
```yaml
auth_enabled: false

server:
  http_listen_port: 3100
  grpc_listen_port: 9096

common:
  instance_addr: 127.0.0.1
  path_prefix: /tmp/loki
  storage:
    filesystem:
      chunks_directory: /tmp/loki/chunks
      rules_directory: /tmp/loki/rules
    replication_factor: 1
  ring:
    kvstore:
      store: inmemory

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

compactor:
  working_directory: /tmp/loki/compactor
  shared_store: filesystem

limits_config:
  reject_old_samples: true
  reject_old_samples_max_age: 168h

chunk_store_config:
  max_look_back_period: 0h

table_manager:
  retention_deletes_enabled: false
  retention_period: 0h
  retries_deleted: 5
  retries_updated: 0
  retries_ignored: 2
```

#### Tempo Configuration (tempo.yml)
```yaml
server:
  http_listen_port: 3200
  grpc_listen_port: 4317

distributor:
  receivers:
    otlp:
      protocols:
        grpc:

compactor:
  compaction:
    cancel_delay: 1h
    sleep_delay: 5m
    traces_per_file: 1024
    block_bytes: 51200000
    pool_size: 50
    width: 8

storage:
  trace:
    backend: local
    local:
      writable:
        path: /tmp/tempo/blocks
```

## Best Practices and Recommendations

### Implementation Best Practices
1. **Start Small**: Begin with critical metrics and logs, then expand
2. **Be Consistent**: Use the same field names and formats across all services
3. **Sample Wisely**: Use adaptive sampling for traces to balance detail with cost
4. **Monitor Your Monitoring**: Ensure your observability stack is itself observable
5. **Test Alerts**: Regularly test that alerts fire correctly and notifications are delivered
6. **Document Everything**: Keep runbooks, playbooks, and diagrams up to date
7. **Review Regularly**: Periodically review what you're monitoring and why
8. **Involve Stakeholders**: Get input from developers, operators, and business stakeholders

### Performance Considerations
1. **Monitoring Overhead**: Typically 1-3% CPU overhead for metrics collection
2. **Log Volume**: Structured logging increases size but improves queryability
3. **Trace Sampling**: Sample 1-10% of requests for traces in high-volume systems
4. **Batch Operations**: Batch log and metric writes when possible
5. **Asynchronous Processing**: Use non-blocking I/O for observability data transmission
6. **Resource Allocation**: Ensure observability stack has adequate resources
7. **Downsampling**: Consider downsampling old metrics for long-term storage

### Security Considerations
1. **Sanitize Logs**: Never log passwords, tokens, or other sensitive information
2. **Secure Transmission**: Use TLS for all observability data transmission
3. **Access Controls**: Restrict access to observability data based on need-to-know
4. **Audit Access**: Log who accesses observability data and when
5. **Data Protection**: Encrypt sensitive observability data at rest
6. **Minimize PII**: Avoid collecting personally identifiable information in observability data
7. **Compliance**: Ensure observability practices comply with relevant regulations

### Cost Optimization
1. **Right-size Retention**: Keep only what you need for compliance and troubleshooting
2. **Downsample Old Data**: Reduce granularity of older metrics
3. **Compress Data**: Use efficient compression for logs and traces
4. **Spot Instances**: Use preemptible/vm instances for non-critical observability components
5. **Multi-tenancy**: Share observability stack across multiple teams or environments
6. **Open Source**: Leverage open-source solutions where possible
7. **Monitor Usage**: Track resource usage of your observability stack itself

## Conclusion

Effective monitoring and observability are essential for operating AgentSwarm reliably at scale. By implementing comprehensive logging, metrics collection, distributed tracing, health checks, and alerting, you gain deep insights into system behavior, detect issues early, and ensure reliable operation.

Remember that observability is not a one-time implementation but an ongoing practice:
- **Instrument continuously**: Add observability coverage as you add features
- **Analyze regularly**: Use your observability data to drive improvements
- **Act on insights**: Let your observability data inform decisions and actions
- **Evolve your practice**: Adjust your observability strategy as your system and needs change

By following the principles and techniques outlined in this guide, you can build an observability practice that provides the visibility you need to operate AgentSwarm with confidence, whether you're handling a few missions per day or thousands per hour.

## Related Resources
- [001-introduction.md](./001-introduction.md): What is AgentSwarm?
- [002-architecture.md](./002-architecture.md): Technical deep dive
- [003-use-cases.md](./003-use-cases.md): Real-world applications
- [004-model-routing.md](./004-model-routing.md): How we select AI providers
- [005-event-ledger.md](./005-event-ledger.md): Our tamper-evident event sourcing system
- [006-verification-gates.md](./006-verification-gates.md): Independent validation of AI work
- [007-deployment-guide.md](./007-deployment-guide.md): Deployment considerations affecting observability
- [008-security-best-practices.md](./008-security-best-practices.md): Security considerations that affect observability
- [009-performance-optimization.md](./009-performance-optimization.md): Performance considerations for observability
- [DEPLOY.md](../DEPLOY.md): Original deployment instructions