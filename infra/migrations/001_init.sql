CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('INSTANT','THINK','AGENT','SWARM','AUTO')),
  status text NOT NULL CHECK (status IN ('DRAFT','QUEUED','PLANNING','RUNNING','WAITING_APPROVAL','PAUSED','VERIFYING','COMPLETED','FAILED','CANCELLED','BLOCKED')),
  provider_status text NOT NULL DEFAULT 'UNKNOWN',
  provider_error text,
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  task_key text NOT NULL,
  title text NOT NULL,
  agent text NOT NULL,
  dependencies jsonb NOT NULL DEFAULT '[]'::jsonb,
  requires_approval boolean NOT NULL DEFAULT false,
  risk text NOT NULL DEFAULT 'LOW' CHECK (risk IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  status text NOT NULL CHECK (status IN ('QUEUED','READY','LEASED','RUNNING','WAITING_APPROVAL','RETRY_WAIT','SUCCEEDED','FAILED','CANCELLED','DEAD_LETTER')),
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  lease_owner text,
  leased_until timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  retry_at timestamptz,
  provider text,
  model text,
  input_tokens integer,
  output_tokens integer,
  output_text text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  UNIQUE (mission_id, task_key)
);

CREATE INDEX IF NOT EXISTS tasks_mission_status_idx ON tasks(mission_id, status);
CREATE INDEX IF NOT EXISTS tasks_status_lease_idx ON tasks(status, leased_until);

CREATE TABLE IF NOT EXISTS approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  risk text NOT NULL CHECK (risk IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  title text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','EXPIRED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decision_note text,
  UNIQUE(task_id, status) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE TABLE IF NOT EXISTS artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  name text NOT NULL,
  kind text NOT NULL,
  content text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verification_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('RUNNING','PASSED','FAILED')),
  summary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS events (
  id bigserial PRIMARY KEY,
  mission_id uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  type text NOT NULL,
  actor text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_mission_id_id_idx ON events(mission_id, id);

CREATE OR REPLACE FUNCTION agentswarm_notify_event() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'agentswarm_events',
    json_build_object('id', NEW.id, 'missionId', NEW.mission_id)::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agentswarm_events_notify ON events;
CREATE TRIGGER agentswarm_events_notify
AFTER INSERT ON events
FOR EACH ROW EXECUTE FUNCTION agentswarm_notify_event();
