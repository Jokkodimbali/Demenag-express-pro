ALTER TABLE "demenag"."settings"
  ADD COLUMN "payment_wave" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "payment_cash" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "payment_qr" TEXT DEFAULT '/assets/wave-qr.png';
