ALTER TABLE "demenag"."settings"
  ADD COLUMN "business_name" TEXT NOT NULL DEFAULT 'Demenag Express',
  ADD COLUMN "business_address" TEXT NOT NULL DEFAULT 'Dakar, Sénégal',
  ADD COLUMN "invoice_footer" TEXT NOT NULL DEFAULT 'Merci pour votre confiance.',
  ADD COLUMN "invoice_logo" TEXT;
