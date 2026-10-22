-- Gare « Péage Rufisque » cartographiée comme barrier=toll_booth
-- dans OpenStreetMap : way/494202956.
UPDATE "demenag"."toll_points"
SET "latitude" = 14.744997, "longitude" = -17.282019
WHERE "name" = 'Péage de Rufisque'
  AND "latitude" IS NULL AND "longitude" IS NULL;
