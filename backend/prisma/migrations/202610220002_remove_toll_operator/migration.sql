-- Les noms et les tarifs des points existants sont conservés.
DROP INDEX IF EXISTS "demenag"."toll_points_operator_name_key";
ALTER TABLE "demenag"."toll_points" DROP COLUMN IF EXISTS "operator";
