-- Centres des ouvrages de péage nommés dans OpenStreetMap :
-- Thiaroye : way/494202946 ; Toglou : way/535031829.
-- Ne pas remplacer les coordonnées qu'un administrateur a déjà déplacées.
UPDATE "demenag"."toll_points"
SET "latitude" = 14.749201, "longitude" = -17.379720
WHERE "name" = 'Péage de Thiaroye'
  AND "latitude" = 14.753700 AND "longitude" = -17.379800;

UPDATE "demenag"."toll_points"
SET "latitude" = 14.711516, "longitude" = -17.096565
WHERE "name" = 'Péage de Toglou'
  AND "latitude" = 14.687000 AND "longitude" = -17.056000;
