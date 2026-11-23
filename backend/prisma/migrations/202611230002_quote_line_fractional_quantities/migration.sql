ALTER TABLE "demenag"."lignes_devis"
  ALTER COLUMN "quantite" TYPE DECIMAL(10, 2)
  USING "quantite"::DECIMAL(10, 2);
