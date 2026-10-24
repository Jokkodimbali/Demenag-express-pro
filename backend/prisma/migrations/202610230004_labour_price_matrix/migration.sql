ALTER TABLE demenag.settings
  ADD COLUMN IF NOT EXISTS labour_price_matrix JSONB NOT NULL DEFAULT '{}'::jsonb;
