DROP INDEX IF EXISTS "demenag"."vehicle_inspections_driver_id_inspection_date_key";
CREATE INDEX "vehicle_inspections_driver_id_inspection_date_idx" ON "demenag"."vehicle_inspections"("driver_id", "inspection_date");
