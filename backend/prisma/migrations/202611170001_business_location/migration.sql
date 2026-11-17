ALTER TABLE "demenag"."settings"
  ADD COLUMN IF NOT EXISTS "business_latitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "business_longitude" DOUBLE PRECISION;
