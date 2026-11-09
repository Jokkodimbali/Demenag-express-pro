ALTER TABLE "demenag"."settings"
  ADD COLUMN "quote_terms_enabled" BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE "demenag"."settings"
SET "quote_terms" = $terms$Validité : ce devis est valable 30 jours à compter de sa date d’émission.
Réservation : la date est réservée dès l’acceptation du devis par le client (signature ou confirmation écrite, WhatsApp compris).
Paiement : le montant est réglé à la fin du déménagement, selon le mode de paiement indiqué sur le devis.
Report ou annulation : toute demande de report ou d’annulation doit être signalée au moins 48 heures avant la date prévue.
Préparation : le client veille à ce que ses affaires soient prêtes à charger à l’arrivée de l’équipe et à garantir l’accès (stationnement, ascenseur, clés).
Inventaire : le prix est établi d’après l’inventaire déclaré. Tout objet ou volume supplémentaire, ou tout dépassement du temps prévu, peut entraîner un ajustement du devis final.
Objets de valeur : bijoux, argent, documents et objets précieux restent sous la garde du client.
Réserves : toute réserve sur l’état des biens doit être signalée à l’équipe avant son départ. Les cartons fermés par le client voyagent sous sa responsabilité.
Location avec chauffeur : les manœuvres sont fournis et encadrés par le client. Demenag Express répond du véhicule, du chauffeur et du matériel fourni.$terms$
WHERE "quote_terms" = '';

ALTER TABLE "demenag"."settings"
  ALTER COLUMN "quote_terms" SET DEFAULT $terms$Validité : ce devis est valable 30 jours à compter de sa date d’émission.
Réservation : la date est réservée dès l’acceptation du devis par le client (signature ou confirmation écrite, WhatsApp compris).
Paiement : le montant est réglé à la fin du déménagement, selon le mode de paiement indiqué sur le devis.
Report ou annulation : toute demande de report ou d’annulation doit être signalée au moins 48 heures avant la date prévue.
Préparation : le client veille à ce que ses affaires soient prêtes à charger à l’arrivée de l’équipe et à garantir l’accès (stationnement, ascenseur, clés).
Inventaire : le prix est établi d’après l’inventaire déclaré. Tout objet ou volume supplémentaire, ou tout dépassement du temps prévu, peut entraîner un ajustement du devis final.
Objets de valeur : bijoux, argent, documents et objets précieux restent sous la garde du client.
Réserves : toute réserve sur l’état des biens doit être signalée à l’équipe avant son départ. Les cartons fermés par le client voyagent sous sa responsabilité.
Location avec chauffeur : les manœuvres sont fournis et encadrés par le client. Demenag Express répond du véhicule, du chauffeur et du matériel fourni.$terms$;
