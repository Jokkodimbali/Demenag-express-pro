CREATE TABLE "demenag"."client_profiles" (
  "normalized_phone" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "address" TEXT NOT NULL DEFAULT '',
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "client_profiles_pkey" PRIMARY KEY ("normalized_phone")
);
