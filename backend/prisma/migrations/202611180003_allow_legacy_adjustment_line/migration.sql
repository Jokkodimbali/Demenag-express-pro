ALTER TABLE "demenag"."lignes_devis"
  DROP CONSTRAINT "lignes_devis_montants_check";

ALTER TABLE "demenag"."lignes_devis"
  ADD CONSTRAINT "lignes_devis_montants_check" CHECK (
    quantite > 0
    AND (
      prix_unitaire >= 0
      OR libelle LIKE 'Remise jour creux%'
      OR libelle = 'Ajustement historique conservé depuis la sauvegarde'
    )
    AND montant = quantite * prix_unitaire
    AND position >= 0
  );
