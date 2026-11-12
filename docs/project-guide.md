# Guide complet du projet

Document de référence pratique pour comprendre les fonctionnalités, données, opérations et limites actuellement visibles dans le dépôt. Les valeurs configurées par une instance peuvent différer des valeurs initiales décrites ici.

## 1. Produit et périmètre fonctionnel

Demenag Express est une application de réservation et de gestion des déménagements, adaptée au contexte XOF et aux opérations décrites dans les interfaces.

| Espace                  | Fonctions                                                                                                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public/client           | Accueil, demande de réservation, inventaire et questionnaire, recherche d’adresses, trajet, estimation, inscription et consultation des dossiers client                    |
| Administration          | Tableau de bord, réservations, devis provisoires et finaux, clients, planification, équipes, flotte, péages, utilisateurs, paramètres, rapports, annonces                  |
| Comptabilité et finance | Journal, coûts de devis, coûts fixes, paramètres financiers, projection mensuelle et documents de comptabilité                                                             |
| Chauffeur               | Espace de mission, profil et disponibilité, détail de course, contrôles véhicule, preuve de chargement/déchargement et signalement d’incident selon les parcours autorisés |

La langue d’interface principale est le français. Les calculs et paramètres par défaut sont détaillés dans [calculations.md](calculations.md).

## 2. Identités et accès

| Rôle           | Création/connexion                                                | Accès fonctionnel                                                  |
| -------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| Client         | Inscription publique ; connexion par téléphone et mot de passe    | Parcours public, création/consultation de ses propres réservations |
| Administrateur | Compte créé par un administrateur ou outil local d’administration | Endpoints `/api/admin/*`, gestion globale                          |
| Chauffeur      | Compte/profil géré par l’administration ; accès chauffeur si lié  | Parcours `/api/driver/*` et missions qui lui sont attribuées       |

Le menu visible ou les guards du frontend ne sont pas des contrôles de sécurité suffisants : l’API applique ses propres contrôles d’accès. Les identifiants, clés ou données personnelles ne doivent pas figurer dans la documentation ou les journaux.

## 3. Parcours métier et statuts

### Cycle habituel de réservation

1. Le client sélectionne véhicule, adresse départ/arrivée, date/créneau, inventaire et services.
2. Le frontend demande l’estimation d’itinéraire et/ou le prix à l’API.
3. L’API valide les données et crée la réservation avec ses paramètres et coordonnées utiles.
4. L’administration confirme, refuse/annule ou complète le dossier selon les actions disponibles.
5. Une réservation confirmée entre en prestation ; les courses peuvent être suivies par séquence.
6. Le devis final peut être enregistré et comptabilisé ; les étapes de clôture dépendent des contrôles métier du backend.

### États

| État API      | Signification usuelle                   |
| ------------- | --------------------------------------- |
| `pending`     | Demande reçue, en attente de traitement |
| `confirmed`   | Créneau validé par l’administration     |
| `in_progress` | Déménagement en cours                   |
| `completed`   | Prestation terminée                     |
| `cancelled`   | Demande ou réservation annulée          |

Les transitions et préconditions sont vérifiées dans le domaine/services du backend. Une écriture concurrente peut être refusée via la version de réservation afin d’éviter l’écrasement silencieux.

## 4. Architecture

La vue d’ensemble complète et les responsabilités de chaque module figurent dans [architecture.md](architecture.md). En résumé :

- Frontend : modules fonctionnels dans `frontend/src/modules/`, domaine et services d’application séparés des vues et adaptateurs.
- Backend : architecture hexagonale, domaine `backend/src/domain`, services `backend/src/application/services`, ports, adaptateurs HTTP/Prisma et assemblage dans `composition.ts`.
- Partagé : `shared/` porte des contrats et valeurs de référence utilisés par les deux workspaces.

## 5. API HTTP

Le préfixe principal est `/api`. La liste complète des routes est la source de vérité `backend/src/adapters/in/http/routes.ts` et les fichiers de routes spécialisés. Les chemins ci-dessous résument les groupes fonctionnels.

| Groupe                  | Routes principales                                                                                            | Accès général                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Santé                   | `GET /health`, `GET /ready`                                                                                   | Public                                            |
| Authentification        | `/auth/register`, `/auth/login`, `/auth/me`, `/auth/logout`, `/auth/password`, `/auth/password-reset-request` | Selon route/session ; inscription client publique |
| Catalogue               | `/catalogue`, illustrations inventaire                                                                        | Lecture publique ; édition admin                  |
| Réservation et prix     | `/bookings`, `/bookings/:id/...`, `/estimates`, `/admin/estimates`                                            | Client propriétaire et admin selon action         |
| Itinéraire              | `/maps/search`, `/maps/reverse`, `/maps/route`                                                                | Public avec validation et limites de fréquence    |
| Administration          | `/admin/users`, `/admin/clients`, `/admin/drivers`, `/admin/profile`, `/admin/vehicle-reports`                | Administrateur                                    |
| Comptabilité            | `/admin/accounting`, `/admin/accounting/configuration`                                                        | Administrateur                                    |
| Paramètres/intégrations | Catalogue, péages, configuration IA, Google Maps, brouillon de devis                                          | Principalement administrateur                     |
| Chauffeur               | `/driver/profile`, `/driver/availability`, `/driver/bookings`, inspections, incidents, courses                | Chauffeur authentifié et données autorisées       |
| Notifications           | `/notifications`, lecture globale, annonces admin                                                             | Session et rôle selon action                      |

Les payloads sont validés par des schémas Zod dans `backend/src/adapters/in/http`. Le contrat exact d’une route se vérifie dans son fichier spécialisé et son schéma : ce tableau ne remplace pas une spécification OpenAPI.

## 6. Base de données et persistance

### Configuration

- Modèle Prisma : `backend/prisma/schema.prisma`.
- Fournisseur : PostgreSQL, schéma `demenag`.
- Migrations : `backend/prisma/migrations/` ; les migrations déjà appliquées ne doivent pas être réécrites.
- Requêtes applicatives : dépôts sous `backend/src/adapters/out/prisma/`.
- Données : PostgreSQL reste la persistance principale. Certaines données semi-structurées sont enregistrées dans des colonnes JSON/JSONB relationnelles, pas dans des fichiers JSON locaux.

### Principales entités

| Modèle Prisma                          | Table                                      | Rôle                                                                                            |
| -------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `Utilisateur`                          | `users`                                    | Client, administrateur ou utilisateur employé ; identité et état du compte                      |
| `SessionConnexion`                     | `sessions`                                 | Empreinte de session, utilisateur et expiration                                                 |
| `Vehicule`                             | `vehicles`                                 | Catalogue, gabarit, état et prix par tranche                                                    |
| `Chauffeur`                            | `drivers`                                  | Profil et disponibilité chauffeur, compétences et affectations                                  |
| `Reservation`                          | `bookings`                                 | Référence, propriétaire, véhicule, créneau, état, version et instantané JSON des données métier |
| `Course`                               | `booking_trips`                            | Étape numérotée d’une réservation, preuves et horodatages                                       |
| `Devis`                                | `devis`                                    | Historique des devis émis, montants, paramètres et nature provisoire/finale                     |
| `LigneDevis`                           | `lignes_devis`                             | Libellé, quantité, prix unitaire, montant et ordre de ligne                                     |
| `EcritureComptable`                    | `accounting_entries`                       | Revenu/charge, catégorie, date, montant et lien éventuel au devis                               |
| `ConfigurationComptable`               | `accounting_configuration`                 | Configuration comptable structurée enregistrée en base                                          |
| `ParametreApplication`                 | `settings`                                 | Tarifs, planning, données de facturation, questionnaire et paramètres métier                    |
| `BrouillonDevisAdmin`                  | `admin_quote_drafts`                       | Brouillon d’édition de devis associé à l’utilisateur                                            |
| `Itineraire`                           | `routes`                                   | Données d’itinéraire temporaires avec date d’expiration                                         |
| `PointPeage`                           | `toll_points`                              | Tarif et coordonnées des points de péage                                                        |
| `IllustrationInventaire`               | `inventory_illustrations`                  | Illustration personnalisable associée à une clé d’inventaire                                    |
| `ProfilClient`, `ClientMasque`         | `client_profiles`, `hidden_clients`        | Données consolidées/masquage d’affichage côté administration                                    |
| `ControleVehicule`, `SignalementPanne` | `vehicle_inspections`, `breakdown_reports` | Contrôles et incidents de flotte                                                                |
| `Notification`                         | `notifications`                            | Notifications destinées aux utilisateurs                                                        |
| `ConfigurationClaude`                  | `claude_configuration`                     | Configuration d’intégration Claude, clé chiffrée et modèles                                     |

Les structures JSON sont validées et mappées en code. Leur utilisation ne signifie pas que le stockage est un fichier : elles restent des colonnes d’entités PostgreSQL. Les snapshots de réservation et devis sont utiles à l’historique et à la reproductibilité des montants.

### Intégrité et historisation

- Relations, index, clés uniques et cascades sont définis dans Prisma et les migrations.
- Les lignes de devis sont ordonnées et liées à leur devis.
- Le journal associe les écritures automatiques aux devis et limite la répétition via une clé source/type unique.
- Les tarifs/paramètres figés dans un devis ne sont pas automatiquement remplacés par les tarifs ultérieurs.
- Les migrations reflètent l’évolution du schéma ; pour vérifier une base réelle, contrôler séparément la cible et l’état Prisma de cet environnement.

## 7. Configuration et secrets

Copier `backend/.env.example` vers `backend/.env` et renseigner des valeurs locales. Les clés de service ne doivent jamais être placées dans une variable `VITE_*`, commitées ou incluses dans le bundle web.

| Variable                                                     | Usage                                                                                                                          |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `NODE_ENV`                                                   | `development`, `test` ou `production`                                                                                          |
| `PORT`                                                       | Port HTTP backend, par défaut 4000                                                                                             |
| `FRONTEND_ORIGIN`                                            | Origines autorisées, séparées par des virgules ; HTTPS exigé en production par la validation actuelle                          |
| `DATABASE_URL`                                               | Connexion PostgreSQL de l’API, normalement URL Neon pooled                                                                     |
| `DATABASE_POOL_MAX`                                          | Limite de connexions du pool par instance, valeur par défaut 5                                                                 |
| `DATABASE_URL_UNPOOLED`                                      | Connexion directe de la même base/branche pour les migrations                                                                  |
| `AI_ENCRYPTION_KEY`                                          | Clé facultative pour chiffrer la clé d’intégration IA ; sans elle, la configuration actuelle dérive la clé du contexte de base |
| `OSRM_URL`                                                   | Fournisseur de calcul d’itinéraire OSRM                                                                                        |
| `NOMINATIM_URL`                                              | Fournisseur de géocodage Nominatim                                                                                             |
| `MAPS_USER_AGENT`                                            | User-Agent de requêtes cartographiques                                                                                         |
| `VITE_API_URL`                                               | Base d’API frontend ; `/api` par défaut, aucune donnée secrète                                                                 |
| `ADMIN_NAME`, `ADMIN_PHONE`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Variables ponctuelles du script de création d’administrateur                                                                   |

`DATABASE_URL` et `DATABASE_URL_UNPOOLED` doivent cibler la même base et la même branche. Ne pas recopier d’identifiants réels dans les fichiers de documentation. Voir aussi `backend/.env.example` et `frontend/.env.example`.

## 8. Sécurité et confidentialité

- Les mots de passe sont hachés avec scrypt côté backend.
- Les sessions sont conservées en base sous forme d’empreinte de jeton et utilisent un cookie HTTP-only.
- Les rôles sont contrôlés côté API ; les guards du navigateur servent à l’expérience d’usage.
- Les entrées HTTP passent par les schémas Zod et les politiques d’accès.
- Le backend configure les origines CORS et des protections de mutation/CSRF ; respecter le client et les en-têtes requis.
- Les routes d’authentification et cartographiques appliquent des limites de fréquence selon leur configuration.
- Les clés externes sont détenues côté serveur ; la configuration sensible Claude est chiffrée.
- Les devis et réservations contiennent des données personnelles : limiter les accès, ne pas inclure de dossiers réels dans des exemples ou captures.
- Les paramètres de reverse proxy et d’origines doivent être vérifiés pour chaque plateforme, surtout lorsque le nombre d’instances évolue.

Cette section décrit des mécanismes présents dans le code ; elle ne constitue pas un audit de sécurité indépendant.

## 9. Intégrations externes

| Fournisseur           | Usage                                               | Notes                                                             |
| --------------------- | --------------------------------------------------- | ----------------------------------------------------------------- |
| PostgreSQL/Neon       | Persistance métier                                  | `DATABASE_URL` côté serveur ; migrations par Prisma               |
| OSRM                  | Itinéraires routiers                                | URL configurable ; disponibilité externe nécessaire               |
| Nominatim             | Recherche et géocodage d’adresse                    | Respecter ses politiques et limites de fréquence                  |
| OpenStreetMap/Leaflet | Affichage des cartes                                | Ressources Internet nécessaires au rendu des tuiles               |
| Claude                | Fonction d’assistance configurée par l’admin        | Clé stockée chiffrée côté backend si configuration utilisée       |
| WhatsApp              | Préparation d’un partage/message depuis l’interface | L’ouverture d’un partage ne constitue pas une preuve de livraison |
| Vercel/Render         | Hébergement configuré                               | Vérifier les paramètres de chaque environnement avant déploiement |

## 10. Installation, migrations et exploitation locale

```bash
npm install
cp backend/.env.example backend/.env
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

L’application web locale est sur `http://localhost:5173`, l’API sur `http://localhost:4000`. Les applications peuvent aussi être assemblées avec `docker compose up --build` après configuration de la base ; le compose publie le frontend sur 8080.

### Évolution du schéma

1. Modifier `backend/prisma/schema.prisma`.
2. Générer une nouvelle migration sur une base/branche de développement isolée.
3. Examiner le SQL, les valeurs existantes et le chemin de retour opérationnel.
4. Appliquer `prisma migrate deploy` à la cible explicitement vérifiée.
5. Vérifier l’état `_prisma_migrations` et les colonnes sur la même cible.

Ne pas utiliser une base de production pour des essais ni modifier une migration déjà déployée.

## 11. Tests et contrôles

| Contrôle             | Commande                                                           | Portée                                                              |
| -------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Tests backend        | `npm test`                                                         | Fichiers `backend/tests/*.test.ts` au script racine                 |
| Tests frontend       | `npm test -w frontend`                                             | Fichiers `frontend/tests/*.test.ts`                                 |
| Tests d’intégration  | `ALLOW_INTEGRATION_TESTS=true npm run test:integration -w backend` | API et base dédiées ; ne pas exécuter sur prod                      |
| Types                | `npm run typecheck`                                                | Workspaces frontend et backend                                      |
| Build                | `npm run build`                                                    | Build des workspaces                                                |
| Format               | `npm run format:check`                                             | Prettier du dépôt                                                   |
| Lint                 | `npm run lint`                                                     | ESLint                                                              |
| Architecture         | `npm run check:architecture`                                       | Règles statiques du script; vérifier les résultats actuels          |
| Ressources référence | `npm run check:reference`                                          | Contrôles du dossier de référence                                   |
| Parcours navigateur  | `node --import tsx frontend/tests/browser.mjs`                     | Nécessite navigateur, application et configuration de test adaptées |

Le test d’intégration utilise une base de test explicitement autorisée. Un test ignoré ou conditionné à l’absence d’URL ne constitue pas une preuve de couverture base de données. Les tests de rendu doivent être distingués des tests métier, des tests API et du déploiement réel.

## 12. Build et déploiement

- Frontend : `frontend/Dockerfile`, `Dockerfile.vercel` et `vercel.json` décrivent les builds et routages selon plateforme.
- Backend : `backend/Dockerfile` et `render.yaml` décrivent l’image et le service backend.
- CI : `.github/workflows/full-stack-ci.yml` vérifie formatage/lint, base PostgreSQL temporaire, migrations, tests et builds.
- CI/CD : voir [ci-cd.md](ci-cd.md) pour le processus et les contrôles décrits par le dépôt.

Avant publication, vérifier les variables par environnement, l’URL de base de données, les migrations, les origines HTTPS, les domaines API, le health check, les fichiers statiques et les tests. Un build réussi ne prouve pas que le déploiement distant ou ses services externes sont accessibles.

## 13. Limites et vérifications nécessaires

- L’API de démonstration et les fournisseurs cartographiques peuvent dépendre de services publics ; leurs performances et disponibilités ne sont pas garanties par le dépôt.
- Les estimations de temps, de volume, de poids, d’équipe et de chaleur sont des heuristiques configurables.
- Les valeurs `shared/` sont des valeurs de départ, pas un export des données Neon actives.
- Les snapshots JSON en base ne sont pas des fichiers, mais leur structure doit être conservée et migrée avec soin.
- Un test unitaire ne vérifie pas que les configurations dev/prod sont identiques.
- La documentation ne constitue ni une garantie de conformité légale/comptable, ni une preuve de déploiement, ni un audit de sécurité.

## 14. Fichiers de référence utiles

| Fichier                                       | Contenu                                             |
| --------------------------------------------- | --------------------------------------------------- |
| `backend/prisma/schema.prisma`                | Modèles, relations et champs persistés              |
| `backend/src/adapters/in/http/routes.ts`      | Routes et chemins API déclarés                      |
| `backend/src/composition.ts`                  | Assemblage du backend                               |
| `shared/reference-tariff-defaults.ts`         | Tarifs de départ transport, travail et comptabilité |
| `shared/reference-assembly-price-defaults.js` | Prix client d’assemblage de référence               |
| `shared/reference-assembly-payroll-prices.js` | Coûts comptables de main-d’œuvre d’assemblage       |
| `scripts/check-architecture.mjs`              | Vérifications statiques de structure                |
| `.github/workflows/full-stack-ci.yml`         | Pipeline CI                                         |
