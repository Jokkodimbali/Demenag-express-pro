ALTER TABLE demenag.settings
  ADD COLUMN IF NOT EXISTS assembly_price_matrix JSONB NOT NULL DEFAULT '{}'::jsonb;
