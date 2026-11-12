-- Allow local UUID v4 ids alongside imported Smartsheet numeric ids (stored as text).
-- Idempotent: safe if columns are already text.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sheets' AND column_name = 'sheet_id'
      AND data_type = 'bigint'
  ) THEN
    ALTER TABLE IF EXISTS rows DROP CONSTRAINT IF EXISTS rows_sheet_id_fkey;
    ALTER TABLE IF EXISTS report_rows DROP CONSTRAINT IF EXISTS report_rows_report_id_fkey;

    ALTER TABLE sheets ALTER COLUMN sheet_id TYPE TEXT USING sheet_id::text;
    ALTER TABLE rows ALTER COLUMN sheet_id TYPE TEXT USING sheet_id::text;
    ALTER TABLE rows ALTER COLUMN row_id TYPE TEXT USING row_id::text;

    ALTER TABLE reports ALTER COLUMN report_id TYPE TEXT USING report_id::text;
    ALTER TABLE report_rows ALTER COLUMN report_id TYPE TEXT USING report_id::text;
    ALTER TABLE report_rows ALTER COLUMN row_id TYPE TEXT USING row_id::text;
    ALTER TABLE report_rows ALTER COLUMN sheet_id TYPE TEXT USING sheet_id::text;

    ALTER TABLE attachments ALTER COLUMN sheet_id TYPE TEXT USING sheet_id::text;
    ALTER TABLE attachments ALTER COLUMN attachment_id TYPE TEXT USING attachment_id::text;
    ALTER TABLE attachments ALTER COLUMN row_id TYPE TEXT USING row_id::text;

    ALTER TABLE discussions ALTER COLUMN sheet_id TYPE TEXT USING sheet_id::text;
    ALTER TABLE discussions ALTER COLUMN discussion_id TYPE TEXT USING discussion_id::text;
    ALTER TABLE discussions ALTER COLUMN row_id TYPE TEXT USING row_id::text;

    ALTER TABLE sheet_automations ALTER COLUMN sheet_id TYPE TEXT USING sheet_id::text;

    ALTER TABLE rows
      ADD CONSTRAINT rows_sheet_id_fkey
      FOREIGN KEY (sheet_id) REFERENCES sheets(sheet_id) ON DELETE CASCADE;
    ALTER TABLE report_rows
      ADD CONSTRAINT report_rows_report_id_fkey
      FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE;
  END IF;
END $$;

-- Remove duplicate names before unique index (keep lowest sheet_id).
DELETE FROM sheets
WHERE sheet_id IN (
  SELECT sheet_id FROM (
    SELECT sheet_id,
           ROW_NUMBER() OVER (PARTITION BY lower(trim(name)) ORDER BY sheet_id) AS rn
    FROM sheets
  ) ranked
  WHERE rn > 1
);

-- Workflow runs may reference local UUID row ids.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workflow_runs' AND column_name = 'row_id'
      AND data_type = 'bigint'
  ) THEN
    ALTER TABLE workflow_runs ALTER COLUMN row_id TYPE TEXT USING row_id::text;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sheets_name_lower ON sheets (lower(trim(name)));
