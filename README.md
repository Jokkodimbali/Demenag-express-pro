# Demenag Express

Application web responsive de réservation de déménagement à Dakar. L’identité du prototype est conservée : anthracite, jaune, couleurs du Sénégal, logo et véhicules existants.

## Stack et organisation

- **Frontend** : React 19, TypeScript, Vite, React Router, Leaflet et jsPDF.
- **Backend** : Node.js, Express 5, TypeScript et architecture hexagonale.
- **Données** : PostgreSQL sur Neon, **Prisma 7 pour tous les accès applicatifs à la base**, Prisma Migrate pour le schéma.
- **Authentification** : téléphone et mot de passe, hachage scrypt salé, sessions révocables stockées en base et cookie HTTP-only. Aucun jeton dans localStorage.

```text
backend/
  prisma/
    schema.prisma              Modèles Prisma et relations
    migrations/                Historique des migrations Prisma
    seed.ts                    Véhicules et tarifs initiaux, sans faux clients
  src/
    domain/                    Types métier, prix, dates et transitions de statut
    application/
      ports/                   Interfaces des dépôts et des services externes
      services/                Cas d’usage : comptes, réservations, devis
    adapters/
      in/http/                 Routes Express, validation Zod, cookies et erreurs
      out/prisma/              Implémentations des dépôts avec Prisma Client
      out/security/            Hachage et génération des jetons
      out/maps/                Recherche Nominatim et itinéraires OSRM
    config/                    Variables d’environnement validées
    generated/prisma/          Client Prisma généré, ignoré par Git
    composition.ts             Injection des adaptateurs dans les cas d’usage
    main.ts                    Démarrage et arrêt de l’API
  scripts/                     Création administrateur et tests d’intégration
  tests/                       Tests métier et parcours API/Prisma/PostgreSQL
frontend/
  public/assets/               Images de l’application
  src/
    domain/                    Types et présentation des valeurs métier
    application/               Port ApplicationApi, état du compte et brouillon
    adapters/                  Client HTTP et export PDF
    components/                Carte, navigation, réservations, mot de passe
    pages/                     Accueil, connexion, compte, administration, tarifs
    styles.css                 Design et adaptations responsive
  tests/browser.mjs            Parcours Chrome sur une base de développement
```

Le domaine ne dépend ni d’Express, ni de Prisma, ni de Neon. Les cas d’usage dépendent uniquement du domaine et des interfaces dans `application/ports`. `composition.ts` assemble les implémentations concrètes. Le frontend consomme l’interface `ApplicationApi`, implémentée par l’adaptateur HTTP ; il n’accède jamais directement à Neon.

Les fichiers `Demenag Express.dc.html`, `support.js` et `assets/` à la racine sont conservés comme référence du prototype initial. Ils ne sont pas utilisés par la nouvelle application. Les documents dans `uploads/` ne sont pas publiés par Vite.

## Installation

Prérequis : **Node.js 22.12+ ou Node.js 24**, npm et PostgreSQL/Neon.

```bash
npm install
cp backend/.env.example backend/.env
npm run db:generate
```

Si `backend/.env` existe déjà, **ne pas l’écraser**. La configuration locale créée pendant le développement cible le projet Neon `demenagement`, branche `dev-web-hexagonal`. La branche `production` est distincte.

Dans `backend/.env`, renseigner :

```dotenv
NODE_ENV=development
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://USER:PASSWORD@ENDPOINT-pooler.REGION.aws.neon.tech/neondb?sslmode=verify-full
DATABASE_URL_UNPOOLED=postgresql://USER:PASSWORD@ENDPOINT.REGION.aws.neon.tech/neondb?sslmode=verify-full
```

Les deux URL doivent désigner **la même branche et la même base**. L’application utilise la connexion pooled ; Prisma Migrate utilise la connexion directe. Les certificats TLS restent vérifiés. Aucune de ces URL ne doit être placée dans une variable `VITE_*`.

Le frontend utilise `/api` ; Vite transmet les requêtes à `http://127.0.0.1:4000`. Le fichier `frontend/.env` est facultatif.

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

Ouvrir **http://localhost:5173**. En développement, `http://127.0.0.1:5173` est également autorisé. API : `http://localhost:4000/api/health`, disponibilité de la base : `/api/ready`.

Le serveur vérifie réellement le catalogue en base au démarrage. Une URL manquante, une base inaccessible ou un catalogue non initialisé empêche son lancement ; il n’existe pas de faux mode de sauvegarde locale.

## Compte administrateur

Il n’existe pas de compte ni de mot de passe codé en dur.

Pour créer un administrateur sur une nouvelle base, renseigner localement dans `backend/.env` :

```dotenv
ADMIN_NAME=Administrateur
ADMIN_PHONE=77XXXXXXXX
ADMIN_PASSWORD=un-mot-de-passe-long-et-unique
```

```bash
npm run admin:create
```

Le script refuse d’écraser un compte existant ou d’en modifier le rôle. Le formulaire d’inscription public crée exclusivement des comptes clients.

Dans la configuration locale préparée pour ce projet, le compte **77 141 12 51** a été créé sur la branche de développement. Son mot de passe initial aléatoire se trouve dans `backend/.env`, variable `ADMIN_PASSWORD` ; il n’est pas exposé dans le code frontend, les logs ou ce README.

Se connecter à `/connexion`, puis ouvrir **Administration → Tarifs et paramètres → Modifier mon mot de passe**. Après changement, supprimer `ADMIN_PASSWORD` du fichier `.env`. Modifier seulement cette variable ne change pas le mot de passe d’un compte déjà créé.

## Parcours disponibles

### Client

1. Choisir le véhicule ; les dimensions et tarifs proviennent de l’API.
2. Rechercher les adresses avec les boutons de recherche, ou placer A et B sur la carte.
3. Calculer le trajet. OSRM calcule la distance routière côté serveur ; le navigateur reçoit un identifiant d’itinéraire valable 30 minutes.
4. Choisir une date, un créneau et les services complémentaires.
5. Se connecter ou créer un compte. Le brouillon est conservé pendant cette navigation dans l’application, **pas après un rechargement complet**.
6. Envoyer la demande et la retrouver dans `/mon-espace`, y compris depuis un autre appareil après connexion.
7. Consulter le statut, télécharger les devis et annuler une demande encore en attente ou confirmée.

Le tarif reçu du navigateur n’est jamais accepté : le backend récupère la distance et les tarifs et calcule le montant. Un changement d’adresse invalide les anciens points et l’estimation. Au-delà de la dernière borne configurée (35 km initialement), le montant reste `null`, affiché « Sur devis », jusqu’à définition du prix personnalisé.

### Administration

- Lister, rechercher et filtrer les 200 dernières réservations.
- Confirmer un créneau ou annuler une demande.
- Démarrer une prestation confirmée.
- Créer des devis provisoires et finaliser un devis après démarrage.
- Télécharger les PDF et préparer un message WhatsApp.
- Modifier les tarifs, les bornes kilométriques et le téléphone de l’entreprise.
- Gérer les fiches véhicules et leur disponibilité.
- Créer et modifier les comptes, attribuer les rôles et suspendre les accès.
- Configurer l’ouverture des réservations, les créneaux, les préavis, les quantités et l’annulation client.

Transitions : `pending → confirmed → in_progress → completed`. Une demande `pending` ou `confirmed` peut passer à `cancelled`. La clôture nécessite un devis final dont le prix est connu. Un devis final ne peut pas être modifié ; les devis successifs restent dans l’historique.

La première version considère **un véhicule par modèle et par créneau**. Un index unique partiel PostgreSQL empêche de confirmer deux réservations du même véhicule au même créneau, même en cas de requêtes simultanées. Les demandes en attente ne bloquent pas le créneau. La disponibilité est donc confirmée par l’équipe, et non garantie lors de l’envoi d’une demande.

Les prix du transport du véhicule sont copiés dans la réservation. Chaque devis conserve ses lignes, prix unitaires, remises et total lors de son enregistrement. Son affichage et le PDF utilisent cet instantané, sans recalcul avec les nouveaux tarifs. Les nouvelles réservations figent également les tarifs des services et les bornes de distance ; leurs devis réutilisent cet instantané. Les anciennes réservations sans instantané des paramètres utilisent les paramètres disponibles lors de la création du devis.

Le partage d’un devis génère son PDF puis propose le partage du fichier et du message avec les outils disponibles sur l’appareil. Si le navigateur ne permet pas le partage de fichier, le PDF est téléchargé et WhatsApp s’ouvre avec un message indiquant de joindre le fichier. L’envoi reste à valider par l’administrateur ; il ne prouve pas la livraison. Aucun SMS, email ni paiement n’est envoyé automatiquement.

## Endpoints

| Méthode   | Chemin `/api`                   | Accès                                         |
| --------- | ------------------------------- | --------------------------------------------- |
| GET       | `/health`, `/ready`             | Public                                        |
| GET       | `/catalogue`                    | Public                                        |
| POST      | `/auth/register`, `/auth/login` | Public, limité en fréquence                   |
| GET       | `/auth/me`                      | Session courante ou `null`                    |
| POST      | `/auth/logout`                  | Session courante                              |
| POST      | `/auth/password`                | Connecté, mot de passe actuel obligatoire     |
| GET       | `/maps/search?q=...`            | Public, limité en fréquence                   |
| POST      | `/maps/route`                   | Public, limité en fréquence                   |
| POST      | `/estimates`                    | Public                                        |
| GET, POST | `/bookings`                     | Connecté ; lecture limitée à ses réservations |
| GET       | `/bookings/:id`                 | Propriétaire ou administrateur                |
| PATCH     | `/bookings/:id/status`          | Droits et transitions vérifiés côté serveur   |
| POST      | `/bookings/:id/quotes`          | Administrateur                                |
| PUT       | `/catalogue`                    | Administrateur                                |

Les mutations attendent `X-Requested-With: DemenagExpress` et une origine autorisée lorsqu’un en-tête `Origin` est présent. Les sessions sont révocables ; le changement de mot de passe invalide toutes les anciennes sessions et crée une nouvelle session courante. Les mises à jour des réservations utilisent `version` pour refuser l’écrasement d’une modification concurrente.

## Prisma et migrations

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:studio -w backend
```

Les requêtes sont réparties par dépôt dans `backend/src/adapters/out/prisma/` (`users.ts`, `sessions.ts`, `catalogue.ts`, `bookings.ts`, `routes.ts`, `administration.ts`) : `findUnique`, `findMany`, `create`, `upsert`, `updateMany`, `deleteMany`, `$transaction`. Aucun SQL applicatif direct ni dépôt `pg` parallèle.

Les fichiers SQL dans `backend/prisma/migrations/` sont les migrations de schéma de **Prisma Migrate**, pas une seconde couche d’accès aux données. L’index partiel de disponibilité et les contraintes de tarifs positifs sont ajoutés dans la migration initiale.

Pour faire évoluer le schéma : modifier `schema.prisma`, créer une nouvelle migration sur une branche de développement, vérifier les données et appliquer avec `prisma migrate deploy`. Ne pas modifier une migration déjà appliquée et ne pas utiliser `db push` pour remplacer l’historique.

Documentation : [Prisma Client](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/generating-prisma-client), [configuration Prisma](https://www.prisma.io/docs/orm/v7/reference/prisma-config-reference), [connexions Neon](https://neon.com/docs/connect/connection-pooling).

## Vérifications

```bash
npm test
npm run typecheck
npm run build
```

Les tests métier couvrent les tranches de distance, les montants, les quantités invalides, les dates/créneaux, les transitions, les téléphones et le hachage des mots de passe.

Le test d’intégration est ignoré si `TEST_DATABASE_URL` est absent. Pour l’exécuter, utiliser **une branche dédiée aux tests**, jamais une base de production : il modifie temporairement les tarifs et crée des comptes avant nettoyage.

```bash
ALLOW_INTEGRATION_TESTS=true npm run test:integration -w backend
```

Le lanceur utilise `TEST_DATABASE_URL` si elle est définie, sinon la `DATABASE_URL` locale. Il vérifie les cookies, les contrôles d’accès, l’anti-CSRF, l’idempotence, les conflits de créneaux, la concurrence, les devis figés et la révocation des sessions. Le fournisseur de trajet de ce test est déterministe : il ne vérifie pas OSRM.

Le test navigateur nécessite l’application démarrée, Chrome installé et un compte administrateur configuré dans `.env` :

```bash
node --import tsx frontend/tests/browser.mjs
```

Il utilise une réservation temporaire sur la branche de développement, le vrai calcul OSRM et le compte administrateur configuré, puis nettoie les données créées. Il enregistre les captures et les PDF dans `.verification/` (ignoré par Git).

## Build et hébergement

```bash
npm run build
npm run start -w backend
```

- Frontend compilé : `frontend/dist`, à servir avec repli SPA vers `index.html` pour `/connexion`, `/mon-espace` et `/admin`.
- Backend compilé : `backend/dist/main.js`.
- Configurer `NODE_ENV=production`, le domaine dans `FRONTEND_ORIGIN` et les URL Neon correspondant à l’environnement cible.
- Servir le frontend et `/api` sous la même origine HTTPS à l’aide d’un reverse proxy ; le cookie passe alors en mode `Secure`.
- Ne jamais publier `.env`, les documents de `uploads/` ni le prototype de démonstration avec ses anciens identifiants.
- Appliquer les migrations et le seed au moment du déploiement, puis créer l’administrateur de l’environnement cible.

## Limites de cette première version

- Pas encore de paiement, SMS/OTP, récupération de mot de passe par SMS/email, affectation de chauffeurs, gestion de plusieurs véhicules physiques par modèle, pièces jointes ou import de l’ancien `localStorage`.
- Le numéro sert d’identifiant ; la possession du téléphone n’est pas encore vérifiée par OTP.
- Les cartes, la recherche, les itinéraires et les polices nécessitent Internet. La recherche Nominatim est explicitement déclenchée, limitée et mise en cache ; les services cartographiques publics doivent être remplacés par des fournisseurs adaptés avant un trafic soutenu. Aucun faux trajet à vol d’oiseau n’est utilisé en cas d’échec.
- Le cache de recherche et les limites de fréquence sont en mémoire, adaptés à une seule instance. Prévoir un stockage partagé et configurer explicitement le proxy de confiance avant une mise à l’échelle.
- Les listes sont limitées aux 200 dernières réservations ; pagination et recherche serveur à ajouter pour un volume supérieur.
- Les PDF utilisent les polices standard de jsPDF et la structure de la nouvelle application ; ils ne sont pas une reproduction pixel à pixel du prototype.
- L’application est préparée et testée en développement ; aucun hébergement public n’est effectué automatiquement.

### Vérifications du parcours initial (avant la refactorisation)

- Schéma Prisma validé et migration appliquée sur `dev-web-hexagonal` ; catalogue initialisé.
- Build de production et vérification TypeScript : réussis pour les deux applications.
- 10 tests métier réussis ; parcours d’intégration API/Prisma/Neon réussi séparément, incluant la révocation des sessions après changement de mot de passe.
- Parcours Chrome réussi : inscription, conservation du brouillon pendant la connexion, itinéraire OSRM réel, réservation persistante après rechargement, confirmation et démarrage administrateur, devis final, suivi client, PDF, modification de mot de passe et reconnexion.
- Affichage vérifié à 1 440, 390 et 320 px ; aucun débordement horizontal sur les vues contrôlées. Captures inspectées pour l’accueil, l’administration et les paramètres mobiles.
- Carte : tuiles OpenStreetMap chargées avec réponses HTTP 200. PDF final : A4, montant et informations de la réservation vérifiés.
- Les comptes clients et réservations de test sont nettoyés. Aucun test de charge, audit de sécurité exhaustif ou déploiement public n’a été réalisé.

## Organisation et règles de maintenance

- `shared/contracts.d.ts` : types communs, sans dépendance d’exécution ni accès à la base. Le domaine et le frontend les réexportent pour conserver leurs points d’import.
- `backend/src/adapters/in/http/` : routes séparées pour authentification, réservations, cartographie et administration ; contrôle d’accès et traitement des erreurs isolés. `app.ts` compose le serveur.
- `backend/src/adapters/out/prisma/` : un adaptateur par interface de persistance. Les correspondances français/contrat HTTP restent dans `mapping.ts`.
- `frontend/src/application/useBookingForm.ts` : coordination du formulaire, chargement de l’estimation et soumission. `pages/Home.tsx` compose les vues.
- `frontend/src/components/booking/` : véhicule, date/options, coordonnées et estimation. `components/settings/` : transport, services/contact et règles.
- `frontend/src/components/Modal.tsx` : fenêtre native réutilisée pour comptes et véhicules, avec gestion du focus et de la touche Échap.
- `frontend/src/styles/` : styles thématiques ; `styles.css` fixe leur ordre de chargement pour préserver la cascade.

Les modèles, champs et valeurs d’énumération Prisma sont en français. `@map` et `@@map` préservent les noms physiques des tables et colonnes historiques. `Devis` et `LigneDevis` structurent les documents émis ; le JSON des réservations reste un instantané métier conservé volontairement.

Appliquer SRP par fonctionnalité, injecter les dépendances via les ports, partager les types et composants réellement communs, et préférer des fonctions simples aux abstractions anticipées. Ne pas modifier un devis émis pour répercuter un changement de tarif.

```bash
npm run check                # Format, lint, architecture, types, tests métier
npm run check:architecture   # Taille des fichiers et frontières entre couches
npm run build               # Compilation des deux applications
```

Le contrôle d’architecture refuse les fichiers de code de plus de 1 000 lignes dans les sources maintenues, ainsi que les imports d’infrastructure dans le métier. Il ne prouve pas à lui seul le respect de tous les principes SOLID : la cohésion et la pertinence des abstractions restent à examiner en revue. Le client Prisma généré et le prototype HTML/runtime archivés sont exclus ; ils ne sont pas les sources de la nouvelle application.

### Vérification après refactorisation — 15 octobre 2026

- `npm run check` réussi : format, lint sans avertissement, frontières d’architecture, TypeScript et 10 tests métier.
- Build backend/frontend réussi ; 70 fichiers contrôlés. Le plus long fichier maintenu compte 693 lignes de CSS ; le plus long composant React compte 323 lignes.
- Test API/Prisma/Neon réussi, avec paramètres de test déterministes puis restauration : droits, suspension de compte, règles configurables, devis structurés et sessions.
- Parcours Chrome réussi après extraction : inscription, itinéraire routier réel, réservation, confirmation administrateur, devis final, PDF et reconnexion. Absence de débordement horizontal vérifiée à 1 440, 390 et 320 px. Cela ne constitue pas une comparaison pixel à pixel avec le prototype.
- Le test navigateur accepte `BROWSER_BASE_URL` pour utiliser une instance locale distincte. Ses clics sur la carte sont relatifs à sa taille.

# Demenag-express-pro

# Demenag-express-pro

## Textes, configuration et contrôles d’accès

- `frontend/src/content/fr.ts` centralise les textes de l’interface, les libellés accessibles, les messages du client HTTP et les modèles de texte des PDF. Les messages dynamiques sont des fonctions typées.
- `backend/src/domain/messages/fr.ts` centralise les messages métier et les erreurs renvoyées par l’API. Les noms de véhicules, tarifs et paramètres gérés en base restent des données métier, pas des traductions.
- `frontend/src/config/` contient les paramètres de formatage et de cartographie. Les identifiants techniques, chemins d’import et classes CSS restent dans le code : ils ne sont pas des textes à traduire.
- `frontend/src/routing/` sépare l’arbre de navigation de la garde d’accès. La garde améliore la navigation ; l’autorisation effective reste sur le serveur.
- `backend/src/config/security.ts` regroupe cookie de session, taille des requêtes, en-tête CSRF et limites de fréquence. `security-middleware.ts` applique CORS, Helmet, absence de cache et protection des mutations.
- `backend/src/domain/policies/access.ts` porte les règles de compte actif, d’administrateur et de lecture des réservations. Elles sont réutilisées dans les cas d’usage. La modification du catalogue passe également par un service avec autorisation.
- `actor.ts` valide l’identité placée dans le contexte HTTP et `session-cookie.ts` contrôle le type du cookie avant utilisation. Les corps des requêtes passent par les schémas Zod.
- `error-handler.ts` produit des erreurs contrôlées, y compris pour un corps trop volumineux. Les réponses ne contiennent pas de pile d’exécution.

TypeScript fonctionne en mode strict. Le lint interdit `any` explicite et les contournements TypeScript non justifiés. Le contrôle d’architecture refuse également les `any`, les textes JSX directs et les attributs accessibles non centralisés. Les types internes des dépendances et le client Prisma généré ne sont pas réécrits. Les réponses JSON externes sont reçues comme `unknown` avant utilisation des messages d’erreur ; les contrats de succès HTTP restent des types partagés, pas une validation complète de chaque réponse côté navigateur.

La vérification TypeScript couvre aussi les tests, les scripts et le seed du backend (`tsconfig.check.json`). Les tests HTTP de sécurité ouvrent uniquement un serveur local éphémère et ne nécessitent pas Neon. Ils vérifient notamment les rôles, comptes inactifs, origines refusées, l’en-tête CSRF, les en-têtes de sécurité et la limitation des requêtes.

En production, `FRONTEND_ORIGIN` accepte une liste d’origines HTTPS séparées par des virgules, sans chemin ni identifiants. Chaque origine doit être explicitement déclarée ; les autres sont refusées par CORS et la protection CSRF. Express fait confiance à un seul proxy en amont pour lire les informations transmises par Render ou Vercel. La limitation des requêtes reste en mémoire pour une seule instance ; un déploiement distribué nécessite un stockage partagé. Ces protections ne remplacent pas un audit de sécurité complet.

### Vérification des textes et accès — 16 octobre 2026

Le lint analyse désormais les types des sources : affectations, appels, retours, arguments et accès aux membres issus d’un `any` implicite sont refusés. `VITE_API_URL` possède une déclaration explicite dans `frontend/src/types/vite-env.d.ts`.

Douze tests métier/HTTP de sécurité ont réussi, ainsi que le parcours d’intégration Neon séparé et le parcours navigateur avec les textes centralisés. Les scénarios vérifiés couvrent les accès client/administrateur, la suspension de compte, les règles de réservation, les devis, les sessions et les vues responsive.

### Séparation des responsabilités

Les routes HTTP dépendent des interfaces `application/ports/use-cases.ts`. Elles valident les entrées, identifient l’acteur et traduisent la réponse ; les services exécutent les cas d’usage et les règles du domaine. Les dépôts Prisma assurent les requêtes et les transactions. Les règles de modification des administrateurs sont évaluées par le service dans une transaction sérialisable, avec nouvelle vérification des droits et révocation des sessions si nécessaire.

Dans le navigateur, les pages rendent les vues et les hooks de `application/controllers` gèrent les interactions, chargements et erreurs. Les composants de réservation utilisent un contrat de présentation explicite, indépendant du type de retour du hook. Les ports d’accès distant sont répartis par capacité (authentification, utilisateurs, catalogue, réservations, cartographie et estimation). Le navigateur communique avec l’API, jamais directement avec Neon. L’export PDF est injecté au démarrage et chargé à la demande. Les règles de tarification et d’autorisation restent vérifiées côté serveur.

Les contrôles automatiques interdisent aussi les imports des services concrets dans les contrôleurs HTTP, les imports des adaptateurs dans l’application frontend, et les appels API dans les pages et composants. Les effets Leaflet restent dans le contrôleur de carte, car ils pilotent le widget ; ils ne constituent pas des règles métier. Les tests du service administrateur utilisent des dépôts en mémoire, sans Prisma ni connexion à une base.

### Routes, validation et domaine

Les chemins du navigateur sont réunis dans `frontend/src/routing/routes.ts`. Les chemins HTTP du serveur sont réunis dans `backend/src/adapters/in/http/routes.ts`, tandis que l’adaptateur HTTP du navigateur utilise son propre registre relatif dans `frontend/src/adapters/http-routes.ts`. Les routes ne portent aucune règle métier.

Les validateurs de requêtes HTTP sont regroupés sous `backend/src/adapters/in/http/validation/` et les convertisseurs des formulaires frontend sous `frontend/src/application/validation/`. Les contraintes de réservation, de tarification, de transition et d’accès restent dans le domaine et les services : la validation de formulaire ne les remplace jamais.

Le catalogue Neon est l’agrégat de configuration de l’application : véhicules, tarifs, créneaux avec heure de début, téléphone et limites de réservation sont chargés depuis la base. Les contrats exigent maintenant ces paramètres au lieu de leur attribuer des valeurs de secours dans les cas d’usage. Le script de seed ne crée que le catalogue initial, sans compte ni client fictif ; l’administrateur peut ensuite le modifier depuis son espace. La migration `202610160003_creneaux_configurables` convertit les créneaux existants vers ce modèle.

L’administration comprend un planning mensuel interactif alimenté par les réservations et deux indicateurs de chiffre d’affaires calculés à partir des devis provisoires et définitifs enregistrés. L’onglet « Devis et factures » ouvre les dossiers en cours ou finalisés ; la création d’un devis accepte les montants de transport, remises et lignes de charges supplémentaires. Les lignes sont figées avec le devis final.

Les migrations `202610160004_chauffeurs` et `202610160005_facture_personnalisee` ajoutent les chauffeurs affectables aux véhicules et les paramètres de facture. Les images de véhicules et le logo de facture peuvent être téléversés depuis l’administration ; ils sont conservés dans les données applicatives après validation de type et de taille. Retirer un véhicule sans historique le supprime ; s’il possède des réservations, il est désactivé afin de préserver les devis et réservations passés.

Vérification du 16 octobre 2026 après séparation des couches : `npm run check` et `npm run build` réussis, 100 fichiers contrôlés et 15 tests locaux réussis. Le test d’intégration API/Prisma/Neon a été exécuté séparément avec succès. Le parcours Chrome a validé les largeurs 1 440/390/320 px, l’inscription, le brouillon, le trajet OSRM, la réservation persistée, l’accès administrateur, la confirmation, le devis final, le PDF et le suivi client. Les serveurs temporaires de vérification ont été arrêtés.

## Erreur Render : `npm run dev` et mémoire 512 Mio

Si les journaux Render indiquent `Running 'npm run dev'`, le service est configuré en **runtime Node avec une commande de démarrage de développement**. Cette commande démarre simultanément Vite, le serveur backend en mode watch et `prisma generate` ; elle ne doit pas servir l’application en production. Le fichier `render.yaml` ne modifie un service existant que si ce service est géré et synchronisé par un Blueprint Render. Un build réussi du frontend dans ces journaux ne signifie donc pas que Render utilise le Dockerfile backend.

Pour corriger **le service existant** dans Render, choisir l’une de ces configurations :

- **Docker recommandé** : dans les paramètres du service, passer le runtime à Docker, garder le répertoire racine du dépôt, sélectionner `backend/Dockerfile` et le contexte Docker `.`. Ne pas définir `npm run dev` comme Docker Command ; l’image lance `node dist/main.js`. Si le service est déjà géré par un Blueprint, synchroniser `render.yaml`, qui fixe explicitement cette commande.
- **Runtime Node** : garder le répertoire racine du dépôt ; Build Command : `npm ci && npm run build:backend` ; Start Command : `npm start` ; Pre-Deploy Command : `npm run db:migrate -w backend`. Cette option compile Prisma avant le démarrage et ne lance que l’API.

Dans les deux cas, configurer `NODE_ENV=production`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED` et `FRONTEND_ORIGIN` dans les variables Render. Vérifier que `PORT` n’est pas forcé à `5173` et que le Health Check Path vaut `/api/ready`. Après modification, redéployer et chercher `API Demenag Express` dans les journaux ; Vite ne doit plus y apparaître. Le backend exige aussi un catalogue initialisé dans la base ciblée. Si Render affiche encore une erreur de mémoire après ce démarrage seul, mesurer la consommation de l’API avant de choisir une instance plus grande.

## Conteneurs Docker et déploiement Render / Vercel

Le dépôt est un monorepo npm. Les deux Dockerfiles se construisent **depuis la racine du dépôt** afin de disposer de `package-lock.json` et des workspaces :

```bash
docker build -f backend/Dockerfile -t demenag-backend .
docker build -f frontend/Dockerfile -t demenag-frontend .
```

L’image backend compile TypeScript et génère le client Prisma. L’image frontend compile Vite puis sert `dist/` avec Nginx ; elle relaie `/api/` vers le service Docker nommé `backend`. Le rechargement direct d’une page React Router est servi par `index.html`. Les fichiers `.env`, les dépendances locales et les fichiers de test ne sont pas envoyés dans le contexte Docker. Les images n’intègrent aucun mot de passe ni URL de base de données.

Pour exécuter les deux conteneurs localement, conserver un `backend/.env` renseigné, puis appliquer les migrations et le seed **sur la base choisie** avant le lancement :

```bash
npm run db:migrate
npm run db:seed
docker compose up --build
```

Ouvrir `http://localhost:8080`. Le backend est aussi accessible sur `http://localhost:4000`. Compose force `FRONTEND_ORIGIN=http://localhost:8080`, car Nginx et l’API sont publiés sous cette origine. `docker compose config` permet de contrôler la configuration ; sa sortie peut contenir les valeurs de `backend/.env` et ne doit pas être partagée.

### Backend sur Render

Le fichier `render.yaml` crée un service web Docker depuis `backend/Dockerfile`, avec un contrôle de santé sur `/api/ready`. Render utilisera le `PORT` qu’il fournit ; le backend le lit déjà à l’exécution. Avant chaque mise en ligne, `preDeployCommand` exécute les migrations Prisma avec la connexion directe. Le démarrage échoue si la base ou son catalogue initial est indisponible.

1. Créer une branche/base PostgreSQL dédiée à la production. Récupérer son URL **pooled** pour `DATABASE_URL` et son URL **directe** pour `DATABASE_URL_UNPOOLED` ; les deux doivent désigner la même base et garder `sslmode=verify-full`.
2. Créer un Blueprint Render à partir de `render.yaml`. Renseigner dans Render les valeurs demandées pour `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `FRONTEND_ORIGIN` et `MAPS_USER_AGENT`. `FRONTEND_ORIGIN` accepte une ou plusieurs origines HTTPS séparées par des virgules, sans chemin ni slash final. Ne pas mettre ces secrets dans Git.
3. Après la première migration, initialiser le catalogue sur cette base avec `npm run db:seed -w backend` depuis un environnement d’administration configuré avec les mêmes URL. Le seed est prévu pour être relancé, mais ne le faire qu’après avoir vérifié sa cible. Créer ensuite le premier administrateur avec `npm run admin:create -w backend` et les variables `ADMIN_NAME`, `ADMIN_PHONE`, `ADMIN_PASSWORD` définies temporairement dans cet environnement. Retirer le mot de passe de la configuration après création. Ne pas lancer ces opérations de données automatiquement à chaque déploiement.
4. Vérifier `https://<service>.onrender.com/api/ready` (HTTP 200) et `/api/catalogue`. Le premier déploiement peut ne pas atteindre l’état prêt avant l’initialisation du catalogue ; dans ce cas, réaliser l’étape 3 puis redéployer.

### Frontend Vercel et backend Render

Le fichier `vercel.json` construit le frontend Vite depuis `frontend/` et sert `frontend/dist`. Les routes `/api` et `/api/*` sont réécrites vers `https://api.demenagexpresspro.com`, puis les autres routes sont servies par l’application React. Le navigateur continue d’appeler `/api` sur son propre domaine Vercel : le proxy transmet aussi les cookies de session HTTP-only.

Dans Render, définir `FRONTEND_ORIGIN=https://demenag-express-pro.vercel.app,https://www.demenagexpresspro.com`. Ces deux origines exactes sont vérifiées par CORS et la protection CSRF ; les origines inconnues sont refusées. Vercel transmet les requêtes `/api` au backend et Express fait confiance au proxy en amont. Après changement, redéployer le backend Render. Vercel n’a besoin d’aucune URL de base de données ni de secret backend ; laisser `VITE_API_URL` absent ou égal à `/api`.

### Vérifications CI avant mise en production

Le workflow GitHub Actions unique [`Full Stack CI`](.github/workflows/full-stack-ci.yml) contrôle le backend et le frontend dans le même pipeline, dont les migrations et tests backend sur PostgreSQL temporaire, les vérifications frontend et les deux builds. Les étapes pour exiger ce contrôle avant la production sur Render et Vercel sont décrites dans [docs/ci-cd.md](docs/ci-cd.md). Le workflow n’a besoin d’aucun secret de production.

Après déploiement, vérifier `https://api.demenagexpresspro.com/api/ready` et `/api/catalogue`, puis `https://demenag-express-pro.vercel.app/api/ready`, `/connexion` et `/api/auth/me`. Les avertissements du navigateur concernant certaines directives `Permissions-Policy` ne sont pas la cause d’un `403` de connexion ; inspecter le corps JSON de la réponse si le problème persiste. Le backend ne crée pas automatiquement le premier administrateur : initialiser le catalogue et créer le compte sur la base de production comme indiqué plus haut.

Les services publics OSRM et Nominatim ont des limites d’utilisation : configurer `OSRM_URL`, `NOMINATIM_URL` et `MAPS_USER_AGENT` dans Render si le trafic devient soutenu. Les notifications sont actuellement diffusées en mémoire du processus : avec plusieurs instances Render, les événements ne seront pas partagés entre instances sans transport commun.
