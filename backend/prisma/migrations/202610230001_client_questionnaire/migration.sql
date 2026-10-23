ALTER TABLE "demenag"."settings"
ADD COLUMN "client_questionnaire" JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE "demenag"."settings"
SET "client_questionnaire" = $questions$
[
  {"id":"name","group":"Client","label":"Quel est votre nom et prénom ?","answerType":"text","required":false,"active":true},
  {"id":"phone","group":"Client","label":"Quel numéro pour vous joindre ? Est-il sur WhatsApp ?","answerType":"text","required":false,"active":true},
  {"id":"date","group":"Client","label":"Quelle date souhaitez-vous ?","answerType":"text","required":false,"active":true},
  {"id":"time","group":"Client","label":"À quelle heure peut-on commencer ?","answerType":"text","required":false,"active":true},
  {"id":"from","group":"Adresses et accès","label":"Quelle est l’adresse de départ ?","answerType":"text","required":false,"active":true},
  {"id":"to","group":"Adresses et accès","label":"Quelle est l’adresse d’arrivée ?","answerType":"text","required":false,"active":true},
  {"id":"rep","group":"Adresses et accès","label":"Quels repères pour trouver les lieux (bâtiment, porte, lieu connu) ?","answerType":"text","required":false,"active":true},
  {"id":"floor","group":"Adresses et accès","label":"À quel étage, au départ et à l’arrivée ?","answerType":"text","required":false,"active":true},
  {"id":"lift","group":"Adresses et accès","label":"Y a-t-il un ascenseur assez grand pour les meubles ?","answerType":"yes_no","required":false,"active":true},
  {"id":"truck","group":"Adresses et accès","label":"Le camion peut-il se garer devant ? À quelle distance de la porte ?","answerType":"text","required":false,"active":true},
  {"id":"dwelling","group":"Inventaire","label":"Quel type de logement (studio, F2, F3, villa…) ?","answerType":"text","required":false,"active":true},
  {"id":"items","group":"Inventaire","label":"Quels meubles et objets faut-il transporter ?","answerType":"text","required":false,"active":true},
  {"id":"assembly","group":"Inventaire","label":"Des meubles sont-ils à démonter et remonter ?","answerType":"yes_no","required":false,"active":true},
  {"id":"fragile","group":"Inventaire","label":"Avez-vous des objets fragiles ou de valeur ?","answerType":"yes_no","required":false,"active":true},
  {"id":"heavy","group":"Inventaire","label":"Avez-vous des objets très lourds (frigo américain, coffre, piano) ?","answerType":"yes_no","required":false,"active":true},
  {"id":"packing","group":"Jour du déménagement","label":"Faites-vous l’emballage vous-même ou par notre équipe ?","answerType":"yes_no","required":false,"active":true},
  {"id":"cleaning","group":"Jour du déménagement","label":"Besoin de nettoyage, de débarras ou de stockage ?","answerType":"yes_no","required":false,"active":true},
  {"id":"payment","group":"Jour du déménagement","label":"Comment souhaitez-vous payer (Wave, Orange Money, espèces) ?","answerType":"text","required":false,"active":true}
]
$questions$::jsonb;