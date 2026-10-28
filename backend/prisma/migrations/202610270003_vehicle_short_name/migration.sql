ALTER TABLE "demenag"."vehicles"
ADD COLUMN "short_name" TEXT NOT NULL DEFAULT '';

UPDATE "demenag"."vehicles"
SET "short_name" = "name"
WHERE "short_name" = '';
