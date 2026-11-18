-- Amazon SES event notifications received from SNS.

CREATE TABLE IF NOT EXISTS ses_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  bounce_type TEXT,
  recipient_email TEXT NOT NULL,
  sender_email TEXT,
  subject TEXT,
  outcome TEXT NOT NULL DEFAULT '',
  occurred_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, event_type, recipient_email)
);

CREATE INDEX IF NOT EXISTS idx_ses_events_occurred
  ON ses_events (occurred_at DESC);
