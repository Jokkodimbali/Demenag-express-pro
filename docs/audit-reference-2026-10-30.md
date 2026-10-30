# Audit de la référence Demenag Express — 30 octobre 2026

## Corrections appliquées après l'audit

Les constats et la matrice plus bas décrivent l'état initial. Les corrections
suivantes ont ensuite été appliquées au code de l'application :

| Point                        | Correction                                                                                                                                                                       | Vérification                                                                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Photos des anciens contrôles | Conversion atomique vers l'ordre des cinq points lors du premier ajout du carburant, avec conservation des photos supplémentaires                                                | Test du dépôt Prisma avec transaction simulée, puis deuxième modification pour vérifier l'absence de nouvelle permutation                      |
| Historique limité à 300      | Suppression de la troncature silencieuse des listes administrateur                                                                                                               | Test du dépôt ; pagination et filtres existants conservés                                                                                      |
| Attente et requêtes doubles  | Partage des requêtes simultanées de contrôles ; chargement indépendant des contrôles et des preuves                                                                              | Une seule requête de contrôles observée dans Chrome ; tableau affiché alors que les employés sont encore en chargement dans le scénario simulé |
| Filtres mobiles              | Recherche et filtre principal alignés ; autres filtres sur la largeur disponible                                                                                                 | Chrome, largeur 390 px : position verticale identique, aucun débordement de la page                                                            |
| Erreur photo masquée         | Message visible pour les erreurs de lecture/conversion                                                                                                                           | Image fictive invalide : « Photo non reconnue. » affiché dans Chrome                                                                           |
| Dates                        | Affichage et filtre des contrôles utilisent tous deux Africa/Dakar                                                                                                               | Vérification du code                                                                                                                           |
| Plus de 35 km                | Transport à zéro en l'absence de prix personnalisé ; autres prestations et remises calculées                                                                                     | Tests backend et frontend ; indication « Sur devis » conservée sur le document comme dans la référence                                         |
| Téléphone vide               | Suppression du tiret ajouté dans l'aperçu de création du devis                                                                                                                   | Vérification du composant                                                                                                                      |
| Estimations existantes       | Calcul partagé avec le catalogue courant dans les cartes client, réservations, calendrier, totaux clients, revenus prévisionnels et PDF provisoire ; montants terminés conservés | Tests de calcul et scénario Chrome : 102 000 → 240 000 FCFA après changement du tarif transport à 99 000                                       |
| PDF                          | Mesure du libellé avec la police de rendu ; bloc paiement/signatures ajusté à l'espace disponible avant les annexes                                                              | Téléchargement réel dans Chrome avec API fictive : une page A4, total 240 000 FCFA, aucun chevauchement observé sur ce document                |

Un écart connexe a été corrigé : le transport n'est plus repris comme prestation
supplémentaire lors de la réouverture d'un devis dont le libellé utilise le nom
court du véhicule.

Ces essais n'ont modifié aucune donnée réelle. La suppression de la limite de
300 rend l'historique accessible, mais les listes sont toujours chargées en
entier : les performances sur un historique volumineux restent à mesurer.
Une mesure réelle après correction, avec le compte administrateur et uniquement
des lectures métier, a affiché les contrôles en 2 483 ms et toute la page en
2 643 ms. Les requêtes réservations, contrôles et employés ont pris respectivement
1 102, 1 652 et 1 803 ms, toutes HTTP 200 et chacune émise une seule fois.
Cette mesure ne prouve pas un délai constant ni que toute la différence avec
les 15,5 secondes initiales provient du code : la charge et la connexion à la
base peuvent varier. L'absence de base PostgreSQL de test empêche toujours
de valider les écritures et la conservation après redémarrage de bout en bout.
Le fichier HTML de référence reste intact ; son erreur de démarrage originale
n'est pas modifiée par ces corrections applicatives.

Preuves locales de la vérification navigateur :

- `/tmp/demenag-corrected-provisoire.pdf`
- `/tmp/demenag-corrected-provisoire.png`
- `/tmp/demenag-corrected-client.png`
- `/tmp/demenag-corrected-controls-mobile.png`

Ces fichiers temporaires contiennent des données fictives.

Validation après corrections : build backend/frontend réussi ; lint, formatage,
types et contrôle d'architecture réussis ; 55 tests backend réussis et un test
PostgreSQL ignoré ; les neuf fichiers de tests frontend réussissent. Les tests
de prix et du dépôt des contrôles ont également été relancés après les dernières
modifications. Le scénario de dépôt vérifie désormais l'accès au 301e contrôle.
Le prix personnalisé explicite de zéro est accepté à la réouverture d'un devis
non chiffré, pour éviter une erreur de validation après le changement de calcul.

## Périmètre et méthode

La référence examinée est `reference/Demenag Express.dc.html`, SHA-256
`c7891b503aa0b22eaff5f2627e4a1f64072d7ef4da691d89a144a5fada6a555a`.
Le fichier téléchargé `déménag express pro(versionwave)/Demenag Express.dc.html`
a la même empreinte. Les ressources originales contrôlées par le projet sont intactes.

La comparaison comprend la lecture des écrans et des calculs, l'ouverture de
l'application locale dans Chrome avec le compte administrateur, la consultation
des dix onglets administrateur, une mesure des API en lecture seule et un scénario
de contrôles avec des réponses API fictives. Les données de la base n'ont pas été
modifiées pendant ces scénarios.

La référence téléchargée affiche au premier démarrage l'erreur
`Cannot read properties of undefined (reading 'flatMap')`. Pour voir ses écrans,
une copie temporaire a été exécutée après déplacement de l'initialisation de son
état. Le document de référence n'a pas été modifié. Les captures de la copie
temporaire ne constituent donc pas une validation du fonctionnement du fichier
original.

## Résultat par écran

| Écran                  | Vérifications effectuées                                                                                                                                                      | Reste à vérifier                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Accueil                | Application et copie temporaire de la référence ouvertes. Structure générale observée.                                                                                        | Parcours complet, carte et rendu mobile.                                                           |
| Connexion              | Connexion administrateur réelle réussie. L'application utilise le numéro du compte admin; la référence utilise l'identifiant `admin`. Le formulaire client diffère également. | Connexion et première connexion client/employé.                                                    |
| Réservation publique   | Page ouverte; code de calcul et tests existants examinés.                                                                                                                     | Saisie complète, carte, enregistrement et PDF avec données de test.                                |
| Espace client          | Composants et routes examinés.                                                                                                                                                | Connexion réelle, modification, suivi et PDF.                                                      |
| Espace employé         | Composants, API de missions et contrôles examinés.                                                                                                                            | Connexion réelle, disponibilités, contrôle et preuves photo.                                       |
| Admin — réservations   | Page ouverte et 16 réservations chargées; liste et filtres visibles.                                                                                                          | Actions sur des réservations de test et comparaison avec données identiques.                       |
| Admin — calendrier     | Page ouverte et réservations chargées.                                                                                                                                        | Navigation jour/semaine/mois, événements et cas aux frontières.                                    |
| Admin — équipes        | Page ouverte avec carte et panneaux.                                                                                                                                          | Affectations, disponibilités et modifications enregistrées.                                        |
| Admin — suivi planning | Page ouverte avec les compteurs et le rapport QHSE.                                                                                                                           | Vérification des états et export avec des données comparables.                                     |
| Admin — clients        | Page ouverte et liste chargée.                                                                                                                                                | Modification, recherche, pagination et réinitialisation dans une base de test.                     |
| Admin — créer un devis | Écran initial comparé à la copie temporaire. Une différence de présentation et un écart de calcul sont décrits ci-dessous.                                                    | Remplissage de chaque section et comparaison du PDF.                                               |
| Admin — comptabilité   | Page ouverte; tests de prévision et documents exécutés.                                                                                                                       | Comparaison des écritures et documents avec des données identiques, enregistrement et redémarrage. |
| Admin — contrôles      | Page chargée, affichage mobile observé; pagination et ancien contrôle vérifiés avec API fictive. Plusieurs points sont décrits ci-dessous.                                    | Suppression et persistance réelles dans une base de test.                                          |
| Admin — péages         | Carte et liste ouvertes. L'application contient 20 points et la référence initialisée en contient 5; les jeux de données diffèrent.                                           | Édition, itinéraire, facture et persistance avec données identiques.                               |
| Admin — paramètres     | Page ouverte; contrôles de prix et matrice couverts par des tests existants.                                                                                                  | Modifier tous les champs, redémarrer et comparer les devis correspondants dans une base de test.   |

Les filtres, la pagination et les fenêtres de confirmation ajoutés à la demande de
l'utilisateur sont des différences voulues avec le fichier de référence.

## Points constatés

1. **Anciennes photos de contrôle.** L'affichage choisit l'ancien ordre des photos
   uniquement tant que la clé `fuel` est absente. Modifier le niveau d'essence
   ajoute cette clé et fait utiliser l'autre ordre. Avec un contrôle fictif,
   les indices avant modification étaient `[0, 2, 1, 4, absent]`, puis
   `[0, 1, 2, 3, 4]` après modification : les photos ne correspondent plus aux
   mêmes contrôles. Voir `frontend/src/pages/AdminVehicleReports.tsx` et
   `backend/src/adapters/out/prisma/vehicle-reports.ts`.
2. **Historique limité.** L'API ne renvoie que les 300 contrôles les plus récents.
   La pagination et les filtres de la page portent donc seulement sur ces 300
   résultats, contrairement à une recherche sur l'historique complet.
3. **Chargement des contrôles.** Une mesure réelle a pris environ 15,5 secondes;
   la requête des employés a pris environ 13,8 secondes et une requête des
   contrôles environ 15,5 secondes. La page attend simultanément contrôles,
   réservations et employés avant d'afficher l'un ou l'autre tableau. Deux
   requêtes de contrôles ont été observées en mode développement. Cela ne
   démontre pas à lui seul les performances en production.
4. **Rendu mobile des filtres.** À 390 px, la recherche occupe sa propre ligne et
   les filtres sont placés en grille; certains libellés de sélection sont tronqués.
   Cela diffère de la demande de conserver recherche et filtre sur une ligne.
   Aucun débordement horizontal de la page entière n'a été observé à cette largeur.
5. **Erreur de remplacement de photo.** Si la lecture ou la conversion locale
   d'une image échoue, l'exception est absorbée avant l'appel API et aucun message
   n'est affiché à l'utilisateur.
6. **Filtre de date.** Le filtre utilise le fuseau de Dakar, tandis que la date
   affichée utilise le fuseau du navigateur. Un utilisateur situé dans un autre
   fuseau peut voir une date différente de celle utilisée pour le filtre.
7. **Devis au-delà de 35 km sans tarif personnalisé.** La fonction `calc` de la
   référence prend un transport à zéro et calcule les autres lignes. L'application
   conserve un total `null` (« sur devis »), même lorsque d'autres prestations
   ont un montant. C'est une différence de règle explicitement couverte par les
   tests actuels; elle doit être examinée avant de modifier les montants existants.
8. **Aperçu de devis vide.** Pour un numéro client vide, l'application affiche un
   tiret; la référence affiche le champ vide. La comparaison visuelle initiale
   ne permet pas de conclure à l'identité de toutes les autres dispositions.
9. **Recalcul d'une estimation existante.** Dans un scénario fictif, le tarif
   Sprinter est passé de 30 000 à 99 000 FCFA. L'application a continué à
   afficher l'estimation enregistrée de 102 000 FCFA dans l'espace client. Avec
   les mêmes prestations et le nouveau tarif, la copie temporaire de la
   référence affiche 240 000 FCFA. Un nouveau devis dans l'application utilise
   bien le tarif de 99 000 FCFA. Le scénario utilise une API simulée : il ne
   démontre pas la persistance réelle en base. Voir
   `frontend/src/components/ClientBookingCard.tsx` et
   `reference/Demenag Express.dc.html`.
10. **PDF provisoire.** Pour un devis fictif comparable à 102 000 FCFA, le PDF
    de l'application comporte deux pages contre une pour la copie temporaire
    de la référence. Dans le PDF de l'application, le libellé de la première
    prestation chevauche sa quantité. Les jeux de données ne sont pas
    parfaitement identiques, notamment les coordonnées et la distance : cette
    comparaison ne suffit pas à juger tous les détails visuels. Le découpage
    du texte avant le changement de taille de police dans
    `frontend/src/adapters/pdf.ts` est une cause possible du chevauchement.

## Parcours complémentaires avec données fictives

- **Paramètres et devis :** la modification d'un tarif a déclenché une requête
  `PUT /api/catalogue`; après rechargement, le tarif est resté présent dans
  l'API simulée et a été utilisé pour un nouveau devis. La conservation après
  redémarrage du serveur et l'écriture PostgreSQL ne sont pas démontrées.
- **Espace client :** la fiche et le téléchargement du devis provisoire ont été
  exercés. Un second devis fictif affiche 72 000 FCFA de prestations, une
  remise de 5 000 FCFA, un total de 67 000 FCFA et 2 400 FCFA de péages
  séparés. Le PDF téléchargé reprend ces montants et comporte trois pages.
- **Espace employé :** à 390 px, le changement de disponibilité a été conservé
  après rechargement avec l'API simulée. Un contrôle à cinq points et une
  preuve photo ont été envoyés à cette API. Aucun débordement horizontal de
  la page entière ni erreur JavaScript n'a été observé dans ce scénario.
- Tous ces essais utilisent des données et réponses fictives. Ils ne vérifient
  ni les écritures réelles, ni la connexion employé ou client réelle, ni tous
  les états de ces écrans.

## Vérifications automatiques et limites

- Référence et 11 ressources : contrôle d'intégrité réussi.
- Formatage, lint, architecture, types backend/frontend et build : réussis.
- Suite backend : 53 tests réussis; un scénario API → Prisma → PostgreSQL ignoré
  car `TEST_DATABASE_URL` n'est pas défini pour la suite.
- Suite frontend : les 8 fichiers de tests ont réussi.
- Les appels administrateur de lecture contrôlés ont répondu HTTP 200.
- Les écritures réelles, les redémarrages, tous les PDF et tous les états mobiles
  n'ont pas été vérifiés de bout en bout. Il est donc impossible d'affirmer que
  toute l'application est identique ou sans défaut à ce stade.
