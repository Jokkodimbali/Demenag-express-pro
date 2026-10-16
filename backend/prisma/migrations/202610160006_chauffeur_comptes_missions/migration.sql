ALTER TYPE "demenag"."Role" ADD VALUE IF NOT EXISTS 'driver';

ALTER TABLE "demenag"."drivers"
  ADD COLUMN "user_id" UUID,
  ADD COLUMN "photo" TEXT;

CREATE UNIQUE INDEX "drivers_user_id_key" ON "demenag"."drivers"("user_id");
ALTER TABLE "demenag"."drivers"
  ADD CONSTRAINT "drivers_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "demenag"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "demenag"."bookings" ADD COLUMN "driver_id" UUID;
CREATE INDEX "bookings_driver_id_date_idx" ON "demenag"."bookings"("driver_id", "date");
ALTER TABLE "demenag"."bookings"
  ADD CONSTRAINT "bookings_driver_id_fkey"
  FOREIGN KEY ("driver_id") REFERENCES "demenag"."drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
