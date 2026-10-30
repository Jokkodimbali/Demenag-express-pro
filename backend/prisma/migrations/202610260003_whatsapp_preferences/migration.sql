ALTER TABLE "demenag"."settings"
ADD COLUMN "whatsapp_country_code" TEXT NOT NULL DEFAULT '221',
ADD COLUMN "whatsapp_mode" TEXT NOT NULL DEFAULT 'api',
ADD COLUMN "whatsapp_quote_template" TEXT NOT NULL DEFAULT 'Bonjour {nom}, votre déménagement est terminé. Voici votre devis final Demenag Express {num} : {total} ({allers} aller(s)-retour(s), {vehicule}). Le PDF est disponible dans votre espace client. Merci !';
