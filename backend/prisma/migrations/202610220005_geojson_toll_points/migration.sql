-- Sept gares absentes du catalogue initial, d'après le GeoJSON fourni par l'administrateur.
-- Les coordonnées et montants sont ses valeurs de référence, modifiables dans l'administration.
-- Ne pas remplacer les tarifs officiels ou les positions déjà enregistrés pour les autres gares.
WITH supplied_points (name, match_name, region, axis, heavy_price, latitude, longitude) AS (
  VALUES
    ('Péage de Khombole', 'Khombole', 'Thiès', 'Autoroute Ila Touba', 2000, 14.7712, -16.7125),
    ('Péage de Bambey', 'Bambey', 'Diourbel', 'Autoroute Ila Touba', 2500, 14.7042, -16.4580),
    ('Péage de Diourbel', 'Diourbel', 'Diourbel', 'Autoroute Ila Touba', 4500, 14.6500, -16.2167),
    ('Péage de Touba', 'Touba', 'Diourbel', 'Autoroute Ila Touba', 6500, 14.8667, -15.8667),
    ('Péage de Nguékokh', 'Nguékokh', 'Thiès', 'Autoroute Diamniadio–AIBD–Mbour', 1800, 14.5150, -16.9320),
    ('Péage de Mbour / Malicounda', 'Mbour', 'Thiès', 'Autoroute Diamniadio–AIBD–Mbour', 2500, 14.4420, -16.8850),
    ('Péage de Kaolack', 'Kaolack', 'Kaolack', 'Autoroute Mbour–Fatick–Kaolack', 6000, 14.1500, -16.0833)
)
INSERT INTO "demenag"."toll_points"
  ("id", "name", "region", "axis", "heavy_price", "latitude", "longitude")
SELECT gen_random_uuid(), supplied.name, supplied.region, supplied.axis,
       supplied.heavy_price, supplied.latitude, supplied.longitude
FROM supplied_points AS supplied
WHERE NOT EXISTS (
  SELECT 1 FROM "demenag"."toll_points" AS existing
  WHERE existing."name" ILIKE '%' || supplied.match_name || '%'
);
