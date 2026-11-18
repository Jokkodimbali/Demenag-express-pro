DROP INDEX IF EXISTS "demenag"."drivers_phone_key";
CREATE INDEX IF NOT EXISTS "drivers_phone_idx" ON "demenag"."drivers"("phone");
