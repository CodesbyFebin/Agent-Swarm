-- Migration: Scheduler tables for cron-based mission execution
-- Date: 2026-08-19

-- Tool Approvals table
CREATE TABLE IF NOT EXISTS tool_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  tool_name text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}',
  risk text NOT NULL DEFAULT 'HIGH' CHECK (risk IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED')),
  requested_by uuid REFERENCES users(id),
  decided_by uuid REFERENCES users(id),
  decision_note text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  response_at timestamptz,
  tool_call_id uuid
);

CREATE INDEX IF NOT EXISTS tool_approvals_mission_idx ON tool_approvals(mission_id);
CREATE INDEX IF NOT EXISTS tool_approvals_status_idx ON tool_approvals(status);
CREATE INDEX IF NOT EXISTS tool_approvals_tool_idx ON tool_approvals(tool_name);

-- Scheduler table
CREATE TABLE IF NOT EXISTS schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cron_expression text NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  goal text NOT NULL,
  mode text NOT NULL DEFAULT 'SWARM' CHECK (mode IN ('INSTANT', 'THINK', 'AGENT', 'SWARM', 'AUTO')),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  one_time boolean NOT NULL DEFAULT false,
  start_time timestamptz,
  end_time timestamptz,
  misfire_policy text NOT NULL DEFAULT 'SKIP' CHECK (misfire_policy IN ('FAIL', 'SKIP', 'NOW', 'DELAY')),
  concurrency integer NOT NULL DEFAULT 1 CHECK (concurrency >= 1 AND concurrency <= 10),
  enabled boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'INACTIVE', 'COMPLETED')),
  status_reason text,
  paused_at timestamptz,
  resumed_at timestamptz,
  deactivated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS schedules_organization_idx ON schedules(organization_id);
CREATE INDEX IF NOT EXISTS schedules_project_idx ON schedules(project_id);
CREATE INDEX IF NOT EXISTS schedules_enabled_idx ON schedules(enabled);
CREATE INDEX IF NOT EXISTS schedules_status_idx ON schedules(status);

-- Schedule events for audit trail
CREATE TABLE IF NOT EXISTS schedule_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS schedule_events_schedule_idx ON schedule_events(schedule_id);
CREATE INDEX IF NOT EXISTS schedule_events_created_idx ON schedule_events(created_at);

-- Model invocations tracking
CREATE TABLE IF NOT EXISTS model_invocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model text NOT NULL,
  provider text NOT NULL,
  prompt text NOT NULL,
  response text,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  cost numeric(10, 4),
  status text NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS model_invocations_model_idx ON model_invocations(model);
CREATE INDEX IF NOT EXISTS model_invocations_created_idx ON model_invocations(created_at);

-- Events table enhancements
ALTER TABLE events ADD COLUMN IF NOT EXISTS tool_name text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS model_name text;

-- Add evidence hash to artifacts for verification
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS evidence_hash text;

-- Add reference to schedules in missions
ALTER TABLE missions ADD COLUMN IF NOT EXISTS schedule_id uuid REFERENCES schedules(id);

-- Create trigger for schedule events
CREATE OR REPLACE FUNCTION notify_schedule_event() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'agentswarm_schedule_events',
    json_build_object('schedule_id', NEW.schedule_id, 'event_type', NEW.event_type)::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS schedule_events_notify ON schedule_events;
CREATE TRIGGER schedule_events_notify
AFTER INSERT ON schedule_events
FOR EACH ROW EXECUTE FUNCTION notify_schedule_event();