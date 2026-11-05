ALTER TABLE "demenag"."bookings" ADD COLUMN "deleted_at" TIMESTAMPTZ;

CREATE INDEX "bookings_deleted_at_created_at_idx"
  ON "demenag"."bookings"("deleted_at", "created_at");
