ALTER TABLE "demenag"."settings"
  ADD COLUMN "business_email" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "business_ninea" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "business_rccm" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "quote_validity_days" INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN "booking_deposit_percent" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "quote_terms" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "rental_overtime_hourly_rate" INTEGER NOT NULL DEFAULT 10000,
  ADD COLUMN "rental_kit_configuration" JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "demenag"."settings"
  ADD CONSTRAINT "settings_quote_validity_days_check"
    CHECK ("quote_validity_days" BETWEEN 0 AND 365),
  ADD CONSTRAINT "settings_booking_deposit_percent_check"
    CHECK ("booking_deposit_percent" BETWEEN 0 AND 100),
  ADD CONSTRAINT "settings_rental_overtime_hourly_rate_check"
    CHECK ("rental_overtime_hourly_rate" BETWEEN 0 AND 10000000);
