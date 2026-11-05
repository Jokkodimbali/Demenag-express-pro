ALTER TABLE "demenag"."settings"
  ADD COLUMN "whatsapp_provisional_template" TEXT NOT NULL DEFAULT 'Bonjour {nom},

Merci pour votre demande. Voici votre devis provisoire Demenag Express n° {num} :
- Date : {date}{heure}
- Trajet : {trajet}
- Véhicule : {vehicule}, {voyages}
- Montant estimé : {total}

Ce montant est une estimation établie d’après votre inventaire. Il sera confirmé par le devis final.
Je vous envoie le PDF du devis juste après ce message.

Pour confirmer ou modifier votre demande, répondez simplement ici.';

UPDATE "demenag"."settings"
SET "whatsapp_quote_template" = 'Bonjour {nom},

Voici votre devis final Demenag Express n° {num} :
- Date : {date}{heure}
- Trajet : {trajet}
- Véhicule : {vehicule}, {voyages}
- Montant total : {total}

Ce montant est définitif.
Je vous envoie le PDF du devis final juste après ce message.

Merci pour votre confiance.'
WHERE "whatsapp_quote_template" = 'Bonjour {nom}, votre déménagement est terminé. Voici votre devis final Demenag Express {num} : {total} ({allers} aller(s)-retour(s), {vehicule}). Le PDF est disponible dans votre espace client. Merci !';
