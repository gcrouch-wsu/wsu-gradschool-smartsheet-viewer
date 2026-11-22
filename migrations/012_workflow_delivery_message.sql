-- Tie a workflow email row to the SES message so status can follow the delivery notification.

ALTER TABLE workflow_deliveries
  ADD COLUMN IF NOT EXISTS message_ids TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_workflow_deliveries_message_ids
  ON workflow_deliveries USING GIN (message_ids);
