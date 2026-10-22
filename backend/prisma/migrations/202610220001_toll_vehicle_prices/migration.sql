ALTER TABLE "demenag"."toll_points"
  ADD COLUMN "vehicle_prices" JSONB NOT NULL DEFAULT '{}'::jsonb;
