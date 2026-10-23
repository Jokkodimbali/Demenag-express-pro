CREATE TABLE "demenag"."accounting_entries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "type" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "date" DATE NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "voided_at" TIMESTAMPTZ,
  CONSTRAINT "accounting_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "accounting_entries_type_check" CHECK ("type" IN ('charge', 'revenu')),
  CONSTRAINT "accounting_entries_amount_check" CHECK ("amount" > 0)
);

CREATE INDEX "accounting_entries_date_voided_at_idx"
  ON "demenag"."accounting_entries"("date", "voided_at");
