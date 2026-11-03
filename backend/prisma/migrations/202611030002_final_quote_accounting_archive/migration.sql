ALTER TABLE "demenag"."accounting_entries"
ADD COLUMN "source_quote_id" UUID;

CREATE UNIQUE INDEX "accounting_entries_source_quote_id_key"
ON "demenag"."accounting_entries"("source_quote_id");
