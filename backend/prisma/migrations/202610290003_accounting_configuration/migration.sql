CREATE TABLE "demenag"."accounting_configuration" (
  "id" TEXT NOT NULL DEFAULT 'main',
  "data" JSONB NOT NULL DEFAULT '{}',
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "accounting_configuration_pkey" PRIMARY KEY ("id")
);
