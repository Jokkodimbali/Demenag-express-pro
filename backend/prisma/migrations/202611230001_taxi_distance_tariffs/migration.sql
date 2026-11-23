CREATE TABLE IF NOT EXISTS "demenag"."taxi_distance_tariffs" (
  "id" VARCHAR(80) NOT NULL,
  "settings_id" TEXT NOT NULL DEFAULT 'main',
  "label" VARCHAR(180) NOT NULL,
  "min_distance_km" DOUBLE PRECISION NOT NULL,
  "max_distance_km" DOUBLE PRECISION,
  "amount_fcfa" INTEGER NOT NULL,
  "sort_order" INTEGER NOT NULL,
  CONSTRAINT "taxi_distance_tariffs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "taxi_distance_tariffs_settings_id_fkey"
    FOREIGN KEY ("settings_id") REFERENCES "demenag"."settings"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "taxi_distance_tariffs_amount_fcfa_check" CHECK ("amount_fcfa" >= 0),
  CONSTRAINT "taxi_distance_tariffs_distance_check"
    CHECK ("min_distance_km" >= 0 AND ("max_distance_km" IS NULL OR "max_distance_km" > "min_distance_km"))
);

CREATE UNIQUE INDEX IF NOT EXISTS "taxi_distance_tariffs_settings_id_sort_order_key"
  ON "demenag"."taxi_distance_tariffs"("settings_id", "sort_order");
CREATE INDEX IF NOT EXISTS "taxi_distance_tariffs_settings_id_min_distance_km_idx"
  ON "demenag"."taxi_distance_tariffs"("settings_id", "min_distance_km");

INSERT INTO "demenag"."taxi_distance_tariffs"
  ("id", "settings_id", "label", "min_distance_km", "max_distance_km", "amount_fcfa", "sort_order")
SELECT seed."id", 'main', seed."label", seed."min_distance_km", seed."max_distance_km", seed."amount_fcfa", seed."sort_order"
FROM (VALUES
  ('taxi-distance-1-3', 'Dans le quartier ou juste à côté (1–3 km)', 0::DOUBLE PRECISION, 3::DOUBLE PRECISION, 1500, 0),
  ('taxi-distance-3-7', 'Course moyenne (>3–7 km)', 3::DOUBLE PRECISION, 7::DOUBLE PRECISION, 2500, 1),
  ('taxi-distance-7-12', 'Traversée de Dakar (>7–12 km)', 7::DOUBLE PRECISION, 12::DOUBLE PRECISION, 3500, 2),
  ('taxi-distance-12-20', 'Dakar vers la banlieue proche (>12–20 km)', 12::DOUBLE PRECISION, 20::DOUBLE PRECISION, 5000, 3),
  ('taxi-distance-20-30', 'Banlieue lointaine, Rufisque (>20–30 km)', 20::DOUBLE PRECISION, 30::DOUBLE PRECISION, 7000, 4),
  ('taxi-distance-aibd', 'Aéroport AIBD (Diass), environ 45 km (>30 km)', 30::DOUBLE PRECISION, NULL::DOUBLE PRECISION, 30000, 5)
) AS seed("id", "label", "min_distance_km", "max_distance_km", "amount_fcfa", "sort_order")
JOIN "demenag"."settings" AS settings ON settings."id" = 'main'
ON CONFLICT ("id") DO NOTHING;
