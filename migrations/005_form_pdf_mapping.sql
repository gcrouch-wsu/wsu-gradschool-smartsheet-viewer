-- Per-sheet fillable PDF template + column-to-field mapping (in-app Document Builder)

CREATE TABLE IF NOT EXISTS form_pdf_mapping (
  sheet_id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  template BYTEA,
  template_name TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
