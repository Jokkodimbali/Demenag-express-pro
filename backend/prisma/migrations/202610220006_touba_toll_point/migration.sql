-- « Péage de Thiès (Ila Touba) » ne désigne pas la gare de Touba.
-- Une correspondance sur le seul mot « Touba » avait empêché cet ajout.
INSERT INTO "demenag"."toll_points"
  ("id", "name", "region", "axis", "heavy_price", "latitude", "longitude")
SELECT gen_random_uuid(), 'Péage de Touba', 'Diourbel', 'Autoroute Ila Touba',
       6500, 14.8667, -15.8667
WHERE NOT EXISTS (
  SELECT 1 FROM "demenag"."toll_points"
  WHERE lower(trim("name")) IN ('péage de touba', 'gare de touba', 'touba')
);
