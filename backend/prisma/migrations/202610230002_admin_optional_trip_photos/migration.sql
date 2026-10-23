ALTER TABLE "demenag"."booking_trips"
DROP CONSTRAINT "booking_trips_photos_check";

ALTER TABLE "demenag"."booking_trips"
ADD CONSTRAINT "booking_trips_photos_check" CHECK (
  jsonb_typeof("loading_photos") = 'array'
  AND jsonb_array_length("loading_photos") BETWEEN 0 AND 5
  AND (
    "unloading_photos" IS NULL
    OR (
      jsonb_typeof("unloading_photos") = 'array'
      AND jsonb_array_length("unloading_photos") BETWEEN 0 AND 5
    )
  )
);
