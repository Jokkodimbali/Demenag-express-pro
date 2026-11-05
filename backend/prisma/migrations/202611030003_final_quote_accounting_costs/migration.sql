DROP INDEX IF EXISTS "demenag"."accounting_entries_source_quote_id_key";

ALTER TABLE "demenag"."accounting_entries"
ADD COLUMN "source_quote_kind" TEXT;

CREATE UNIQUE INDEX "accounting_entries_source_quote_id_source_quote_kind_key"
ON "demenag"."accounting_entries"("source_quote_id", "source_quote_kind");

UPDATE "demenag"."accounting_entries"
SET "source_quote_kind" = 'revenue'
WHERE "source_quote_id" IS NOT NULL;

