ALTER TABLE "demenag"."drivers"
ADD COLUMN "availability" JSONB NOT NULL DEFAULT '[]'::jsonb;
