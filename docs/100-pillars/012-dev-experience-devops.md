---
title: "AgentSwarm Developer Experience and DevOps: Building and Shipping with Confidence"
description: "Learn how to develop, test, and deploy AgentSwarm efficiently. Covers development environment setup, testing strategies, CI/CD pipelines, code quality, documentation practices, collaboration workflows, release management, and developer-focused observability."
date: "2026-08-19"
---

# AgentSwarm Developer Experience and DevOps: Building and Shipping with Confidence

## TL;DR: Optimize AgentSwarm development and deployment through standardized development environments, comprehensive testing strategies, automated CI/CD pipelines, strict code quality controls, clear documentation practices, effective collaboration workflows, and developer-centric observability to build and ship with confidence.

## Quick Facts

- **Development Principles**: Convention over configuration, automation first, shift-left testing, documentation as code
- **Testing Pyramid**: 70% unit tests, 20% integration tests, 10% end-to-end tests
- **CI/CD Pillars**: Continuous Integration, Continuous Delivery, Continuous Deployment
- **Code Quality**: Automated linting, formatting, security scanning, dependency checking
- **Documentation**: Docs as code, version-controlled, published with every release
- **Collaboration**: Trunk-based development, feature flags, pull request standards
- **Release Management**: Semantic versioning, changelogs, feature flags, canary releases
- **Developer Observability**: Local debugging tools, development-specific metrics, profiling capabilities
- **Related Pillars**: [001-introduction.md](./001-introduction.md), [002-architecture.md](./002-architecture.md), [003-use-cases.md](./003-use-cases.md), [004-model-routing.md](./004-model-routing.md), [005-event-ledger.md](./005-event-ledger.md), [006-verification-gates.md](./006-verification-gates.md), [007-deployment-guide.md](./007-deployment-guide.md), [008-security-best-practices.md](./008-security-best-practices.md), [009-performance-optimization.md](./009-performance-optimization.md), [010-monitoring-observability.md](./010-monitoring-observability.md), [011-scalability-high-availability.md](./011-scalability-high-availability.md)

## Developer Experience Philosophy

Developer experience (DX) in AgentSwarm follows the principle that productive developers create better software. This is achieved through:

```
Standardize → Automate → Validate → Iterate
```

### Key Principles
1. **Standardize Environments**: Eliminate "works on my machine" problems with reproducible development environments
2. **Automate Everything**: Automate testing, building, deployment, and repetitive tasks
3. **Shift Left Testing**: Catch defects early in the development process when they're cheapest to fix
4. **Documentation as Code**: Treat documentation with the same rigor as source code
5. **Continuous Feedback**: Provide rapid feedback on code quality, test results, and build status
6. **Collaboration-First**: Optimize for team collaboration through clear processes and tools
7. **Observability for Developers**: Give developers the tools they need to understand and debug their code
8. **Safe to Fail**: Make it easy to experiment, rollback, and recover from mistakes
9. **Optimize for Flow**: Minimize context switching and waiting time
10. **Invest in Tooling**: Spend time improving developer tools - it pays dividends in productivity

## Development Environment Setup

### Reproducible Development Environments
All AgentSwarm developers should be able to start working with minimal setup time and confidence that their environment matches production as closely as possible.

#### 1. Containerized Development
- **Docker Compose**: For defining and running multi-container development environments
- **Development Containers (devcontainer)**: VS Code Remote Containers for consistent IDE experience
- **Environment Parity**: Use same base images, versions, and configurations as production where possible
- **Selective Differences**: Allow for developer-specific tools (debuggers, profilers) while keeping runtime consistent

#### Example: docker-compose.dev.yml
```yaml
version: '3.8'

services:
  # API Server
  api:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgres://postgres:postgres@db:5432/agentswarm
      - REDIS_URL=redis://redis:6379
      - LOG_LEVEL=debug
    volumes:
      - ./apps/api:/app/apps/api:cached
      - ./apps/worker:/app/apps/worker:cached
      - ./libs:/app/libs:cached
    depends_on:
      - db
      - redis

  # Worker
  worker:
    build:
      context: .
      dockerfile: Dockerfile.dev
    command: npm run start:worker
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgres://postgres:postgres@db:5432/agentswarm
      - REDIS_URL=redis://redis:6379
      - LOG_LEVEL=debug
    volumes:
      - ./apps/api:/app/apps/api:cached
      - ./apps/worker:/app/apps/worker:cached
      - ./libs:/app/libs:cached
    depends_on:
      - db
      - redis

  # Scheduler
  scheduler:
    build:
      context: .
      dockerfile: Dockerfile.dev
    command: npm run start:scheduler
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgres://postgres:postgres@db:5432/agentswarm
      - REDIS_URL=redis://redis:6379
      - LOG_LEVEL=debug
    volumes:
      - ./apps/api:/app/apps/api:cached
      - ./apps/worker:/app/apps/worker:cached
      - ./libs:/app/libs:cached
    depends_on:
      - db
      - redis

  # Database
  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=agentswarm
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infra/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    ports:
      - "5432:5432"

  # Redis
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

#### 2. Development Tools Standardization
- **Editor Configuration**: Shared VS Code settings, extensions, and formatting rules
- **Package Managers**: Specific versions of npm, yarn, or pnpm locked in
- **Language Runtimes**: Specific Node.js versions managed via nvm, fnm, or volta
- **Git Configuration**: Standard hooks, commit message templates, and diff tools
- **CLI Tools**: Standardized versions of docker, kubectl, helm, terraform, etc.

#### 3. Local Development Scripts
- **One-Command Startup**: Single command to start all necessary services
- **Dependency Management**: Automated installation of development dependencies
- **Database Migrations**: Automated application of database schema changes
- **Test Execution**: Easy ways to run different types of tests
- **Code Quality**: One-command linting, formatting, and fixing

#### Example: Package.json Scripts
```json
{
  "scripts": {
    // Development
    "dev": "concurrently \"npm:dev:api\" \"npm:dev:worker\" \"npm:dev:scheduler\"",
    "dev:api": "npm --prefix apps/api run dev",
    "dev:worker": "npm --prefix apps/worker run dev",
    "dev:scheduler": "npm --prefix apps/scheduler run dev",
    
    // Testing
    "test": "npm --prefix apps/api run test && npm --prefix apps/worker run test && npm --prefix libs run test",
    "test:unit": "npm run test -- --testPathPattern=__tests__ --testNamePattern=\\bunit\\b",
    "test:integration": "npm run test -- --testPathPattern=__tests__ --testNamePattern=\\bintegration\\b",
    "test:e2e": "npm --prefix apps/e2e run test",
    "test:watch": "npm test -- --watch",
    
    // Code Quality
    "lint": "eslint . --ext .js,.jsx,.ts,.tsx",
    "lint:fix": "eslint . --ext .js,.jsx,.ts,.tsx --fix",
    "format": "prettier --write \"**/*.{js,jsx,ts,tsx,json,css,scss,md}\"",
    "format:check": "prettier --check \"**/*.{js,jsx,ts,tsx,json,css,scss,md}\"",
    "type-check": "tsc --noEmit",
    
    // Database
    "db:reset": "npm run db:drop && npm run db:create && npm run db:migrate && npm run db:seed",
    "db:migrate": "node ./infra/scripts/migrate.js",
    "db:seed": "node ./infra/scripts/seed.js",
    
    // DevOps
    "start:docker": "docker-compose -f docker-compose.dev.yml up",
    "stop:docker": "docker-compose -f docker-compose.dev.yml down",
    "clean:docker": "docker-compose -f docker-compose.dev.yml down -v",
    
    // Debugging
    "debug:api": "node --inspect-brk ./apps/api/src/index.js",
    "debug:worker": "node --inspect-brk ./apps/worker/src/index.js",
    "profile:api": "clinic doctor -- node ./apps/api/src/index.js",
    
    // Documentation
    "docs:dev": "mkdocs serve",
    "docs:build": "mkdocs build",
    
    // Release
    "release:patch": "standard-version --release-as patch",
    "release:minor": "standard-version --release-as minor",
    "release:major": "standard-version --release-as major"
  }
}
```

## Testing Strategies

### The Testing Pyramid
AgentSwarm follows the classic testing pyramid to optimize for fast feedback and high confidence:

```
               UI Tests (E2E)
                   10%
                 _________
                |         |
               | Integration |
               |   Tests   | 20%
                |_________|
                   |     |
              _____|_____|_____
             |                 |
            |   Unit Tests    |
            |       70%       |
             |_________________|
```

### 1. Unit Tests
- **Purpose**: Test individual functions, classes, or modules in isolation
- **Scope**: Single unit of work with mocked dependencies
- **Speed**: Very fast (milliseconds per test)
- **Frequency**: Run on every save or commit
- **Frameworks**: Jest, Vitest, Jasmine, Mocha
- **Best Practices**:
  - Test public interfaces, not private implementation details
  - Use meaningful test names that describe behavior
  - Arrange-Act-Assert (AAA) pattern
  - Test both positive and negative cases
  - Mock external dependencies (database, network, file system)
  - Keep tests independent and repeatable
  - Aim for high coverage on complex logic (80%+)
  - Don't aim for 100% line coverage - focus on meaningful test scenarios

#### Example: Unit Test for Utility Function
```javascript
// utils/dateUtils.js
export function formatDuration(seconds) {
  if (seconds < 0) return '00:00:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// __tests__/dateUtils.unit.test.js
import { formatDuration } from '../utils/dateUtils';

describe('formatDuration', () => {
  test('formats zero seconds correctly', () => {
    expect(formatDuration(0)).toBe('00:00:00');
  });

  test('formats seconds less than one minute', () => {
    expect(formatDuration(45)).toBe('00:00:45');
  });

  test('formats seconds exactly one minute', () => {
    expect(formatDuration(60)).toBe('00:01:00');
  });

  test('formats seconds with hours', () => {
    expect(formatDuration(3665)).toBe('01:01:05');
  });

  test('handles negative input', () => {
    expect(formatDuration(-10)).toBe('00:00:00');
  });

  test('formats large number of seconds', () => {
    expect(formatDuration(86400)).toBe('24:00:00');
  });
});
```

### 2. Integration Tests
- **Purpose**: Test interactions between multiple components or services
- **Scope**: Subsystem level with some external dependencies replaced
- **Speed**: Moderate (seconds to tens of seconds per test)
- **Frequency**: Run on every pull request or commit to main branch
- **Frameworks**: Jest, Vitest, Supertest (for API), custom test harnesses
- **Best Practices**:
  - Test real interactions between components
  - Use test databases or service mocks
  - Test both success and failure paths
  - Clean up test data after each test
  - Use transactions or containerization for isolation
  - Focus on contracts and interfaces between components
  - Test error handling and edge cases
  - Keep tests independent when possible

#### Example: Integration Test for API Endpoint
```javascript
// __tests__/api/missions.integration.test.js
const request = require('supertest');
const { sequelize } = require('../../libs/db');
const { app } = require('../../apps/api/src/index');

describe('Missions API', () => {
  let dbConnection;

  beforeAll(async () => {
    // Connect to test database
    dbConnection = await sequelize.authenticate();
    
    // Run migrations
    await sequelize.sync({ force: true });
    
    // Seed test data
    await require('../../infra/scripts/seed.test.js')();
  });

  afterAll(async () => {
    await dbConnection.close();
  });

  describe('POST /missions', () => {
    test('creates a new mission successfully', async () => {
      const missionData = {
        goal: 'Test mission for integration test',
        mode: 'SWARM',
        organizationId: 'org-test-123',
        projectId: 'proj-test-456'
      };

      const response = await request(app)
        .post('/missions')
        .send(missionData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.goal).toBe(missionData.goal);
      expect(response.body.mode).toBe(missionData.mode);
      expect(response.body.status).toBe('QUEUED');
      expect(response.body).toHaveProperty('createdAt');
    });

    test('returns validation error for invalid goal', async () => {
      const invalidMissionData = {
        goal: 'AB', // Too short
        mode: 'SWARM',
        organizationId: 'org-test-123',
        projectId: 'proj-test-456'
      };

      const response = await request(app)
        .post('/missions')
        .send(invalidMissionData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/goal/i);
    });

    test('returns 401 for unauthenticated request', async () => {
      const missionData = {
        goal: 'Test mission',
        mode: 'SWARM',
        organizationId: 'org-test-123',
        projectId: 'proj-test-456'
      };

      const response = await request(app)
        .post('/missions')
        .send(missionData)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/authentication/i);
    });
  });
});
```

### 3. End-to-End (E2E) Tests
- **Purpose**: Test complete user workflows from start to finish
- **Scope**: Full system with real or near-real dependencies
- **Speed**: Slow (tens of seconds to minutes per test)
- **Frequency**: Run on every commit to main branch or before releases
- **Frameworks**: Cypress, Playwright, TestCafe
- **Best Practices**:
  - Test real user journeys, not just technical paths
  - Use production-like data and configurations
  - Test both happy paths and error conditions
  - Make tests resilient to UI changes (use data-testid attributes)
  - Clean up test data after each test
  - Run tests in parallel when possible to reduce time
  - Use visual regression testing for UI components when appropriate
  - Test across different browsers and devices when relevant
  - Keep test suites focused and maintainable

#### Example: E2E Test for Mission Creation Workflow
```javascript
// e2e/tests/mission-creation.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Mission Creation Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Start from login page
    await page.goto('/login');
    
    // Login with test credentials
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard to load
    await page.waitForURL('/dashboard');
  });

  test('user can create a mission and see it in the list', async ({ page }) => {
    // Click new mission button
    await page.click('button:has-text("New Mission")');
    
    // Fill in mission form
    await page.fill('textarea[placeholder="Describe a mission…"]', 
      'Create a simple web page that displays "Hello, World!"');
    
    // Select SWARM mode
    await page.click('button:has-text("SWARM")');
    
    // Submit mission
    await page.click('button:has-text("Start Mission →")');
    
    // Wait for mission to appear in list
    await page.waitForSelector('.missionNav:has-text("Create a simple web page")');
    
    // Verify mission appears in list
    const missionItem = await page.locator('.missionNav:has-text("Create a simple web page")');
    await expect(missionItem).toBeVisible();
    
    // Verify mission status
    const statusDot = missionItem.locator('.statusDot');
    await expect(statusDot).toHaveCSS('background-color', 'rgb(82, 82, 91)'); // QUEUED color
  });

  test('user can see mission details after creation', async ({ page }) => {
    // Create a mission (same as previous test)
    await page.click('button:has-text("New Mission")');
    await page.fill('textarea[placeholder="Describe a mission…"]', 
      'Write a Python script that calculates Fibonacci numbers');
    await page.click('button:has-text("SWARM")');
    await page.click('button:has-text("Start Mission →")');
    
    // Wait for mission to appear and click it
    await page.waitForSelector('.missionNav:has-text("Write a Python script")');
    await page.click('.missionNav:has-text("Write a Python script")');
    
    // Verify mission details page loads
    await page.waitForSelector('.missionHead h1');
    await expect(page.locator('.missionHead h1')).toHaveText(
      'Write a Python script that calculates Fibonacci numbers'
    );
    
    // Verify mission status is visible
    await expect(page.locator('.chip')).toContainText('QUEUED');
    
    // Verify mission metadata is present
    await expect(page.locator('.missionMeta')).toBeVisible();
  });

  test('mission progresses through states correctly', async ({ page }) => {
    // This test would require mocking or controlling the worker execution
    // In a real implementation, you might:
    // 1. Create a mission
    // 2. Trigger worker execution via API or direct database manipulation
    // 3. Verify state transitions: QUEUED → PLANNING → RUNNING → COMPLETED
    // 
    // For simplicity, we'll show the structure:
    
    // Create mission
    await page.click('button:has-text("New Mission")');
    await page.fill('textarea[placeholder="Describe a mission…"]', 
      'Long running task for state transition test');
    await page.click('button:has-text("SWARM")');
    await page.click('button:has-text("Start Mission →")');
    
    // Wait for mission to appear
    await page.waitForSelector('.missionNav:has-text("Long running task")');
    
    // In a real test, you would:
    // 1. Manually trigger execution or wait for worker
    // 2. Poll for status changes
    // 3. Verify each state transition
    // 
    // For demonstration, we'll just verify the initial state
    const missionItem = await page.locator('.missionNav:has-text("Long running task")');
    const statusDot = missionItem.locator('.statusDot');
    await expect(statusDot).toHaveCSS('background-color', 'rgb(82, 82, 91)'); // QUEUED
  });
});
```

### Testing Strategies by Component
#### 1. API Server Testing
- **Unit Tests**: Controllers, services, utilities, middleware
- **Integration Tests**: API endpoints with test database, authentication flows
- **E2E Tests**: Complete user journeys through the API (authentication, CRUD operations)
- **Contract Tests**: Verify API matches OpenAPI/Swagger specification
- **Performance Tests**: Load testing for endpoints under various conditions

#### 2. Worker Testing
- **Unit Tests**: Task execution logic, tool adapters, verification workers
- **Integration Tests**: Worker pulling tasks from queue, processing, reporting results
- **E2E Tests**: Complete mission processing workflow (creation → execution → completion)
- **Fault Injection Tests**: How workers handle tool failures, timeouts, retries
- **Performance Tests**: Task processing throughput under various loads

#### 3. Scheduler Testing
- **Unit Tests**: Job scheduling logic, cron expression parsing, conflict detection
- **Integration Tests**: Scheduler triggering jobs, handling misfires, pause/resume functionality
- **E2E Tests**: Complete scheduling workflow (job creation → triggering → execution)
- **Time-Based Tests**: Testing behavior at specific times, timezone handling
- **Fault Injection Tests**: How scheduler handles database unavailability, etc.

#### 4. Library/Shared Code Testing
- **Unit Tests**: Individual functions, classes, utilities
- **Integration Tests**: Interactions between different library components
- **Property-Based Testing**: For algorithms where input/output relationships can be defined
- **Fuzzing**: For security-critical or complex parsing logic
- **Benchmark Testing**: For performance-sensitive algorithms

### Test Data Management
#### 1. Test Databases
- **Isolated Instances**: Separate database for each test suite or test run
- **Schema Migrations**: Automatically apply migrations to test database
- **Seed Data**: Pre-populate with known good data for tests
- **Data Reset**: Truncate tables or use transactions to reset between tests
- **Example**: Using transactions for test isolation
  ```javascript
  // Before each test
  await sequelize.transaction(async (t) => {
    // Run test within transaction
    await runMyTest(t);
    // Transaction automatically rolled back after test
  });
  ```

#### 2. Mock Services and Servers
- **External API Mocks**: Use tools like msw, nock, or wiremock to simulate external services
- **Database Mocks**: Use in-memory databases (sqlite) or mocking libraries
- **File System Mocks**: Use memory-based file systems for testing file operations
- **Message Queue Mocks**: Use in-memory queue implementations for testing

#### 3. Test Data Factories
- **Factory Pattern**: Functions that create test objects with sensible defaults
- **Customization**: Allow overriding specific fields when needed
- **Relationships**: Handle creating related objects automatically
- **Example**: Using factory-bot or similar pattern
  ```javascript
  // factories/missionFactory.js
  const missionFactory = {
    build: (overrides = {}) => {
      const defaultMission = {
        id: `mission-${Math.random().toString(36).substr(2, 9)}`,
        goal: 'Test mission goal',
        mode: 'SWARM',
        organizationId: 'org-test-123',
        projectId: 'proj-test-456',
        status: 'QUEUED',
        progress: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      return { ...defaultMission, ...overrides };
    },
    
    // Create multiple missions
    buildMany: (count, overrides = {}) => {
      return Array.from({ length: count }, (_, i) => 
        missionFactory.build({
          ...overrides,
          goal: `${overrides.goal || 'Test mission'} ${i + 1}`
        })
      );
    }
  };
  
  module.exports = missionFactory;
  ```
  
  // Usage in test
  const missionFactory = require('../factories/missionFactory');
  
  test('returns paginated mission list', async () => {
    // Create test data
    const missions = missionFactory.buildMany(25, {
      organizationId: 'org-test-123'
    });
    
    // Insert into test database
    await Mission.bulkCreate(missions);
    
    // Test pagination
    const response = await request(app)
      .get('/missions?organizationId=org-test-123&page=2&limit=10')
      .expect(200);
    
    expect(response.body.missions).toHaveLength(10);
    expect(response.body.total).toBe(25);
    expect(response.body.page).toBe(2);
    expect(response.body.limit).toBe(10);
    expect(response.body.pages).toBe(3);
  });
  ```

### Testing in CI/CD Pipeline
#### 1. Pre-Commit Hooks
- **Purpose**: Catch simple issues before committing
- **Checks**: 
  - Linting errors
  - Formatting issues
  - Obvious syntax errors
  - Security secrets in code
- **Tools**: Husky, lint-staged, pre-commit
- **Example**: .husky/pre-commit
  ```bash
  #!/bin/sh
  . "$(dirname "$0")/_/husky.sh"

  echo 'Running pre-commit checks...'
  
  # Run lint-staged (only on staged files)
  npx lint-staged
  
  # Check for secrets
  npx detect-secrets-staged --prevent
  
  echo 'Pre-commit checks passed!'
  ```

#### 2. Pull Request Checks
- **Purpose**: Ensure code quality before merging
- **Checks**:
  - Unit tests pass
  - Integration tests pass
  - Code coverage meets thresholds
  - Linting passes
  - Formatting is correct
  - Dependency checks pass
  - Security scans pass
  - Build succeeds
- **Implementation**: CI pipeline triggered on pull request events

#### 3. Main Branch Protection
- **Purpose**: Ensure main branch is always deployable
- **Checks**:
  - All PR checks must pass
  - No direct pushes to main branch
  - Required number of approvals
  - Status checks up to date
  - Build from main branch succeeds
  - Deploy to staging environment succeeds
  - Smoke tests pass in staging

#### 4. Release Gatekeeping
- **Purpose**: Ensure releases meet quality standards
- **Checks**:
  - All tests pass on release candidate
  - Performance benchmarks met
  - Security scan passes
  - Documentation builds successfully
  - Release notes/changelog generated
  - Artifacts signed and verified
  - Deployment to production succeeds
  - Post-deployment smoke tests pass

## CI/CD Pipelines

### Continuous Integration (CI)
#### Purpose
- Detect integration issues early
- Ensure code quality standards are met
- Provide rapid feedback to developers
- Prevent broken code from reaching main branch

#### Pipeline Stages
1. **Checkout**: Get source code from repository
2. **Setup**: Install dependencies, set up environment
3. **Build**: Compile/transpile code (if needed)
4. **Test**: Run unit, integration, and other tests
5. **Quality**: Linting, formatting, security checks
6. **Artifact**: Build deployable artifacts (Docker images, bundles, etc.)
7. **Publish**: Publish artifacts to registry (if not deploying directly)
8. **Notify**: Inform team of build status

#### Example: GitHub Actions CI Workflow
```yaml
name: CI

on:
  pull_request:
    branches: [ main ]
  push:
    branches: [ main ]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: agentswarm_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        ports: [5432:5432]
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports: [6379:6379]
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    env:
      NODE_ENV: test
      DATABASE_URL: postgres://postgres:postgres@localhost:5432/agentswarm_test
      REDIS_URL: redis://localhost:6379
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linting
      run: npm run lint
    
    - name: Run formatting check
      run: npm run format:check
    
    - name: Run unit tests
      run: npm run test:unit
    
    - name: Run integration tests
      run: npm run test:integration
    
    - name: Run security audit
      run: npm audit --production
    
    - name: Check for secrets
      uses: gitleaks/gitleaks-action@v2
      with:
        config-path: .gitleaks.toml
    
    - name: Build Docker images
      run: |
        docker-compose -f docker-compose.prod.yml build
        docker tag agentswarm-api ${{ secrets.DOCKER_USERNAME }}/agentswarm-api:${{ github.sha }}
        docker tag agentswarm-worker ${{ secrets.DOCKER_USERNAME }}/agentswarm-worker:${{ github.sha }}
        docker tag agentswarm-scheduler ${{ secrets.DOCKER_USERNAME }}/agentswarm-scheduler:${{ github.sha }}
    
    - name: Upload build artifacts
      uses: actions/upload-artifact@v4
      with:
        name: docker-images
        path: |
          ./apps/api/Dockerfile
          ./apps/worker/Dockerfile
          ./apps/scheduler/Dockerfile
          docker-images.tar
    
    - name: Post results to PR
      if: failure()
      uses: actions/github-script@v7
      with:
        script: |
          github.rest.issues.createComment({
            issue_number: context.issue.number,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: `CI build failed for commit ${context.sha}. See ${context.payload.repository.html_url}/actions/runs/${context.run_id} for details.`
          });
```

### Continuous Delivery (CD)
#### Purpose
- Ensure code is always in a deployable state
- Automate deployment to staging environments
- Validate releases before promoting to production
- Enable fast, reliable releases on demand

#### Pipeline Stages
1. **Trigger**: Manual approval or main branch push
2. **Checkout**: Get source code from repository
3. **Setup**: Install dependencies, set up environment
4. **Build**: Compile/transpile code and build artifacts
5. **Test**: Run comprehensive test suite (including some E2E)
6. **Deploy**: Deploy to staging environment
7. **Validate**: Run smoke tests and health checks in staging
8. **Approve**: Manual approval for production promotion (optional)
9. **Promote**: Deploy to production (if auto-deploy enabled)
10. **Monitor**: Monitor production deployment for issues
11. **Notify**: Inform team of deployment status

#### Example: GitHub Actions CD Workflow
```yaml
name: CD

on:
  push:
    branches: [ main ]

jobs:
  deploy-to-staging:
    runs-on: ubuntu-latest
    environment: staging
    timeout-minutes: 60
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: agentswarm_staging
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: ${{ secrets.STAGING_DB_PASSWORD }}
        ports: [5432:5432]
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports: [6379:6379]
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    env:
      NODE_ENV: production
      DATABASE_URL: postgres://postgres:${{ secrets.STAGING_DB_PASSWORD }}@localhost:5432/agentswarm_staging
      REDIS_URL: redis://localhost:6379
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm test
    
    - name: Build Docker images
      run: |
        docker-compose -f docker-compose.prod.yml build
        docker tag agentswarm-api ${{ secrets.DOCKER_USERNAME }}/agentswarm-api:${{ github.sha }}
        docker tag agentswarm-worker ${{ secrets.DOCKER_USERNAME }}/agentswarm-worker:${{ github.sha }}
        docker tag agentswarm-scheduler ${{ secrets.DOCKER_USERNAME }}/agentswarm-scheduler:${{ github.sha }}
    
    - name: Login to Docker Hub
      uses: docker/login-action@v3
      with:
        username: ${{ secrets.DOCKER_USERNAME }}
        password: ${{ secrets.DOCKER_TOKEN }}
    
    - name: Push Docker images
      run: |
        docker push ${{ secrets.DOCKER_USERNAME }}/agentswarm-api:${{ github.sha }}
        docker push ${{ secrets.DOCKER_USERNAME }}/agentswarm-worker:${{ github.sha }}
        docker push ${{ secrets.DOCKER_USERNAME }}/agentswarm-scheduler:${{ github.sha }}
    
    - name: Deploy to staging
      run: |
        # Assuming we're using Kubernetes
        kubectl set image deployment/agentswarm-api api=${{ secrets.DOCKER_USERNAME }}/agentswarm-api:${{ github.sha }} -n staging
        kubectl set image deployment/agentswarm-worker worker=${{ secrets.DOCKER_USERNAME }}/agentswarm-worker:${{ github.sha }} -n staging
        kubectl set image deployment/agentswarm-scheduler scheduler=${{ secrets.DOCKER_USERNAME }}/agentswarm-scheduler:${{ github.sha }} -n staging
        
        # Wait for rollout to complete
        kubectl rollout status deployment/agentswarm-api -n staging --timeout=120s
        kubectl rollout status deployment/agentswarm-worker -n staging --timeout=120s
        kubectl rollout status deployment/agentswarm-scheduler -n staging --timeout=120s
    
    - name: Run smoke tests
      run: |
        # Wait for services to be ready
        sleep 30
        
        # Basic health check
        curl -f http://staging-api.agentswarm.in/healthz || exit 1
        
        # Authenticated endpoint check
        curl -f -H "Authorization: Bearer ${{ secrets.STAGING_TEST_TOKEN }}" \
          http://staging-api.agentswarm.in/api/me || exit 1
        
        # Mission creation test
        MISSION_ID=$(curl -s -X POST \
          -H "Content-Type: application/json" \
          -H "Authorization: Bearer ${{ secrets.STAGING_TEST_TOKEN }}" \
          -d '{"goal":"CD test mission","mode":"SWARM","organizationId":"org-test","projectId":"proj-test"}' \
          http://staging-api.agentswarm.in/api/missions | jq -r .id)
        
        [ -n "$MISSION_ID" ] || exit 1
        
        # Clean up test mission
        curl -X DELETE \
          -H "Authorization: Bearer ${{ secrets.STAGING_TEST_TOKEN }}" \
          http://staging-api.agentswarm.in/api/missions/$MISSION_ID || true
    
    - name: Notify team
      if: success()
      uses: actions/github-script@v7
      with:
        script: |
          github.rest.issues.createComment({
            issue_number: context.payload.pull_request?.number || 0,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: `CD to staging successful for commit ${context.sha}.`
          });
    
    - name: Notify team on failure
      if: failure()
      uses: actions/github-script@v7
      with:
        script: |
          github.rest.issues.createComment({
            issue_number: context.payload.pull_request?.number || 0,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: `CD to staging failed for commit ${context.sha}. See ${context.payload.repository.html_url}/actions/runs/${context.run_id} for details.`
          });

  deploy-to-production:
    needs: deploy-to-staging
    runs-on: ubuntu-latest
    environment: production
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    timeout-minutes: 60
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: agentswarm_prod
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: ${{ secrets.PRODUCTION_DB_PASSWORD }}
        ports: [5432:5432]
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports: [6379:6379]
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    env:
      NODE_ENV: production
      DATABASE_URL: postgres://postgres:${{ secrets.PRODUCTION_DB_PASSWORD }}@localhost:5432/agentswarm_prod
      REDIS_URL: redis://localhost:6379
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm test
    
    - name: Build Docker images
      run: |
        docker-compose -f docker-compose.prod.yml build
        docker tag agentswarm-api ${{ secrets.DOCKER_USERNAME }}/agentswarm-api:${{ github.sha }}
        docker tag agentswarm-worker ${{ secrets.DOCKER_USERNAME }}/agentswarm-worker:${{ github.sha }}
        docker tag agentswarm-scheduler ${{ secrets.DOCKER_USERNAME }}/agentswarm-scheduler:${{ github.sha }}
    
    - name: Login to Docker Hub
      uses: docker/login-action@v3
      with:
        username: ${{ secrets.DOCKER_USERNAME }}
        password: ${{ secrets.DOCKER_TOKEN }}
    
    - name: Push Docker images
      run: |
        docker push ${{ secrets.DOCKER_USERNAME }}/agentswarm-api:${{ github.sha }}
        docker push ${{ secrets.DOCKER_USERNAME }}/agentswarm-worker:${{ github.sha }}
        docker push ${{ secrets.DOCKER_USERNAME }}/agentswarm-scheduler:${{ github.sha }}
    
    - name: Deploy to production
      run: |
        # Assuming we're using Kubernetes
        kubectl set image deployment/agentswarm-api api=${{ secrets.DOCKER_USERNAME }}/agentswarm-api:${{ github.sha }} -n production
        kubectl set image deployment/agentswarm-worker worker=${{ secrets.DOCKER_USERNAME }}/agentswarm-worker:${{ github.sha }} -n production
        kubectl set image deployment/agentswarm-scheduler scheduler=${{ secrets.DOCKER_USERNAME }}/agentswarm-scheduler:${{ github.sha }} -n production
        
        # Wait for rollout to complete
        kubectl rollout status deployment/agentswarm-api -n production --timeout=180s
        kubectl rollout status deployment/agentswarm-worker -n production --timeout=180s
        kubectl rollout status deployment/agentswarm-scheduler -n production --timeout=180s
    
    - name: Run smoke tests
      run: |
        # Wait for services to be ready
        sleep 30
        
        # Basic health check
        curl -f http://api.agentswarm.in/healthz || exit 1
        
        # Authenticated endpoint check
        curl -f -H "Authorization: Bearer ${{ secrets.PRODUCTION_TEST_TOKEN }}" \
          http://api.agentswarm.in/api/me || exit 1
        
        # Mission creation test
        MISSION_ID=$(curl -s -X POST \
          -H "Content-Type: application/json" \
          -H "Authorization: Bearer ${{ secrets.PRODUCTION_TEST_TOKEN }}" \
          -d '{"goal":"CD test mission","mode":"SWARM","organizationId":"org-test","projectId":"proj-test"}' \
          http://api.agentswarm.in/api/missions | jq -r .id)
        
        [ -n "$MISSION_ID" ] || exit 1
        
        # Clean up test mission
        curl -X DELETE \
          -H "Authorization: Bearer ${{ secrets.PRODUCTION_TEST_TOKEN }}" \
          http://api.agentswarm.in/api/missions/$MISSION_ID || true
    
    - name: Notify team
      if: success()
      uses: actions/github-script@v7
      with:
        script: |
          github.rest.issues.createComment({
            issue_number: context.payload.pull_request?.number || 0,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: `CD to production successful for commit ${context.sha}.`
          });
    
    - name: Notify team on failure
      if: failure()
      uses: actions/github-script@v7
      with:
        script: |
          github.rest.issues.createComment({
            issue_number: context.payload.pull_request?.number || 0,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: `CD to production failed for commit ${context.sha}. See ${context.payload.repository.html_url}/actions/runs/${context.run_id} for details.`
          });
```

### Continuous Deployment (Optional)
For teams that want to fully automate deployments to production, you can add an auto-approve step after successful staging deployment. This requires:
- High confidence in automated testing
- Robust monitoring and alerting
- Ability to quickly rollback
- Feature flags for risky changes
- Team maturity and trust

## Code Quality and Standards

### Linting and Formatting
#### 1. ESLint Configuration
- **Purpose**: Catch potential errors and enforce coding standards
- **Rules**: 
  - Error prevention (no-unused-vars, no-undef, etc.)
  - Best practices (prefer-const, arrow-body-style, etc.)
  - Style guidelines (indent, quotes, semi, etc.)
  - Node.js specific rules
  - Security rules (no-unsafe-regex, etc.)
- **Sharing**: Extendable base configurations for different project types
- **Example**: .eslintrc.js
  ```javascript
  module.exports = {
    root: true,
    env: {
      node: true,
      es2022: true,
      jest: true
    },
    extends: [
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:import/recommended',
      'plugin:import/typescript',
      'prettier'
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: 'module'
    },
    plugins: [
      '@typescript-eslint',
      'import',
      'prettier'
    ],
    rules: {
      // Override or add specific rules here
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fix: 'inline-imports' }],
      'import/order': [
        'error',
        {
          'groups': [
            ['builtin', 'external'],
            ['internal', 'parent', 'sibling', 'index']
          ],
          'newlines-between': 'always',
          'alphabetize': { order: 'asc', caseInsensitive: true }
        }
      ],
      'prettier/prettier': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error'
    }
  };
  ```

#### 2. Prettier Configuration
- **Purpose**: Consistent code formatting across the team
- **Options**: 
  - Print width: 80-100 characters
  - Tab width: 2 spaces
  - Use tabs: false
  - Semicolons: true
  - Quotes: single or double (team preference)
  - Trailing commas: ES5 style
  - Bracket spacing: true
  - Arrow function parentheses: avoid when possible
- **Example**: .prettierrc
  ```json
  {
    "printWidth": 100,
    "tabWidth": 2,
    "useTabs": false,
    "semi": true,
    "singleQuote": true,
    "trailingComma": "es5",
    "bracketSpacing": true,
    "arrowParens": "avoid",
    "endOfLine": "lf"
  }
  ```

#### 3. EditorConfig
- **Purpose**: Consistent basic formatting across different editors and IDEs
- **Example**: .editorconfig
  ```ini
  # EditorConfig is awesome: https://EditorConfig.org
  
  # top-most EditorConfig file
  root = true
  
  # Unix-style newlines with a newline ending every file
  [*]
  end_of_line = lf
  insert_final_newline = true
  charset = utf-8
  trim_trailing_whitespace = true
  ignore_whitespace = false
  
  [*.{js,jsx,ts,tsx}]
  indent_style = space
  indent_size = 2
  
  [*.{json,css,scss,md}]
  indent_style = space
  indent_size = 2
  
  [*.md]
  max_line_length = off
  trim_trailing_whitespace = false
  
  [package.json]
  indent_style = space
  indent_size = 2
  
  [*.yml,*.yaml]
  indent_style = space
  indent_size = 2
  ```

### Type Safety
#### 1. TypeScript Configuration
- **Purpose**: Catch type-related errors at compile time
- **Strictness**: Enable strict mode for maximum safety
- **Features**: 
  - Strict null checks
  - No implicit any
  - Strict bind/call/apply
  - Strict function types
  - Strict property initialization
  - Exact optional property types
- **Example**: tsconfig.json
  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
      "module": "ESNext",
      "lib": ["DOM", "DOM.Iterable", "ES2022"],
      "allowJs": true,
      "skipLibCheck": true,
      "esModuleInterop": true,
      "allowSyntheticDefaultImports": true,
      "strict": true,
      "forceConsistentCasingInFileNames": true,
      "moduleResolution": "node",
      "resolveJsonModule": true,
      "isolatedModules": true,
      "noEmit": false,
      "jsx": "react-jsx",
      "declaration": true,
      "declarationMap": true,
      "sourceMap": true,
      "outDir": "./dist",
      "rootDir": "./src",
      "composite": true,
      "incremental": true,
      "removeComments": false,
      "noImplicitAny": true,
      "strictNullChecks": true,
      "strictFunctionTypes": true,
      "noImplicitThis": true,
      "alwaysStrict": true,
      "noUnusedLocals": true,
      "noUnusedParameters": true,
      "exactOptionalPropertyTypes": true,
      "noImplicitReturns": true,
      "noFallthroughCasesInSwitch": true,
      "noUncheckedIndexedAccess": true,
      "noImplicitOverride": true,
      "allowUnreachableCode": false,
      "allowUnusedLabels": false
    },
    "include": [
      "apps/**/*",
      "libs/**/*"
    ],
    "exclude": [
      "node_modules",
      "dist",
      "build",
      "scripts",
      "acceptance-tests",
      "webpack",
      "jest",
      "src/**/*.test.ts",
      "src/**/*.spec.ts"
    ]
  }
  ```

#### 2. TypeScript Best Practices
- **Prefer interfaces for object shapes**: 
  ```typescript
  // Good
  interface User {
    id: string;
    name: string;
    email: string;
  }
  
  // Avoid for object shapes (use for primitives/unions)
  type UserId = string;
  ```
- **Use unknown instead of any when type is not known**:
  ```typescript
  // Good
  function parseJson(json: string): unknown {
    return JSON.parse(json);
  }
  
  // Avoid
  function parseJson(json: string): any {
    return JSON.parse(json);
  }
  ```
- **Prefer explicit return types for public functions**:
  ```typescript
  // Good
  function calculateTotal(items: { price: number; quantity: number }[]): number {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }
  
  // Avoid for public APIs (okay for private helpers)
  function calculateTotal(items) {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }
  ```
- **Use const for variables that don't change**:
  ```typescript
  // Good
  const MAX_RETRIES = 3;
  let retryCount = 0;
  
  // Avoid
  var MAX_RETRIES = 3;
  var retryCount = 0;
  ```
- **Leverage TypeScript's type inference**:
  ```typescript
  // Good - let TypeScript infer the type
  const users = await getUserList();
  
  // Avoid unnecessary type annotations
  const users: User[] = await getUserList();
  ```

### Dependency Management
#### 1. Lockfiles
- **Purpose**: Ensure reproducible builds across environments
- **Usage**: 
  - Always commit lockfiles (package-lock.json, yarn.lock, pnpm-lock.yaml)
  - Never manually edit lockfiles
  - Update dependencies through package manager commands
- **Example**: npm
  ```bash
  # Install exact versions from lockfile
  npm ci
  
  # Update to latest compatible versions and update lockfile
  npm update
  
  # Update specific package and update lockfile
  npm update lodash
  ```

#### 2. Dependency Scanning
- **Purpose**: Identify vulnerable, outdated, or licensely problematic dependencies
- **Tools**:
  - npm audit (built-in)
  - Dependabot (GitHub)
  - Snyk
  - WhiteSource
  - OWASP Dependency-Check
- **Integration**: 
  - Run in CI pipeline
  - Fail build on high/severe vulnerabilities
  - Create tickets for medium/low vulnerabilities
  - Regularly update dependencies

#### 3. License Compliance
- **Purpose**: Ensure compliance with open source licenses
- **Process**:
  - Scan dependencies for licenses
  - Identify restricted licenses (GPL, AGPL, etc.)
  - Approve or reject based on company policy
  - Provide attribution where required
  - Track license obligations
- **Tools**:
  - license-checker
  - foSSa
  - ScanCode
  - Whitesource

#### Example: npm audit in CI
```yaml
# In GitHub Actions workflow
- name: Audit dependencies
  run: npm audit --production
  
- name: Fail on high severity vulnerabilities
  if: failure()
  run: |
    echo "High severity vulnerabilities found!"
    exit 1
```

### Security Scanning
#### 1. Static Application Security Testing (SAST)
- **Purpose**: Identify security vulnerabilities in source code
- **Tools**:
  - SonarQube
  - Checkmarx
  - Veracode
  - Semgrep
  - Bandit (Python)
- **Integration**:
  - Run in CI pipeline
  - Fail build on critical/high severity findings
  - Create tickets for medium/low findings
  - Track trends over time

#### 2. Secrets Detection
- **Purpose**: Prevent accidental commitment of secrets
- **Tools**:
  - git-secrets
  - detect-secrets
  - gitleaks
  - truffleHog
  - AWS git-credentials
- **Integration**:
  - Pre-commit hooks
  - CI pipeline checks
  - Repository scanning
  - Alert on commits containing secrets

#### 3. Container Image Scanning
- **Purpose**: Identify vulnerabilities in container images
- **Tools**:
  - Trivy
  - Clair
  - Anchore
  - Aqua Security
  - Amazon ECR Image Scanning
- **Integration**:
  - Scan images before pushing to registry
  - Scan images in registry periodically
  - Fail build on critical vulnerabilities
  - Update base images regularly

#### Example: Pre-commit secret detection
```yaml
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo 'Checking for secrets...'

# Check for secrets in staged changes
npx detect-secrets-staged --prevent || {
  echo 'Potential secrets detected in staged changes!'
  echo 'Please remove them before committing.'
  exit 1
}

echo 'No secrets found in staged changes.'
```

## Documentation Practices

### Documentation as Code
#### Principles
- **Version Control**: Documentation stored in same repository as code
- **Same Workflow**: Documentation follows same PR/review process as code
- **Automated Publishing**: Documentation built and published with every release
- **Consistent Formatting**: Use markup languages (Markdown, reStructuredText, AsciiDoc)
- **Single Source of Truth**: Avoid duplicating information
- **Documentation-Driven Development**: Write documentation before or alongside code

#### Implementation
- **Directory Structure**: 
  ```
  docs/
  ├── README.md
  ├── getting-started.md
  ├── api-reference/
  │   ├── authentication.md
  │   ├── endpoints/
  │   │   ├── missions.md
  │   │   ├── tasks.md
  │   │   └── workers.md
  │   └── schemas/
  │       ├── mission.json
  │       └── task.json
  ├── tutorials/
  │   ├── hello-world.md
  │   └── web-scraper.md
  ├── guides/
  │   ├── deployment.md
  │   ├── scaling.md
  │   └── monitoring.md
  └── references/
      ├── glossary.md
      └── faq.md
  ```
- **Build System**: 
  - Static site generators (MkDocs, Docusaurus, Hugo, Jekyll)
  - Documentation published to docs.agentswarm.in or similar
  - Versioned documentation for different releases
  - Search functionality
  - Theme consistent with product branding

#### Example: MkDocs Configuration
```yaml
# mkdocs.yml
site_name: AgentSwarm Documentation
site_url: https://docs.agentswarm.in
site_author: AgentSwarm Team
site_description: Documentation for AgentSwarm - The Enterprise AI Agent Platform

repo_url: https://github.com/agentswarm/agentswarm
repo_name: agentswarm/agentswarm

theme:
  name: material
  palette:
    - scheme: default
      primary: indigo
      accent: indigo
    - scheme: slate
      primary: indigo
      accent: indigo
  font:
    text: Roboto Mono
    code: IBM Plex Mono
  features:
    - navigation.tabs
    - navigation.sections
    - navigation.top
    - navigation.indexes
    - navigation.instant
    - header.autohide
    - navigation.expand
    - navigation.tracking
    - search.highlight
    - search.share
    - search.suggest
    - toc.integrate

plugins:
  - search
  - git-revision-date-localized:
      fallback_to_build_date: true
  - git-committers:
      repository: agentswarm/agentswarm
      branch: main

markdown_extensions:
  - toc:
      permalink: true
  - pymdownx.highlight:
      anchor_linenums: true
  - pymdownx.superfences:
      custom_fences:
        - name: mermaid
          block: true
  - pymdownx.inlinehilite
  - pymdownx.snippet
  - pymdownx.details

nav:
  - Home: index.md
  - Getting Started: getting-started.md
  - Guides:
      - Deployment: guides/deployment.md
      - Scaling: guides/scaling.md
      - Monitoring: guides/monitoring.md
      - Security: guides/security.md
  - API Reference:
      - Authentication: api-reference/authentication.md
      - Missions: api-reference/endpoints/missions.md
      - Tasks: api-reference/endpoints/tasks.md
      - Workers: api-reference/endpoints/workers.md
      - Schemas:
          - Mission: api-reference/schemas/mission.md
          - Task: api-reference/schemas/task.md
  - Tutorials:
      - Hello World: tutorials/hello-world.md
      - Web Scraper: tutorials/web-scraper.md
  - References:
      - Glossary: references/glossary.md
      - FAQ: references/faq.md
```

### Documentation Types
#### 1. Tutorials
- **Purpose**: Get new users productive quickly
- **Format**: Step-by-step instructions with clear outcomes
- **Examples**: 
  - "Hello World" mission creation
  - Building a web scraper with AgentSwarm
  - Creating a data processing pipeline
  - Setting up automated monitoring
- **Principles**:
  - Start with a clear goal
  - Show immediate results
  - Explain why each step is necessary
  - Provide troubleshooting tips
  - Link to deeper documentation for interested readers

#### 2. Guides
- **Purpose**: In-depth coverage of specific topics
- **Format**: Comprehensive but focused on one subject
- **Examples**:
  - Deployment guide for different environments
  - Scaling AgentSwarm for high throughput
  - Monitoring and observability setup
  - Security hardening and compliance
  - Performance tuning and optimization
- **Principles**:
  - Assume some familiarity with basics
  - Go deep on the subject
  - Provide configuration examples
  - Include troubleshooting sections
  - Reference related guides for connected topics

#### 3. API Reference
- **Purpose**: Complete technical specification of the API
- **Format**: 
  - Endpoint descriptions (method, path, parameters, responses)
  - Request/response examples
  - Error codes and meanings
  - Authentication requirements
  - Rate limiting information
- **Generation**: 
  - Code-first approach (annotate controllers/services)
  - Schema-first approach (define OpenAPI spec first)
  - Hybrid approach (mix of both)
- **Tools**:
  - Swagger/OpenAPI
  - Postman collections
  - Redoc
  - StopLight

#### 4. Tutorials and Guides vs Reference
- **Tutorials/Guides**: Narrative, task-oriented, learning-focused
- **Reference**: Factual, comprehensive, lookup-oriented

#### 5. Changelog and Release Notes
- **Purpose**: Inform users about what changed in each release
- **Format**:
  - Version number and date
  - Added features
  - Changed behavior
  - Deprecated features
  - Removed features
  - Fixed bugs
  - Security fixes
  - Known issues
  - Upgrade instructions
- **Generation**:
  - Manual curation
  - Automated from commit messages (conventional commits)
  - Hybrid approach
- **Tools**:
  - standard-version
  - changesets
  - release-it
  - lerna-changelog
- **Example**: CHANGELOG.md format
  ```markdown
  # Changelog
  
  All notable changes to this project will be documented in this file.
  
  The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
  and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
  
  ## [Unreleased]
  
  ## [1.2.0] - 2026-08-19
  ### Added
  - New model router with intelligent provider selection
  - Webhook support for mission completion notifications
  - Enhanced verification framework with custom verification types
  - API endpoint for retrieving mission metrics
  
  ### Changed
  - Improved error messages for validation failures
  - Updated default timeout for external API calls from 30s to 60s
  - Refactored worker task execution pipeline for better performance
  
  ### Deprecated
  - Legacy model routing endpoint (/api/v1/models/route)
  - Synchronous verification API (will be removed in v2.0)
  
  ### Removed
  - Old file storage adapter (replaced with universal artifact tool)
  
  ### Fixed
  - Memory leak in worker process under high load
  - Race condition in mission completion detection
  - Incorrect timezone handling in scheduled missions
  
  ### Security
  - Patched potential XSS vulnerability in mission description display
  - Updated dependencies to address CVEs in lodash and express
  
  ### Known Issues
  - Occasionally slow database queries when filtering by custom metadata
  
  ### Upgrade Instructions
  1. Backup your database
  2. Run the migration script: npm run db:migrate
  3. Update your environment variables:
     - NEW_MODEL_ROUTER_ENABLED=true
     - VERIFICATION_TIMEOUT=300
  ```
  
#### 6. API Documentation Best Practices
- **Examples First**: Show examples before explaining parameters
- **Realistic Examples**: Use realistic data, not foo/bar/baz
- **Error Responses**: Document all possible error responses
- **Authentication**: Clearly show how to authenticate
- **Rate Limiting**: Document rate limits and headers
- **Versioning**: Clearly indicate which version the docs apply to
- **Deprecation**: Clearly mark deprecated endpoints and when they'll be removed
- **Try It Out**: Provide interactive examples when possible
- **SDK Examples**: Provide examples in multiple languages if SDKs exist
- **Searchability**: Make documentation easy to search
- **Feedback Mechanism**: Allow users to report documentation issues

#### Example: API Endpoint Documentation
```markdown
# POST /missions

Create a new mission.

## Requires Authentication
This endpoint requires a valid JWT token in the Authorization header.

## Request Body

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| goal | string | Yes | The mission objective (3-500 characters) |
| mode | string | Yes | Execution mode: `INSTANT`, `THINK`, `AGENT`, `SWARM`, or `AUTO` |
| organizationId | string | Yes | ID of the organization owning the mission |
| projectId | string | Yes | ID of the project the mission belongs to |
| priority | string | No | Priority level: `LOW`, `NORMAL`, `HIGH`, or `CRITICAL` (default: `NORMAL`) |
| metadata | object | No | Additional key-value pairs for mission metadata |

## Request Example
```json
{
  "goal": "Create a responsive landing page for our new product",
  "mode": "SWARM",
  "organizationId": "org-123",
  "projectId": "proj-456",
  "priority": "HIGH",
  "metadata": {
    "campaign": "product-launch-q3",
    "targetAudience": "enterprise-customers"
  }
}
```

## Success Response

| Property | Type | Description |
|----------|------|-------------|
| id | string | Unique mission identifier |
| goal | string | The mission objective |
| mode | string | Execution mode |
| organizationId | string | Owning organization ID |
| projectId | string | Project ID |
| status | string | Current mission status (`QUEUED`, `PLANNING`, `RUNNING`, etc.) |
| progress | number | Completion percentage (0-100) |
| createdAt | string | ISO 8601 timestamp |
| updatedAt | string | ISO 8601 timestamp |
| startedAt | string | ISO 8601 timestamp (null if not started) |
| completedAt | string | ISO 8601 timestamp (null if not completed) |

## Success Response Example
```json
{
  "id": "mission-abc123def456",
  "goal": "Create a responsive landing page for our new product",
  "mode": "SWARM",
  "organizationId": "org-123",
  "projectId": "proj-456",
  "status": "QUEUED",
  "progress": 0,
  "createdAt": "2026-08-19T10:30:00.000Z",
  "updatedAt": "2026-08-19T10:30:00.000Z",
  "startedAt": null,
  "completedAt": null
}
```

## Error Responses

| Status Code | Error Code | Description |
|-------------|------------|-------------|
| 400 | VALIDATION_ERROR | Request body validation failed |
| 401 | UNAUTHORIZED | Missing or invalid authentication |
| 403 | FORBIDDEN | Insufficient permissions for requested action |
| 409 | CONFLICT | Mission with same goal already exists in project |
| 422 | UNPROCESSABLE_ENTITY | Semantic validation failed (e.g., invalid organization/project) |
| 500 | INTERNAL_SERVER_ERROR | Unexpected server error |
| 503 | SERVICE_UNAVAILABLE | Service temporarily unavailable |

## Error Response Example
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Goal must be between 3 and 500 characters",
    "details": [
      {
        "field": "goal",
        "issue": "too_short",
        "minLength": 3,
        "providedLength": 2
      }
    ]
  }
}
```

## Rate Limiting
This endpoint is subject to rate limiting:
- 60 requests per minute per IP address
- 1000 requests per hour per organization
- Response includes `Retry-After` header when limit is exceeded

## Related Endpoints
- GET /missions - List missions
- GET /missions/{id} - Get specific mission
- PATCH /missions/{id} - Update mission
- DELETE /missions/{id} - Delete mission
- GET /missions/{id}/tasks - Get mission tasks
```

## Collaboration Workflows

### Branching Strategy
AgentSwarm uses trunk-based development with short-lived feature branches.

#### 1. Main Branch (main)
- **Purpose**: Always deployable state
- **Usage**: 
  - Direct commits only for trivial fixes (typo, documentation)
  - All features come through pull requests
  - Release tags created from main branch
- **Protection Rules**:
  - Require pull request reviews
  - Require status checks to pass
  - Restrict who can push directly
  - Require linear history (no merge commits) - optional

#### 2. Feature Branches
- **Purpose**: Develop new features or fix bugs
- **Naming Convention**: 
  - `feature/short-description` (e.g., `feature/model-router-enhancement`)
  - `fix/short-description` (e.g., `fix/memory-leak-worker`)
  - `hotfix/short-description` (for urgent production fixes)
  - `release/version-number` (for release preparation)
- **Lifecycle**:
  1. Branch from main
  2. Develop feature
  3. Keep up to date with main (regular merges or rebases)
  4. Open pull request when ready for review
  5. Address review feedback
  6. Merge into main (via squash merge or rebase merge)
  7. Delete branch after merge

#### 3. Release Branches (Optional)
- **Purpose**: Prepare for release while maintaining main for ongoing development
- **Usage**: 
  - Create when feature freeze begins
  - Only bug fixes and documentation changes
  - Merge back to main after release
- **Naming**: `release/v1.2.0`, `release/v1.3.0`, etc.

### Pull Request Standards
#### 1. Title Format
- **Conventional Commits Style**:
  - `feat: add model router enhancements`
  - `fix: resolve worker memory leak`
  - `docs: update deployment guide for Kubernetes`
  - `refactor: simplify task execution pipeline`
  - `test: add integration tests for verification`
  - `chore: update dependencies`
  - `perf: improve database query performance`
  - `style: fix formatting in API controllers`
  - `build: update Docker base images`
  - `ci: add security scanning to pipeline`
  - `revert: revert "add experimental feature"`

#### 2. Description Template
```markdown
## Summary
[Brief description of what this PR changes]

## Motivation
[Why this change is necessary]
[What problem it solves]
[What opportunity it enables]

## Implementation Details
[Technical details of the implementation]
[Key files modified]
[Any architectural decisions]
[Trade-offs considered]

## Testing
[Unit tests added/updated]
[Integration tests added/updated]
[End-to-end tests added/updated]
[How to test manually if applicable]

## Screenshots/GIFs
[If UI changes, include visual examples]

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-reviewed
- [ ] Related documentation updated
- [ ] Tests added or updated for changed code
- [ ] No breaking changes (or breaking changes documented)
- [ ] Dependencies updated if necessary
- [ ] Security considerations addressed
- [ ] Performance impact evaluated
- [ ] Backward compatibility maintained
- [ ] Feature flags added if necessary

## Related Issues
[Links to related issues or Jira tickets]

## Deployment Notes
[Any special deployment considerations]
[Database migrations required]
[Configuration changes needed]
[Rollback procedure if applicable]
```

#### 3. Review Process
- **Reviewers**: At least one approving reviewer required
- **Review Types**:
  - **Code Review**: Logic, style, best practices
  - **Architecture Review**: For significant changes (optional, as needed)
  - **Security Review**: For security-sensitive changes (optional, as needed)
  - **Performance Review**: For performance-critical changes (optional, as needed)
- **Review Timeliness**: 
  - Aim for review within 24 hours
  - Escalation process for stalled reviews
  - Review rotation to distribute load
- **Feedback Quality**:
  - Specific, actionable feedback
  - Balance of positive and constructive comments
  - Focus on improving the code, not criticizing the author
  - Respectful and professional tone

#### 4. Merging Strategies
- **Squash and Merge**: 
  - Pros: Clean history, one commit per feature
  - Cons: Loses individual commit history
  - Best for: Most feature branches
- **Rebase and Merge**: 
  - Pros: Linear history, preserves commit authorship
  - Cons: Can be complex with conflicts
  - Best for: When you want to preserve commit history
- **Merge Commit**: 
  - Pros: Preserves exact history, shows branch structure
  - Cons: Creates noisy history with merge commits
  - Best for: When you want to preserve exact branch topology

### Issue Management
#### 1. Issue Types
- **Bug**: Something isn't working as expected
- **Feature**: New functionality or enhancement
- **Improvement**: Enhancement to existing functionality
- **Task**: Work that needs to be done (not a bug or feature)
- **Documentation**: Documentation needs updating or adding
- **Question**: Request for information or clarification
- **Discussion**: Topic for team discussion

#### 2. Issue Templates
- **Bug Report Template**:
  ```markdown
  ---
  name: Bug Report
  description: File a bug report
  title: "[BUG] "
  labels: ["bug"]
  assignees: ""
  ---
  
  ## Description
  [Clear and concise description of the bug]
  
  ## Steps to Reproduce
  1. [First Step]
  2. [Second Step]
  3. [And so on...]
  
  ## Expected Behavior
  [What you expected to happen]
  
  ## Actual Behavior
  [What actually happened]
  
  ## Screenshots
  [If applicable, add screenshots to help explain your problem]
  
  ## Environment
  - Version: [e.g., 1.2.0]
  - Browser: [e.g., chrome, safari]
  - Device: [e.g., desktop, mobile]
  - OS: [e.g., iOS 14.5]
  
  ## Additional Context
  [Add any other context about the problem here]
  ```
  
- **Feature Request Template**:
  ```markdown
  ---
  name: Feature Request
  description: Suggest a feature for AgentSwarm
  title: "[FEATURE] "
  labels: ["enhancement"]
  assignees: ""
  ---
  
  ## Summary
  [One sentence summary of the feature]
  
  ## Motivation
  [Why this feature is needed]
  [What problem it solves]
  [What opportunity it enables]
  
  ## Proposed Solution
  [Describe the solution you'd like to see]
  
  ## Alternatives Considered
  [Describe any alternative solutions or features you've considered]
  
  ## Additional Context
  [Add any other context about the feature request here]
  ```

#### 3. Labeling System
- **Type**: 
  - `bug`: Something isn't working
  - `enhancement`: New feature or improvement
  - `documentation`: Docs need updating
  - `question`: Request for information
  - `discussion`: Topic for discussion
- **Priority**:
  - `priority/critical`: Blocks release, needs immediate attention
  - `priority/high`: Should be fixed in next release
  - `priority/medium`: Nice to have, can wait
  - `priority/low`: Low priority, can wait indefinitely
- **Area**:
  - `area/api`: API server related
  - `area/worker`: Worker processes related
  - `area/scheduler`: Scheduler related
  - `area/libs`: Shared libraries related
  - `area/infra`: Infrastructure related
  - `area/docs`: Documentation related
  - `area/dev`: Developer experience related
- **Status**:
  - `status/todo`: Not started
  - `status/in-progress`: Currently working on
  - `status/in-review`: Under review (PR or design)
  - `status/done`: Completed
  - `status/stale`: No recent activity
- **Other**:
  - `good-first-issue`: Suitable for newcomers
  - `help-wanted`: Maintainers would like help
  - `blocked`: Waiting on something else
  - `duplicate`: Similar to existing issue
  - `wontfix`: Not going to be implemented

### Release Management
#### 1. Versioning Strategy
- **Semantic Versioning**: MAJOR.MINOR.PATCH
  - **MAJOR**: Incompatible API changes
  - **MINOR**: Backward-compatible functionality addition
  - **PATCH**: Backward-compatible bug fixes
- **Pre-release Identifiers**: 
  - `1.0.0-alpha.1`, `1.0.0-beta.2`, etc.
  - Used for unstable releases
- **Build Metadata**: 
  - `1.0.0+202608191430`
  - Used for build numbers, commit hashes, etc.

#### 2. Release Process
1. **Feature Freeze**: No new features, only bug fixes and documentation
2. **Release Candidate**: Build from main branch, test thoroughly
3. **Stabilization Period**: Fix critical bugs found in RC
4. **Final Release**: Build and publish final version
5. **Announcement**: Notify users, update documentation
6. **Post-Release Monitoring**: Watch for issues after release

#### 3. Release Automation
- **Tools**: standard-version, changesets, release-it
- **Process**:
  1. Determine version bump based on commits
  2. Generate changelog from conventional commits
  3. Create git tag
  4. Push tag to trigger build/deployment
  5. Create GitHub release
  6. Publish artifacts (npm, Docker, etc.)
- **Example**: standard-version command
  ```bash
  # Bump patch version
  npm run release:patch
  
  # Bump minor version
  npm run release:minor
  
  # Bump major version
  npm run release:major
  
  # Custom version
  npx standard-version --release-as 2.0.0
  ```

#### 4. Feature Flags
- **Purpose**: Enable/disable features without deploying new code
- **Implementation**:
  - Configuration-based flags (environment variables, config files)
  - Runtime flags (database, feature flag service)
  - Gradual rollout (percentage of users, specific segments)
  - Kill switches (emergency disable)
- **Patterns**:
  - **Release Toggles**: Temporary flags for features in development
  - **Operational Toggles**: Long-term flags for operational control
  - **Experiment Toggles**: For A/B testing and experimentation
  - **Permissioning Toggles**: For controlling access to premium features
- **Example**: Simple feature flag implementation
  ```javascript
  // featureFlags.js
  const featureFlags = {
    // Release toggles - remove after feature is stable
    NEW_MODEL_ROUTER: process.env.NEW_MODEL_ROUTER_ENABLED === 'true',
    ENHANCED_VERIFICATION: process.env.ENHANCED_VERIFICATION_ENABLED === 'true',
    
    // Operational toggles
    MAINTENANCE_MODE: process.env.MAINTENANCE_MODE === 'true',
    RATE_LIMITING_ENABLED: process.env.RATE_LIMITING_ENABLED === 'true',
    
    // Experiment toggles
    NEW_UI_EXPERIMENT: process.env.NEW_UI_EXPERIMENT === 'true',
    
    // Permissioning toggles
    PREMIUM_FEATURES: process.env.PREMIUM_FEATURES_ENABLED === 'true'
  };
  
  module.exports = {
    isEnabled: (feature) => !!featureFlags[feature],
    set: (feature, value) => {
      featureFlags[feature] = !!value;
    },
    all: () => ({ ...featureFlags })
  };
  
  // Usage
  const { isEnabled } = require('./featureFlags');
  
  if (isEnabled('NEW_MODEL_ROUTER')) {
    // Use new model router implementation
  } else {
    // Use legacy model router
  }
  ```

#### 5. Release Communication
- **Internal**:
  - Release notes emailed to team
  - Release announced in team meetings
  - Demo of new features
  - Training for significant changes
- **External**:
  - Blog post announcing release
  - Email newsletter to subscribers
  - In-app notifications
  - Social media announcements
  - Documentation updates
  - Webinar or live demo

## Developer Observability

### Development-Specific Metrics
#### 1. Build Metrics
- **Build Time**: Time from start to finish of build process
- **Test Execution Time**: Time to run test suite
- **Feedback Loop Time**: Time from code change to test results
- **Cache Hit Rate**: Percentage of build steps served from cache
- **Dependency Download Time**: Time to download dependencies

#### 2. Test Metrics
- **Test Pass Rate**: Percentage of tests that pass
- **Test Flakiness Rate**: Percentage of tests that sometimes pass, sometimes fail
- **Test Coverage**: Percentage of code covered by tests
- **Test Execution Distribution**: How long different test types take
- **Slowest Tests**: Tests that take unusually long to execute

#### 3. Code Quality Metrics
- **Linting Errors**: Number of linting errors
- **Formatting Issues**: Number of formatting violations
- **TypeScript Errors**: Number of TypeScript compilation errors
- **Dependency Vulnerabilities**: Number of known vulnerable dependencies
- **Secret Detection Hits**: Number of potential secrets found

#### 4. Development Velocity Metrics
- **Cycle Time**: Time from first commit to release
- **Lead Time**: Time from idea to release
- **Deployment Frequency**: How often releases occur
- **Change Failure Rate**: Percentage of releases that cause incidents
- **Mean Time To Recovery (MTTR)**: How long to recover from incidents

### Developer Tools and Integrations
#### 1. IDE Plugins
- **Language Support**: 
  - TypeScript/JavaScript language services
  - ESLint integration
  - Prettier formatting on save
  - GitLens for enhanced Git capabilities
- **Debugging**: 
  - Built-in debuggers with breakpoints, watch expressions, call stack
  - Conditional breakpoints
  - Logpoints (log instead of breaking)
  - Debug console for evaluating expressions
- **Refactoring**: 
  - Safe renaming
  - Extract method/function
  - Move file
  - Change signature
- **Navigation**: 
  - Go to definition
  - Find all references
  - Peek definition
  - Outline view
- **Testing**: 
  - Run tests from IDE
  - Debug tests
  - View test results
  - Code coverage visualization

#### 2. Terminal Enhancements
- **Shell**: 
  - zsh or fish with plugins
  - Syntax highlighting
  - Auto-suggestions
  - History search
- **Prompt**: 
  - Git branch and status
  - Current directory
  - Exit code of last command
  - Execution time
- **Aliases**: 
  - Shortcuts for common commands
  - Git shortcuts (gs, gp, gl, etc.)
  - Project-specific shortcuts
- **Functions**: 
  - Complex commands as shell functions
  - Environment setup helpers
  - Deployment helpers

#### 3. Debugging Tools
- **Browser DevTools**: 
  - Elements inspector
  - Console for logging and evaluation
  - Network tab for API calls
  - Sources tab for debugging JavaScript
  - Performance tab for profiling
  - Application tab for storage inspection
- **Node.js Debugging**: 
  - Built-in inspector (node --inspect)
  - Chrome DevTools integration
  - VS Code debugging
  - Heap snapshots for memory leak detection
  - CPU profiling
  - Async stack traces
- **Database Tools**: 
  - Query executors
  - Schema browsers
  - Data editors
  - Explain plan visualizers
  - Migration runners
- **API Tools**: 
  - REST clients (Postman, Insomnia, HTTPie)
  - GraphQL explorers
  - API documentation viewers
  - Mock servers
  - Load testing tools (k6, artillery)

#### 4. Profiling Tools
- **CPU Profiling**: 
  - Flame graphs
  - Call trees
  - Method timelines
  - Hot method identification
- **Memory Profiling**: 
  - Heap snapshots
  - Object retention trees
  - Allocation timelines
  - Memory leak detection
- **I/O Profiling**: 
  - File system activity
  - Network activity
  - Database query timing
- **Rendering Profiling** (for web apps):
  - Frame rates
  - Layout calculations
  - Paint times
  - JavaScript execution time

#### 5. Logging for Development
- **Development Log Levels**: 
  - More verbose logging in development
  - Debug and trace levels enabled
  - Development-specific context
- **Log Format**: 
  - Human-readable format for console
  - Structured format for file output
  - Colored output for better readability
- **Log Sampling**: 
  - Sample logs to reduce volume in high-frequency scenarios
  - Always log errors and warnings
- **Log Redaction**: 
  - Automatically redact sensitive information
  - Context-based redaction rules

#### Example: Development Logger Configuration
```javascript
const { createLogger, format, transports } = require('winston');

const devLogger = createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  format: format.combine(
    format.colorize(),
    format.timestamp({ format: 'HH:mm:ss.SSS' }),
    format.printf(({ timestamp, level, message, ...meta }) => {
      const msg = `${timestamp} [${level}] ${message}`;
      return Object.keys(meta).length 
        ? `${msg} ${JSON.stringify(meta)}` 
        : msg;
    })
  ),
  transports: [
    new transports.Console(),
    // In development, also log to file for later analysis
    new transports.File({ 
      filename: 'logs/development.log',
      level: 'debug',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Usage
devLogger.debug('Processing mission', { missionId: 'mission-123', step: 'planning' });
devLogger.info('Mission started', { missionId: 'mission-123', mode: 'SWARM' });
devLogger.warn('High worker utilization', { utilization: 0.85, threshold: 0.8 });
devLogger.error('Failed to process task', { 
  error: err.message, 
  taskId: 'task-456', 
  missionId: 'mission-123',
  stack: err.stack 
});
```

## Troubleshooting Development Issues

### Common Development Problems and Solutions

#### 1. "Works on My Machine" Issues
- **Symptoms**: Code works for one developer but fails for others
- **Diagnosis**:
  - Compare environment versions (Node.js, npm, etc.)
  - Check for missing environment variables
  - Look for OS-specific path issues
  - Check for global vs local installations
- **Solutions**:
  - Standardize on containerized development
  - Use version managers (nvm, fnm, volta) for Node.js
  - Document required environment variables
  - Use cross-platform path handling (path.join, etc.)
  - Avoid global installations; use npm scripts or npx
  - Commit lockfiles to ensure dependency consistency

#### 2. Slow Build or Test Times
- **Symptoms**: Long feedback loops slowing down development
- **Diagnosis**:
  - Measure time spent in each phase (install, build, test)
  - Identify slowest tests or build steps
  - Check for inefficient algorithms or data structures
  - Look for unnecessary work being repeated
  - Check for I/O bottlenecks (disk, network)
- **Solutions**:
  - Implement caching (dependency, build, test)
  - Parallelize independent operations
  - Optimize slow tests (use mocks, reduce scope)
  - Use incremental compilers (tsc --watch, babel with cache)
  - Implement test prioritization (run failing tests first)
  - Use test isolation to allow parallel execution
  - Optimize database queries in tests
  - Use in-memory databases for testing when possible

#### 3. Flaky Tests
- **Symptoms**: Tests that sometimes pass, sometimes fail
- **Diagnosis**:
  - Run tests multiple times to identify flaky ones
  - Check for test isolation issues (shared state)
  - Look for timing dependencies
  - Check for external service dependencies
  - Look for probabilistic algorithms
  - Check for resource leaks affecting subsequent tests
- **Solutions**:
  - Improve test isolation (separate databases, clean state)
  - Use timeouts and retries for asynchronous operations
  - Mock external services and dependencies
  - Use deterministic seeds for random number generation
  - Properly clean up resources after each test
  - Use async/await properly to avoid race conditions
  - Increase timeouts for operations that occasionally take longer
  - Use test sharding to isolate flaky tests

#### 4. Memory Leaks in Development
- **Symptoms**: Increasing memory usage over time, eventual crashes
- **Diagnosis**:
  - Take heap snapshots at different times
  - Compare heap snapshots to see what's growing
  - Look for accumulating objects in specific categories
  - Check for event listeners not being removed
  - Check for timers not being cleared
  - Look for caches that grow without bounds
  - Check for closures holding references to outer scope
- **Solutions**:
  - Remove event listeners when no longer needed
  - Clear timers and intervals
  - Implement bounded caches (LRU, LFU)
  - Null out references when no longer needed
  - Use WeakMap/WeakSet for caches that shouldn't prevent GC
  - Fix closures that unintentionally hold references
  - Use object pools for expensive-to-create objects
  - Ensure proper error handling doesn't leak resources

#### 5. Environment Configuration Issues
- **Symptoms**: Application fails to start or behaves incorrectly
- **Diagnosis**:
  - Check required environment variables are set
  - Verify values are in correct format and range
  - Check for typos in variable names
  - Look for conflicting configuration sources
  - Check for file encoding issues (UTF-8 vs ASCII)
  - Verify file permissions
- **Solutions**:
  - Implement configuration validation at startup
  - Provide clear error messages for missing/invalid config
  - Use configuration libraries with schema validation
  - Document all required environment variables
  - Provide example configuration files
  - Implement fallback values where appropriate
  - Use configuration management tools for complex setups

#### 6. Dependency Conflicts
- **Symptoms**: Build failures or runtime errors due to version conflicts
- **Diagnosis**:
  - Check dependency tree for conflicts
  - Look for peer dependency mismatches
  - Check for incompatible version ranges
  - Look for transitive dependency issues
  - Check for OS-specific or architecture-specific dependencies
- **Solutions**:
  - Use lockfiles to ensure consistent versions
  - Use dependency deduction tools (npm dedupe, yarn install --flat)
  - Use monorepo tools to hoist dependencies (lerna, npm workspaces, pnpm workspaces)
  - Use aliasing to resolve conflicts (browser alias in webpack)
  - Use shading or relocation for Java libraries
  - Fork and patch problematic dependencies
  - Use dependency constraints to force specific versions

#### 7. Hot Reloading Issues
- **Symptoms**: Changes not reflected, state loss, errors during reload
- **Diagnosis**:
  - Check which types of changes trigger reloads
  - Look for state that isn't properly preserved
  - Check for connections that aren't properly reopened
  - Look for timers or intervals that aren't properly restarted
  - Check for subscriptions that aren't properly renewed
  - Check for singleton instances that aren't properly handled
- **Solutions**:
  - Implement proper cleanup and reinitialization in reload handlers
  - Use module systems that support hot reloading (HMR in webpack)
  - Persist state to external storage during reload
  - Reestablish connections after reload
  - Restart timers and intervals after reload
  - Renew subscriptions after reload
  - Use dependency injection to manage singleton lifecycle
  - Accept full reload for complex state changes

#### Example: Handling Hot Reloading in Node.js
```javascript
// In development, support hot reloading
if (process.env.NODE_ENV === 'development' && module.hot) {
  // Accept the module and its dependencies as hot updates
  module.hot.accept();
  
  // Handle disposal - cleanup before replacement
  module.hot.dispose((data) => {
    // Cleanup resources before module is replaced
    if (server) {
      server.close();
    }
    if (databaseConnection) {
      databaseConnection.close();
    }
    // Pass along any state needed for next incarnation
    data.server = server;
    data.db = databaseConnection;
  });
  
  // Handle acceptance - reinitialize after replacement
  module.hot.accept('./server', () => {
    // Reinitialize with new module
    const { createServer } = require('./server');
    server = createServer();
    
    // Restore state if available
    if (module.hot.data && module.hot.data.server) {
      server = module.hot.data.server;
    }
    
    // Restore database connection if available
    if (module.hot.data && module.hot.data.db) {
      databaseConnection = module.hot.data.db;
    }
    
    // Restart server
    server.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  });
}
```

## Conclusion

Optimizing developer experience and DevOps practices is crucial for building and shipping AgentSwarm with confidence. By standardizing development environments, automating workflows, implementing comprehensive testing strategies, maintaining high code quality, following clear documentation practices, establishing effective collaboration patterns, managing releases effectively, and providing developer-centric observability, teams can deliver high-quality software consistently and efficiently.

Remember that improving developer experience is an ongoing investment:
- **Continuously gather feedback**: Regularly ask developers what's working and what's not
- **Measure and improve**: Track metrics like cycle time, build time, and satisfaction
- **Invest in tooling**: Spend time improving developer tools - it pays dividends
- **Share knowledge**: Encourage developers to share tips, tricks, and best practices
- **Iterate on processes**: Regularly review and improve development workflows
- **Celebrate improvements**: Recognize and reward improvements to developer experience

By following the principles and techniques outlined in this guide, you can create a development environment where engineers can focus on solving interesting problems rather than fighting with tools, processes, and environment issues.

## Related Resources
- [001-introduction.md](./001-introduction.md): What is AgentSwarm?
- [002-architecture.md](./002-architecture.md): Technical deep dive
- [003-use-cases.md](./003-use-cases.md): Real-world applications
- [004-model-routing.md](./004-model-routing.md): How we select AI providers
- [005-event-ledger.md](./005-event-ledger.md): Our tamper-evident event sourcing system
- [006-verification-gates.md](./006-verification-gates.md): Independent validation of AI work
- [007-deployment-guide.md](./007-deployment-guide.md): Deployment considerations affecting developer experience
- [008-security-best-practices.md](./008-security-best-practices.md): Security considerations that affect developer experience
- [009-performance-optimization.md](./009-performance-optimization.md): Performance considerations for developer experience
- [010-monitoring-observability.md](./010-monitoring-observability.md): Monitoring considerations for developer experience
- [011-scalability-high-availability.md](./011-scalability-high-availability.md): Scalability considerations for developer experience
- [DEPLOY.md](../DEPLOY.md): Original deployment instructions