-- Repères et nouveaux points repris de la page hors ligne fournie par l'administrateur.
-- Les tarifs des points déjà présents restent ceux enregistrés dans l'application.
ALTER TABLE "demenag"."toll_points"
  ADD COLUMN "region" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "axis" TEXT NOT NULL DEFAULT '';

UPDATE "demenag"."toll_points"
SET "region" = 'Dakar', "axis" = 'Autoroute de l’Avenir (Dakar–Diamniadio)'
WHERE "operator" = 'SECAA' AND "region" = '';

UPDATE "demenag"."toll_points"
SET "region" = 'Fatick', "axis" = 'Pont de Foundiougne'
WHERE "operator" = 'AGEROUTE' AND "name" LIKE '%Foundiougne%';

UPDATE "demenag"."toll_points"
SET "region" = 'Sédhiou', "axis" = 'Pont de Marsassoum'
WHERE "operator" = 'AGEROUTE' AND "name" LIKE '%Marsassoum%';

UPDATE "demenag"."toll_points"
SET "latitude" = 14.7537, "longitude" = -17.3798
WHERE "operator" = 'SECAA' AND "name" = 'Péage de Thiaroye'
  AND "latitude" IS NULL AND "longitude" IS NULL;

UPDATE "demenag"."toll_points"
SET "latitude" = 14.6870, "longitude" = -17.0560
WHERE "operator" = 'SECAA' AND "name" = 'Péage de Toglou'
  AND "latitude" IS NULL AND "longitude" IS NULL;

INSERT INTO "demenag"."toll_points"
  ("id", "name", "operator", "region", "axis", "heavy_price", "latitude", "longitude")
VALUES
  (gen_random_uuid(), 'Péage de Diamniadio', 'SECAA', 'Dakar', 'Autoroute de l’Avenir (Dakar–Diamniadio)', 1800, 14.7180, -17.1830),
  (gen_random_uuid(), 'Péage de Sindia', 'SECAA', 'Thiès', 'Autoroute Diamniadio–AIBD–Mbour', 1500, 14.5900, -17.0100),
  (gen_random_uuid(), 'Péage de Thiès (Ila Touba)', 'SECAA', 'Thiès', 'Autoroute Ila Touba', 2000, 14.7740, -17.0420)
ON CONFLICT ("operator", "name") DO NOTHING;

UPDATE "demenag"."toll_points"
SET "region" = 'Thiès', "axis" = 'Autoroute Diamniadio–AIBD–Mbour'
WHERE "operator" = 'SECAA' AND "name" = 'Péage de Toglou';
