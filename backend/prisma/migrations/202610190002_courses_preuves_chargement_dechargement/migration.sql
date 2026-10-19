CREATE TABLE "demenag"."booking_trips" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "booking_id" UUID NOT NULL,
  "sequence_number" INTEGER NOT NULL,
  "loading_photos" JSONB NOT NULL,
  "unloading_photos" JSONB,
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMPTZ,
  CONSTRAINT "booking_trips_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "booking_trips_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "demenag"."bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "booking_trips_sequence_number_check" CHECK ("sequence_number" > 0),
  CONSTRAINT "booking_trips_photos_check" CHECK (
    jsonb_typeof("loading_photos") = 'array' AND jsonb_array_length("loading_photos") BETWEEN 1 AND 5
    AND ("unloading_photos" IS NULL OR (jsonb_typeof("unloading_photos") = 'array' AND jsonb_array_length("unloading_photos") BETWEEN 1 AND 5))
  )
);
CREATE UNIQUE INDEX "booking_trips_booking_id_sequence_number_key" ON "demenag"."booking_trips"("booking_id", "sequence_number");
CREATE INDEX "booking_trips_booking_id_sequence_number_idx" ON "demenag"."booking_trips"("booking_id", "sequence_number");
