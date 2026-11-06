CREATE TABLE "demenag"."inventory_illustrations" (
  "key" VARCHAR(150) NOT NULL,
  "image" TEXT NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_illustrations_pkey" PRIMARY KEY ("key")
);
