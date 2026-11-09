ALTER TABLE "demenag"."settings"
ADD COLUMN "contact_first_template" TEXT NOT NULL DEFAULT '{ref} {prenom}',
ADD COLUMN "contact_last_template" TEXT NOT NULL DEFAULT '{nom} · {date}';
