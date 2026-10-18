CREATE TABLE "demenag"."vehicle_inspections" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "driver_id" UUID NOT NULL,
  "vehicle_id" TEXT NOT NULL,
  "inspection_date" DATE NOT NULL,
  "levels" JSONB NOT NULL,
  "vehicle_condition" TEXT NOT NULL,
  "observations" TEXT NOT NULL,
  "photos" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vehicle_inspections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "vehicle_inspections_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "demenag"."drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "vehicle_inspections_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "demenag"."vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "vehicle_inspections_driver_id_inspection_date_key" ON "demenag"."vehicle_inspections"("driver_id", "inspection_date");
CREATE INDEX "vehicle_inspections_inspection_date_created_at_idx" ON "demenag"."vehicle_inspections"("inspection_date", "created_at");

CREATE TABLE "demenag"."breakdown_reports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "driver_id" UUID NOT NULL,
  "vehicle_id" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "accuracy_meters" DOUBLE PRECISION,
  "photos" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'nouveau',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "breakdown_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "breakdown_reports_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "demenag"."drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "breakdown_reports_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "demenag"."vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "breakdown_reports_status_created_at_idx" ON "demenag"."breakdown_reports"("status", "created_at");
