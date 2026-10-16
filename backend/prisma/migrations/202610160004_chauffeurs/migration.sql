CREATE TABLE "demenag"."drivers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "vehicle_id" TEXT,
  CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "drivers_phone_key" ON "demenag"."drivers"("phone");
CREATE INDEX "drivers_vehicle_id_idx" ON "demenag"."drivers"("vehicle_id");
ALTER TABLE "demenag"."drivers" ADD CONSTRAINT "drivers_vehicle_id_fkey"
  FOREIGN KEY ("vehicle_id") REFERENCES "demenag"."vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
