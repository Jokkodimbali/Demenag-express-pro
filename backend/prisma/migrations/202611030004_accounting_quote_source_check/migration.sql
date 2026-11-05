ALTER TABLE "demenag"."accounting_entries"
ADD CONSTRAINT "accounting_entries_quote_source_consistency_check"
CHECK (
  ("source_quote_id" IS NULL AND "source_quote_kind" IS NULL)
  OR (
    "source_quote_id" IS NOT NULL
    AND "source_quote_kind" IN ('revenue', 'movers', 'assembly')
  )
);
