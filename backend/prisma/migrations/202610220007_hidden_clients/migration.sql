CREATE TABLE "demenag"."hidden_clients" (
  "normalized_phone" TEXT NOT NULL,
  "hidden_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hidden_clients_pkey" PRIMARY KEY ("normalized_phone")
);
