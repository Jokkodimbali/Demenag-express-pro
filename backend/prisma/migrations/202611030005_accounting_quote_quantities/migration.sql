ALTER TABLE "demenag"."accounting_entries"
ADD COLUMN "source_quote_quantity" INTEGER;

ALTER TABLE "demenag"."accounting_entries"
DROP CONSTRAINT "accounting_entries_quote_source_consistency_check";

ALTER TABLE "demenag"."accounting_entries"
ADD CONSTRAINT "accounting_entries_quote_source_consistency_check"
CHECK (
  (
    "source_quote_id" IS NULL
    AND "source_quote_kind" IS NULL
    AND "source_quote_quantity" IS NULL
  )
  OR (
    "source_quote_id" IS NOT NULL
    AND (
      ("source_quote_kind" = 'revenue' AND "source_quote_quantity" IS NULL)
      OR (
        "source_quote_kind" IN ('movers', 'assembly')
        AND "source_quote_quantity" IS NOT NULL
        AND "source_quote_quantity" > 0
      )
    )
  )
);
