-- Run history, per-recipient delivery, approval decisions, and batched row queues.

ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'webhook';
ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS attempt_count INT NOT NULL DEFAULT 1;
ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_workflow_runs_retry
  ON workflow_runs (next_retry_at)
  WHERE next_retry_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS workflow_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_deliveries_run
  ON workflow_deliveries (run_id, created_at);

CREATE TABLE IF NOT EXISTS workflow_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  decision TEXT NOT NULL,
  decided_by TEXT,
  comment TEXT,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_decisions_run
  ON workflow_decisions (run_id, decided_at DESC);

CREATE TABLE IF NOT EXISTS workflow_pending (
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  row_id TEXT NOT NULL,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workflow_id, row_id)
);

CREATE TABLE IF NOT EXISTS workflow_row_locks (
  sheet_id TEXT NOT NULL,
  row_id TEXT NOT NULL,
  locked BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (sheet_id, row_id)
);
