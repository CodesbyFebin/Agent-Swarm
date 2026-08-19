---
title: "AgentSwarm Deployment Guide: From Development to Production"
description: "Learn how to deploy AgentSwarm in various environments, from local development to cloud production. Covers Docker, Kubernetes, Fly.io, and enterprise deployment patterns with security, scaling, and monitoring best practices."
date: "2026-08-19"
---

# AgentSwarm Deployment Guide: From Development to Production

## TL;DR: AgentSwarm can be deployed from simple local development to scalable production environments using Docker, Kubernetes, Fly.io, or enterprise platforms. This guide covers containerization, configuration, security, scaling, monitoring, and maintenance best practices.

## Quick Facts

- **Deployment Options**: Local Docker Compose, Kubernetes, Fly.io, Enterprise platforms
- **Containerization**: All services Dockerized with multi-stage builds
- **Configuration**: Environment-based with secrets management
- **Scaling**: Horizontal scaling for API and Worker services
- **Monitoring**: Health checks, metrics, logging, and distributed tracing
- **Security**: TLS, authentication, authorization, network policies
- **Related Pillars**: [001-introduction.md](./001-introduction.md), [002-architecture.md](./002-architecture.md), [003-use-cases.md](./003-use-cases.md), [004-model-routing.md](./004-model-routing.md), [005-event-ledger.md](./005-event-ledger.md), [006-verification-gates.md](./006-verification-gates.md)

## Deployment Options Overview

AgentSwarm is designed for flexible deployment across different environments:

### 1. Local Development (Docker Compose)
**Best For**: Individual developers, small teams, proof of concepts, testing
**Components**: 
- PostgreSQL database
- Redis (optional, for reduced latency)
- API service
- Worker service
- Webapp (Next.js)
- Website (Next.js, optional)

**Pros**: 
- Simple setup with single command
- Full stack execution
- Hot reloading for development
- Easy to reset and restart

**Cons**: 
- Not suitable for production
- Resource intensive on developer machines
- Limited scaling capabilities

### 2. Cloud-Native (Kubernetes)
**Best For**: Production workloads, scalable deployments, enterprise environments
**Components**:
- PostgreSQL (managed or self-hosted)
- Redis (managed or self-hosted, optional)
- API deployment (horizontal pod autoscaler)
- Worker deployment (horizontal pod autoscaler)
- Webapp deployment (horizontal pod autoscaler)
- Website deployment (static or SSR)
- Ingress controller
- Monitoring stack (Prometheus, Grafana, Loki)
- Secret management

**Pros**:
- Horizontal scaling based on load
- Self-healing and automated rollouts
- Resource isolation and limits
- Enterprise-grade security and networking
- Portable across cloud providers
- Rich ecosystem of tools and integrations

**Cons**:
- Increased complexity
- Operational overhead
- Requires Kubernetes expertise
- Overkill for simple use cases

### 3. Platform-as-a-Service (Fly.io)
**Best For**: Small to medium production workloads, simplicity, cost-effectiveness
**Components**:
- PostgreSQL (managed Fly Postgres or external)
- Redis (managed Fly Redis or external, optional)
- API instances (auto-scaling)
- Worker instances (auto-scaling based on queue depth)
- Webapp (served via Fly.io)
- Website (served via Fly.io or external CDN)

**Pros**:
- Simple deployment with `flyctl`
- Automatic scaling and load balancing
- Built-in monitoring and logging
- Global distribution and edge caching
- Integrated secrets management
- Cost-effective for moderate workloads

**Cons**:
- Less control than self-hosted Kubernetes
- Platform-specific limitations
- May require adaptation for very large scale

### 4. Enterprise Platforms (OpenShift, Tanzu, EKS, GKE, AKS)
**Best For**: Large enterprises with existing platform investments
**Components**:
- Platform-provided database services
- Platform-provided caching services
- Platform-native deployments
- Platform monitoring and security
- Platform service mesh (if applicable)

**Pros**:
- Leverages existing enterprise investments
- Meets enterprise compliance requirements
- Integrated with existing monitoring and security
- Supported by platform vendor
- Familiar operational procedures

**Cons**:
- May be more expensive than alternatives
- Less flexibility than pure Kubernetes
- Potential vendor lock-in considerations

## Containerization Details

All AgentSwarm services are designed to run as Docker containers with multi-stage builds for security and efficiency.

### Base Image Strategy
```dockerfile
# Multi-stage build example for Node.js services
FROM node:20-alpine AS base
WORKDIR /app

# Dependencies stage
FROM base AS dependencies
COPY package*.json ./
RUN npm ci --only=production

# Build stage (for Next.js)
FROM dependencies AS build
COPY . .
RUN npm run build

# Production stage
FROM base AS production
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package*.json ./
USER node
EXPOSE 3000
CMD ["npm", "start"]
```

### Service-Specific Considerations

#### API Service (`apps/api`)
- **Base**: Node.js 20-alpine
- **Expose**: Port 8787 (HTTP) or 443 (HTTPS via reverse proxy)
- **Health Check**: `GET /health`
- **Environment Variables**: Database URL, Redis URL, Qwen credentials, secrets
- **Volumes**: None (stateless)
- **Scaling**: Horizontal behind load balancer

#### Worker Service (`apps/worker`)
- **Base**: Node.js 20-alpine
- **Expose**: Port 8788 (HTTP for health checks)
- **Health Check**: `GET /health`
- **Environment Variables**: Same as API plus worker-specific settings
- **Volumes**: None (stateless)
- **Scaling**: Horizontal (multiple workers compete for task leases)
- **Special**: Needs access to filesystem for temporary operations

#### Webapp (`apps/webapp`)
- **Base**: Node.js 20-alpine
- **Expose**: Port 3000 (HTTP)
- **Health Check**: Custom endpoint or root path
- **Environment Variables**: NEXT_PUBLIC_API_URL
- **Volumes**: None (static assets built in)
- **Scaling**: Horizontal behind CDN or load balancer
- **Special**: Next.js output requires `.next` and `public` directories

#### Website (`apps/website`)
- **Base**: Node.js 20-alpine (for SSR) or nginx (for static)
- **Expose**: Port 80 (HTTP) or 443 (HTTPS)
- **Health Check**: Root path
- **Environment Variables**: Minimal (mostly build-time)
- **Volumes**: None
- **Scaling**: Horizontal behind CDN
- **Special**: Can be fully static for maximum performance and security

## Configuration Management

AgentSwarm uses environment variables for configuration, following twelve-factor app principles.

### Required Environment Variables
```env
# Core Services
DATABASE_URL=postgresql://user:pass@host:5432/dbname
REDIS_URL=redis://host:6379  # Optional - worker falls back to PostgreSQL polling
API_PORT=8787
WEB_ORIGIN=https://app.example.com  # Comma-separated list for CORS

# Qwen / AI Provider (Optional - missions block if not configured)
QWEN_API_KEY=your_key_here
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen-plus
QWEN_REQUEST_TIMEOUT_MS=120000

# Security (Generated if not present)
SESSION_SECRET=random_string_here
EVENT_SEALING_SECRET=random_string_here  # For event ledger sealing

# Worker-Specific
WORKER_ID=worker-${HOSTNAME}-${RANDOM}
WORKER_FALLBACK_POLL_MS=5000
WORKER_CONCURRENCY=4
TASK_LEASE_SECONDS=90
MAX_TASK_ATTEMPTS=3

# Feature Flags (Optional)
FEATURE_SCHEDULER_ENABLED=true
FEATURE_PWA_ENABLED=true
```

### Configuration Sources (in order of precedence)
1. **Environment Variables** (highest priority - for secrets and runtime config)
2. **Configuration Files** (`.env`, `.env.production`, etc. - for defaults)
3. **Service Defaults** (hardcoded in code - for development)
4. **Hardcoded Values** (rarely used - only for true constants)

### Secrets Management Recommendations
- **Local Development**: `.env` file (added to `.gitignore`)
- **Docker Compose**: `.env` file or Docker secrets
- **Kubernetes**: Kubernetes Secrets or external vault (HashiCorp Vault, AWS Secrets Manager, Azure Key Vault)
- **Fly.io**: Fly Secrets (`fly secrets set`)
- **Enterprise Platforms**: Platform-native secret management
- **Never commit secrets to version control**

## Deployment Guides

### 1. Local Development with Docker Compose

#### Step 1: Clone Repository
```bash
git clone https://github.com/CodesbyFebin/Agent-Swarm.git
cd Agent-Swarm
```

#### Step 2: Configure Environment
```bash
cp .env.example .env
# Edit .env with your settings
# For local dev, you can use defaults but set a strong SESSION_SECRET
```

#### Step 3: Start Services
```bash
docker compose up -d
# Or for development with logs:
docker compose up
```

#### Step 4: Initialize Database
```bash
docker compose exec api npm run migrate
```

#### Step 5: Access the Application
- Webapp: http://localhost:3000
- API: http://localhost:8787
- Documentation: http://localhost:3001 (if website deployed)

#### Step 6: Stop and Cleanup
```bash
docker compose down
# To also remove volumes (database data):
docker compose down -v
```

### 2. Deployment to Fly.io

#### Step 1: Install Fly CLI
```bash
curl -L https://fly.io/install.sh | sh
fly auth login
```

#### Step 2: Create Applications
```bash
# Create separate apps for each service
fly apps create agentswarm-api
fly apps create agentswarm-worker
fly apps create agentswarm-webapp
fly apps create agentswarm-website  # Optional
```

#### Step 3: Configure Secrets
```bash
# API secrets
fly secrets set \
  --app agentswarm-api \
  DATABASE_URL="postgresql://user:pass@host:5432/dbname" \
  REDIS_URL="redis://host:6379" \
  SESSION_SECRET="your_session_secret_here" \
  EVENT_SEALING_SECRET="your_event_sealing_secret_here" \
  QWEN_API_KEY="your_qwen_key_here" \
  QWEN_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"

# Worker secrets (same as API plus worker-specific)
fly secrets set \
  --app agentswarm-worker \
  DATABASE_URL="postgresql://user:pass@host:5432/dbname" \
  REDIS_URL="redis://host:6379" \
  SESSION_SECRET="your_session_secret_here" \
  EVENT_SEALING_SECRET="your_event_sealing_secret_here" \
  QWEN_API_KEY="your_qwen_key_here" \
  QWEN_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1" \
  WORKER_ID="worker-fly-${REGION}" \
  WORKER_FALLBACK_POLL_MS=5000 \
  WORKER_CONCURRENCY=4

# Webapp secrets
fly secrets set \
  --app agentswarm-webapp \
  NEXT_PUBLIC_API_URL="https://agentswarm-api.fly.dev"
```

#### Step 4: Deploy Services
```bash
# Deploy API
fly deploy \
  --app agentswarm-api \
  --dockerfile ./apps/api/Dockerfile

# Deploy Worker
fly deploy \
  --app agentswarm-worker \
  --dockerfile ./apps/worker/Dockerfile

# Deploy Webapp
fly deploy \
  --app agentswarm-webapp \
  --dockerfile ./apps/webapp/Dockerfile

# Deploy Website (optional)
fly deploy \
  --app agentswarm-website \
  --dockerfile ./apps/website/Dockerfile
```

#### Step 5: Verify Deployment
```bash
# Check API health
fly status --app agentswarm-api
curl https://agentswarm-api.fly.dev/health

# Access webapp
open https://agentswarm-webapp.fly.dev
```

#### Step 6: Monitor and Scale
```bash
# View logs
fly logs --app agentswarm-api

# Check metrics
fly status --app agentswarm-api

# Scale manually (or rely on auto-scaling)
fly scale count 3 --app agentswarm-api
```

### 3. Deployment to Kubernetes

#### Step 1: Prepare Manifests
Create Kubernetes manifests for each service:

##### api-deployment.yaml
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agentswarm-api
  labels:
    app: agentswarm-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: agentswarm-api
  template:
    metadata:
      labels:
        app: agentswarm-api
    spec:
      containers:
      - name: api
        image: agentswarm-api:latest
        ports:
        - containerPort: 8787
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: agentswarm-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: agentswarm-secrets
              key: redis-url
        - name: SESSION_SECRET
          valueFrom:
            secretKeyRef:
              name: agentswarm-secrets
              key: session-secret
        - name: EVENT_SEALING_SECRET
          valueFrom:
            secretKeyRef:
              name: agentswarm-secrets
              key: event-sealing-secret
        - name: QWEN_API_KEY
          valueFrom:
            secretKeyRef:
              name: agentswarm-secrets
              key: qwen-api-key
        - name: QWEN_BASE_URL
          value: "https://dashscope.aliyuncs.com/compatible-mode/v1"
        livenessProbe:
          httpGet:
            path: /health
            port: 8787
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8787
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

##### api-service.yaml
```yaml
apiVersion: v1
kind: Service
metadata:
  name: agentswarm-api
spec:
  selector:
    app: agentswarm-api
  ports:
  - protocol: TCP
    port: 8787
    targetPort: 8787
  type: ClusterIP
```

##### Similar manifests for Worker, Webapp, and Website

#### Step 2: Deploy Database and Redis
```bash
# Option 1: Use managed services (recommended for production)
# - AWS RDS/Aurora for PostgreSQL
# - AWS ElastiCache for Redis
# - Google Cloud SQL and Memorystore
# - Azure Database for PostgreSQL and Azure Cache for Redis

# Option 2: Self-hosted in Kubernetes (for dev/test)
# Use Helm charts like bitnami/postgresql and bitnami/redis
```

#### Step 3: Create Secrets
```bash
kubectl create secret generic agentswarm-secrets \
  --from-literal=database-url="postgresql://user:pass@host:5432/dbname" \
  --from-literal=redis-url="redis://host:6379" \
  --from-literal=session-secret="$(openssl rand -hex 32)" \
  --from-literal=event-sealing-secret="$(openssl rand -hex 32)" \
  --from-literal=qwen-api-key="your_qwen_key_here"
```

#### Step 4: Deploy Services
```bash
kubectl apply -f api-deployment.yaml
kubectl apply -f api-service.yaml
# Repeat for worker, webapp, website
```

#### Step 5: Configure Ingress
```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: agentswarm-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - api.example.com
    - app.example.com
    - www.example.com
    secretName: agentswarm-tls
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: agentswarm-api
            port:
              number: 8787
  - host: app.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: agentswarm-webapp
            port:
              number: 3000
  - host: www.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: agentswarm-website
            port:
              number: 80
```

#### Step 6: Add Monitoring and Logging
```bash
# Prometheus Operator
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack

# Loki for logging
helm repo add grafana https://grafana.github.io/helm-charts
helm install loki grafana/loki-stack

# Configure services to export metrics (via /metrics endpoint)
# Configure services to send logs to stdout/stderr for collection
```

#### Step 7: Access the Application
```bash
# Get external IPs or DNS names
kubectl get ingress

# Access via configured domains
# API: https://api.example.com/health
# Webapp: https://app.example.com
# Website: https://www.example.com
```

## Security Best Practices

### 1. Network Security
- **Principle of Least Privilege**: Services only communicate with required services
- **Network Policies**: Restrict pod-to-pod communication in Kubernetes
- **Security Groups**: Configure cloud firewall rules appropriately
- **Service Mesh**: Consider Istio/Linkerd for advanced traffic control (enterprise)
- **Private Networks**: Use private subnets for databases and internal services

### 2. Transport Security
- **TLS Everywhere**: Encrypt all traffic with TLS 1.2+
- **Certificate Management**: Use automated certificate management (Let's Encrypt, cert-manager)
- **HSTS**: Enable HTTP Strict Transport Security
- **Certificate Pinning**: Consider for high-security applications
- **Disable Weak Ciphers**: Configure servers to reject weak cipher suites

### 3. Authentication and Authorization
- **Strong Passwords**: Use strong, randomly generated passwords for database
- **Least Privilege DB Users**: Application users should have minimal required permissions
- **Session Security**: HTTP-only, secure, SameSite cookies with appropriate expiration
- **Multi-Factor Authentication**: Consider for administrative access
- **API Key Protection**: Store AI provider API keys as secrets, never in logs or config files

### 4. Application Security
- **Input Validation**: Validate all inputs using schema validation (Zod, Joi, etc.)
- **Output Encoding**: Properly encode output to prevent XSS
- **CSRF Protection**: Use @fastify/csrf-protection for state-changing operations
- **Rate Limiting**: Implement rate limiting on public endpoints
- **Security Headers**: Use Helmet.js with appropriate CSP and other headers
- **Dependency Scanning**: Regularly run npm audit and dependency checks
- **Static Analysis**: Use ESLint security plugins and similar tools

### 5. Data Protection
- **Encryption at Rest**: Enable for managed databases or use filesystem encryption
- **Backup Strategy**: Regular automated backups with tested restore procedures
- **Data Minimization**: Only store data necessary for operation
- **Data Retention**: Implement policies for event log archiving and deletion
- **Privacy Compliance**: Consider GDPR, CCPA, HIPAA etc. as applicable

### 6. Monitoring and Alerting
- **Health Checks**: Implement liveness and readiness probes
- **Metrics Collection**: Export Prometheus metrics from all services
- **Log Aggregation**: Centralize logs for search and analysis
- **Alerting**: Set up alerts for critical metrics (error rates, latency, resource usage)
- **Audit Logging**: Maintain audit trails for security-relevant events
- **Intrusion Detection**: Consider file integrity monitoring and log analysis tools

## Scaling Strategies

### Horizontal Pod Autoscaler (Kubernetes)
```yaml
# api-hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalScaler
metadata:
  name: agentswarm-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: agentswarm-api
  minReplicas: 2
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Pods
    pods:
      metric:
        name: queue_length  # Custom metric from Redis queue length
      target:
        type: AverageValue
        averageValue: 100  # Scale when average queue length per pod > 100
```

### Fly.io Autoscaling
Fly.io automatically scales based on:
- **Concurrent connections** for services
- **Custom metrics** via `fly scale count` or API
- **Queue depth** for workers (can be implemented with custom scaling scripts)

### Manual Scaling Guidelines
- **API Service**: Scale based on request volume and response time targets
- **Worker Service**: Scale based on queue depth and job processing time
- **Webapp Service**: Scale based on concurrent users and page load times
- **Website Service**: Scale based on traffic volume and geographic distribution

### Database Scaling
- **Read Replicas**: For read-heavy workloads
- **Connection Pooling**: To maximize efficient use of database connections
- **Caching**: Redis for frequently accessed data
- **Sharding**: Only when absolutely necessary (adds complexity)

## Maintenance and Operations

### Backup Procedures
1. **Database**: Regular pg_basebackup or managed service snapshots
2. **Configuration**: Version control for infrastructure-as-code
3. **Secrets**: Secure backup of encryption keys and secrets (separate from data)
4. **Application Data**: Minimal (mostly in database and object storage)

### Update Procedures
1. **Rolling Updates**: Kubernetes Deployments support rolling updates by default
2. **Blue/Green Deployments**: For zero-downtime releases with instant rollback
3. **Canary Releases**: Route small percentage of traffic to new version
4. **Feature Flags**: Enable/disable features without redeploying
5. **Database Migrations**: Backward-compatible migrations where possible

### Monitoring Dashboard Essentials
- **Infrastructure**: Node CPU, memory, disk, network usage
- **Application**: Request rates, error rates, latency (p50, p95, p99)
- **Business**: Mission throughput, completion rates, verification pass rates
- **Database**: Connection usage, query performance, replication lag
- **Queues**: Depth, processing rates, worker utilization
- **External Dependencies**: AI provider latency, error rates, usage costs

### Log Retention and Analysis
- **Application Logs**: JSON format for easy parsing, retained 7-30 days
- **Access Logs**: Combined format, retained for security analysis
- **Audit Logs**: Immutable format, retained per regulatory requirements
- **Error Logs**: Elevated alerting, retained longer for debugging
- **Security Logs**: Real-time alerting for suspicious activities

## Troubleshooting Common Issues

### 1. Container CrashLoopBackOff
**Symptoms**: Containers repeatedly crashing and restarting
**Diagnosis**:
```bash
kubectl logs pods/agentswarm-api-<hash>  # Kubernetes
docker logs agentswarm-api-<hash>        # Docker
fly logs --app agentswarm-api            # Fly.io
```
**Common Causes**:
- Missing environment variables (especially secrets)
- Database connection failures
- Port already in use
- Application code errors
- Insufficient resources (OOMKilled)

### 2. High Latency or Timeouts
**Symptoms**: Slow response times, gateway timeouts
**Diagnosis**:
- Check application metrics (response times, error rates)
- Check database performance (slow queries, connection pool exhaustion)
- Check external dependencies (AI provider latency, API timeouts)
- Check resource utilization (CPU, memory, network, disk I/O)
- Look for garbage collection pauses or event loop delays

**Solutions**:
- Scale horizontally
- Optimize database queries and add indexes
- Implement caching for frequently accessed data
- Optimize AI provider usage (batch requests, prompt optimization)
- Increase timeouts or retry logic where appropriate

### 3. Database Connection Issues
**Symptoms**: Connection refused, authentication failed, pool exhaustion
**Diagnosis**:
- Verify network connectivity and security groups/firewall rules
- Check database status and available connections
- Validate credentials and authentication method
- Check connection pool configuration (max connections, idle timeout)
- Look for connection leaks in application code

**Solutions**:
- Fix network/security issues
- Increase database max_connections if appropriate
- Use connection pooling (e.g., PgBouncer for PostgreSQL)
- Fix connection leaks in application code
- Consider read replicas for read-heavy workloads

### 4. Worker Scaling Issues
**Symptoms**: Tasks stuck in queue, workers idle while work remains
**Diagnosis**:
- Check worker logs for error messages
- Verify worker can lease tasks (database permissions, locking)
- Check task status distribution (stuck in specific states)
- Verify Redis connectivity if used for wake-up signals
- Look for long-running tasks blocking worker pool

**Solutions**:
- Fix worker permission issues
- Resolve database locking problems
- Investigate and fix problematic task types
- Adjust worker concurrency based on task characteristics
- Consider specialized worker pools for different task types

### 5. Verification Failures
**Symptoms**: Missions blocked due to verification failures
**Diagnosis**:
- Check verification worker logs for specific error details
- Review verification results in mission details
- Look for patterns in failure types (build, test, security, etc.)
- Determine if failures are due to actual issues or over-strict thresholds

**Solutions**:
- Fix underlying issues in generated work
- Adjust verification thresholds if too strict for context
- Improve mission templates to prevent recurring issues
- Enhance task definitions with better hints for verification
- Provide additional training or examples for common failure modes

## Performance Optimization

### Database Optimization
- **Indexing Strategy**: Index foreign keys, timestamps, and frequently queried columns
- **Query Optimization**: Use EXPLAIN to analyze slow queries
- **Connection Pooling**: Size pools appropriately for workload
- **Read Replicas**: Offload read queries from primary
- **Partitioning**: Consider for very large tables (events, tasks)
- **Archiving**: Move old events to archival storage

### Application Optimization
- **Caching Strategy**: 
  - Redis for expensive computations (when safe)
  - HTTP caching for static assets (CDN)
  - In-memory caches for frequently accessed data (with proper invalidation)
- **Code Optimization**:
  - Avoid synchronous operations in event loops
  - Use worker threads for CPU-intensive tasks
  - Optimize database queries and minimize round trips
  - Batch operations where possible
- **Asset Optimization**:
  - Image compression and resizing
  - JavaScript and CSS minification
  - Critical CSS extraction
  - Font subsetting and efficient loading

### Network Optimization
- **CDN Usage**: Serve static assets via CDN with appropriate cache headers
- **Connection Pooling**: For external service calls (API providers, etc.)
- **Request Batching**: Combine multiple requests when possible
- **Payload Optimization**: Compress JSON responses when beneficial
- **Geographic Distribution**: Place instances close to users

### Resource Optimization
- **Right-Sizing**: Match container resources to actual usage
- **Quality of Service**: Configure Kubernetes QoS classes appropriately
- **Namespace Resource Quotas**: Prevent namespace from consuming excessive resources
- **Limit Ranges**: Set default requests and limits for containers in namespace
- **Vertical Pod Autoscaler**: Automatically adjust resource requests based on usage

## Disaster Recovery and Business Continuity

### Backup Strategy
- **Database**: 
  - Hourly snapshots or WAL archiving (PostgreSQL)
  - Daily full backups with weekly/monthly retention
  - Test restore procedures quarterly
- **Configuration**: 
  - Version controlled (Git) with branch protection
  - Encrypted backups of secrets (separate location)
- **Application Data**: 
  - Minimal (mostly in database)
  - Object storage for generated artifacts (if externalized)
- **Secrets and Keys**: 
  - Hardware security modules or cloud KMS
  - Split knowledge and dual control for critical keys

### Recovery Procedures
1. **Single Instance Failure**: 
   - Kubernetes: Automatic rescheduling
   - Fly.io: Automatic replacement on healthy host
   - Docker Compose: Manual restart
2. **Zone/Region Failure**: 
   - Multi-zone/multi-region deployment
   - DNS failover or traffic manager
   - Automated failover scripts
3. **Complete Site Loss**: 
   - Cross-region backups
   - Recovery point objectives (RPO) and recovery time objectives (RTO)
   - Regular disaster recovery drills

### Data Consistency and Integrity
- **Event Ledger Integrity**: Regular verification of cryptographic seals
- **Database Consistency**: Regular checksum verification
- **Application State**: Ability to reconstruct state from event ledger
- **Backup Validation**: Regular test restores to verify usability
- **Chain of Custody**: Maintain audit trail for backup and restore operations

## Cost Optimization

### Right-Sizing Resources
- **Monitor Usage**: Track actual CPU, memory, network, and storage usage
- **Adjust Requests/Limits**: Based on observed usage patterns
- **Use Spot/Preemptible Instances**: For fault-tolerant workloads
- **Right-Size Databases**: Choose appropriate instance types and storage
- **Optimize Container Images**: Minimize layers and size

### Efficient Use of Services
- **Database Connection Pooling**: Maximize reuse of connections
- **Caching Layers**: Reduce database and external API calls
- **Batch Processing**: Group similar operations together
- **Asynchronous Processing**: Offload non-urgent work to queues
- **Cache Warming**: Pre-populate caches for predictable workloads

### Licensing and Open Source
- **Leverage Open Source**: Use open-source alternatives where appropriate
- **Review License Compliance**: Ensure all dependencies are properly licensed
- **Consider Alternatives**: Evaluate cost-benefit of proprietary vs open source
- **Contribute Back**: When appropriate, contribute improvements to open source projects

### Monitoring and Alerting for Costs
- **Usage Tracking**: Monitor resource consumption over time
- **Cost Allocation**: Attribute costs to specific projects, teams, or missions
- **Anomaly Detection**: Alert on unexpected usage spikes
- **Budget Alerts**: Notify when approaching budget thresholds
- **Optimization Recommendations**: Provide actionable cost-saving suggestions

## Future Deployment Considerations

### 1. Serverless and Edge Computing
- **Function-as-a-Service**: Explore AWS Lambda/Azure Functions for bursty workloads
- **Edge Deployment**: Run webapp and API closer to users for latency-sensitive tasks
- **Hybrid Approaches**: Combine serverless for APIs with containers for workers
- **Cold Start Optimization**: Mitigate cold start issues for latency-sensitive paths

### 2. Service Mesh and Observability
- **Advanced Traffic Control**: Istio/Linkert for fine-grained traffic management
- **Distributed Tracing**: Jaeger or Zipkin for end-to-end request tracing
- **Service Level Objectives**: Define and track SLIs, SLOs, SLAs
- **Canary Analysis**: Automated analysis of canary release impact
- **Service Dependency Mapping**: Automatic generation of service dependency graphs

### 3. GitOps and Infrastructure as Code
- **Declarative Infrastructure**: Manage all infrastructure via Git
- **Automated Sync**: Tools like ArgoCD or Flux to keep cluster in sync with Git
- **Preview Environments**: Automatic provisioning of preview environments for PRs
- **Infrastructure Testing**: Automated testing of infrastructure changes
- **Policy as Code**: Enforce security and compliance policies via automation

### 4. Artificial Intelligence for Operations (AIOps)
- **Predictive Scaling**: Use ML to predict workload and pre-scale resources
- **Anomaly Detection**: Identify unusual patterns before they cause incidents
- **Root Cause Analysis**: Automated correlation of events to find root causes
- **Auto-Remediation**: Automatically resolve common issues without human intervention
- **Capacity Planning**: Predict future resource needs based on trends

### 5. Sustainability and Green Computing
- **Carbon Awareness**: Schedule workloads to times/places with lower carbon intensity
- **Energy Efficient Algorithms**: Optimize for performance per watt
- **Hardware Utilization**: Maximize utilization to reduce embodied carbon
- **Circular Economy**: Responsible disposal and recycling of hardware
- **Reporting**: Track and report on environmental impact metrics

## Conclusion

Deploying AgentSwarm successfully requires attention to containerization, configuration, security, scaling, monitoring, and operational practices. Whether you choose a simple Docker Compose setup for development, a Fly.io deployment for ease of use, or a Kubernetes cluster for enterprise-scale operations, the principles remain the same:

1. **Containerize Consistently**: Use multi-stage builds for secure, efficient images
2. **Configure Externally**: Manage configuration and secrets outside the image
3. **Secure by Default**: Apply security principles at every layer
4. **Scale Appropriately**: Match scaling strategy to workload patterns and requirements
5. **Monitor Relentlessly**: Observe system behavior to detect and prevent issues
6. **Operate Excellently**: Implement reliable backup, update, and disaster recovery procedures

By following this guide, you can deploy AgentSwarm confidently in any environment, from a developer's laptop to a global enterprise deployment, ensuring reliable, secure, and scalable operation of your AI workforce control plane.

Ready to deploy? Start with [local Docker Compose](#1-local-development-with-docker-compose) for development and testing, then choose your preferred production deployment path based on your organization's needs and expertise.

## Related Resources
- [001-introduction.md](./001-introduction.md): What is AgentSwarm?
- [002-architecture.md](./002-architecture.md): Technical deep dive
- [003-use-cases.md](./003-use-cases.md): Real-world applications
- [004-model-routing.md](./004-model-routing.md): How we select AI providers
- [005-event-ledger.md](./005-event-ledger.md): Our tamper-evident event sourcing system
- [006-verification-gates.md](./006-verification-gates.md): Independent validation of AI work
- [DEPLOY.md](../DEPLOY.md): Original deployment instructions (Fly.io focused)
- [docker-compose.yml](../docker-compose.yml): Local development environment
- [apps/api/Dockerfile](../apps/api/Dockerfile): API service Dockerfile
- [apps/worker/Dockerfile](../apps/worker/Dockerfile): Worker service Dockerfile
- [apps/webapp/Dockerfile](../apps/webapp/Dockerfile): Webapp service Dockerfile
- [apps/website/Dockerfile](../apps/website/Dockerfile): Website service Dockerfile