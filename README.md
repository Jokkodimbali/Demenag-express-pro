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

Le bouton WhatsApp **ouvre un message à envoyer manuellement**. Il ne prouve pas la livraison et ne joint pas automatiquement le PDF. Aucun SMS, email ni paiement n’est envoyé automatiquement.

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

En production, `FRONTEND_ORIGIN` doit être une origine HTTPS sans chemin ni identifiants. La limitation des requêtes reste en mémoire pour une seule instance ; un déploiement distribué nécessite un stockage partagé. Le proxy de confiance n’est pas activé implicitement. Ces protections ne remplacent pas un audit de sécurité complet.

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

Vérification du 16 octobre 2026 après séparation des couches : `npm run check` et `npm run build` réussis, 100 fichiers contrôlés et 15 tests locaux réussis. Le test d’intégration API/Prisma/Neon a été exécuté séparément avec succès. Le parcours Chrome a validé les largeurs 1 440/390/320 px, l’inscription, le brouillon, le trajet OSRM, la réservation persistée, l’accès administrateur, la confirmation, le devis final, le PDF et le suivi client. Les serveurs temporaires de vérification ont été arrêtés.
