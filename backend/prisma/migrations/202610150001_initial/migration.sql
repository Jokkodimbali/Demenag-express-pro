-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "demenag";

-- CreateEnum
CREATE TYPE "demenag"."Role" AS ENUM ('client', 'admin');

-- CreateEnum
CREATE TYPE "demenag"."BookingStatus" AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "demenag"."users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "demenag"."Role" NOT NULL DEFAULT 'client',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demenag"."sessions" (
    "token_hash" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("token_hash")
);

-- CreateTable
CREATE TABLE "demenag"."vehicles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "volume" TEXT NOT NULL,
    "length" TEXT NOT NULL,
    "height" TEXT NOT NULL,
    "width" TEXT NOT NULL,
    "wheel_width" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "interior" TEXT NOT NULL,
    "prices" INTEGER[],

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demenag"."settings" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "labour_price" INTEGER NOT NULL,
    "assembly_price" INTEGER NOT NULL,
    "business_phone" TEXT NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demenag"."routes" (
    "id" UUID NOT NULL,
    "data" JSONB NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demenag"."bookings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "time_slot" TEXT NOT NULL,
    "status" "demenag"."BookingStatus" NOT NULL DEFAULT 'pending',
    "data" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "demenag"."users"("phone");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "demenag"."sessions"("expires_at");

-- CreateIndex
CREATE INDEX "routes_expires_at_idx" ON "demenag"."routes"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_reference_key" ON "demenag"."bookings"("reference");

-- CreateIndex
CREATE INDEX "bookings_user_id_created_at_idx" ON "demenag"."bookings"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "bookings_status_date_idx" ON "demenag"."bookings"("status", "date");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_user_id_request_id_key" ON "demenag"."bookings"("user_id", "request_id");

-- AddForeignKey
ALTER TABLE "demenag"."sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "demenag"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demenag"."bookings" ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "demenag"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demenag"."bookings" ADD CONSTRAINT "bookings_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "demenag"."vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Un seul véhicule par modèle peut être confirmé sur un même créneau.
-- Index partiel géré par cette migration, en complément du modèle Prisma.
CREATE UNIQUE INDEX "bookings_vehicle_slot" ON "demenag"."bookings"("vehicle_id", "date", "time_slot")
WHERE "status" IN ('confirmed', 'in_progress');
ALTER TABLE "demenag"."vehicles" ADD CONSTRAINT "three_positive_prices" CHECK (cardinality("prices") = 3 AND 0 < ALL("prices"));
ALTER TABLE "demenag"."settings" ADD CONSTRAINT "positive_services" CHECK ("labour_price" >= 0 AND "assembly_price" >= 0);
