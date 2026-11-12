# Architecture de Demenag Express

Ce document décrit l’organisation actuellement présente dans le dépôt. Les règles d’architecture sont des conventions de travail ; elles ne signifient pas que chaque fichier actuel est parfaitement conforme. Le script `scripts/check-architecture.mjs` contient les contrôles automatisés effectivement configurés.

## Vue d’ensemble

```text
Navigateur
  └─ frontend React (modules fonctionnels)
       └─ port ApplicationApi / adaptateur HTTP
            └─ API Express + validation Zod
                 └─ services applicatifs
                      ├─ domaine métier pur
                      └─ ports (dépôts, routage, notifications)
                           └─ adaptateurs Prisma, cartographie, sécurité
                                └─ PostgreSQL (schéma demenag)
```

Le frontend ne se connecte pas directement à la base. L’API contrôle l’identité, l’accès, les entrées et les transitions métier, puis les adaptateurs de sortie assurent les échanges avec PostgreSQL et les fournisseurs externes.

## Frontend

### Modules fonctionnels

Les pages, composants et services d’une fonctionnalité doivent être rangés dans le module qui en porte la responsabilité. Les noms ci-dessous décrivent l’intention fonctionnelle observée dans les routes et les fichiers.

| Module                          | Responsabilité principale                                                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `modules/app`                   | Entrée de l’application, routes React, types d’application et styles globaux                                               |
| `modules/public-home`           | Page publique d’accueil                                                                                                    |
| `modules/auth`                  | Connexion, inscription client, validation et présentation de l’authentification                                            |
| `modules/booking`               | Parcours de réservation côté client, inventaire d’appel, coordonnées, calendrier et récapitulatif                          |
| `modules/account`               | Espace personnel et réservations du client                                                                                 |
| `modules/catalogue`             | Accès et présentation du catalogue de véhicules et de paramètres publics                                                   |
| `modules/moving`                | Domaine transversal du déménagement : estimation, inventaire, itinéraires, cartes, péages, capacité et tarifs de référence |
| `modules/driver`                | Espace chauffeur, profil, disponibilité, inspections, signalements et courses                                              |
| `modules/admin/dashboard`       | Tableau de bord et liste de réservations d’administration                                                                  |
| `modules/admin/quotes`          | Création, prévisualisation, sauvegarde et PDF des devis administratifs                                                     |
| `modules/admin/clients`         | Recherche et gestion des clients                                                                                           |
| `modules/admin/planning`        | Calendrier, équipe et suivi des missions                                                                                   |
| `modules/admin/accounting`      | Journal, projection comptable, documents et présentation des résultats                                                     |
| `modules/admin/finance`         | Vue financière et scénarios de financement                                                                                 |
| `modules/admin/fleet`           | Parc véhicules et capacité                                                                                                 |
| `modules/admin/tolls`           | Référentiel des péages                                                                                                     |
| `modules/admin/settings`        | Paramètres commerciaux et applicatifs                                                                                      |
| `modules/admin/users`           | Comptes et accès employés                                                                                                  |
| `modules/admin/vehicle-reports` | Rapports, inspections et anomalies véhicule                                                                                |
| `modules/admin/announcements`   | Annonces et notifications d’administration                                                                                 |
| `modules/admin/data`            | Opérations de données d’administration                                                                                     |
| `modules/admin/shell`           | Coquille de l’espace d’administration et navigation                                                                        |
| `modules/shared`                | Fonctions, modèles, messages, feedback, navigation et composants partagés                                                  |

`modules/admin/application` contient également des éléments transversaux actuellement partagés par l’administration. `modules/moving` est partagé par les parcours booking et devis afin d’éviter deux implémentations de règles de déménagement.

### Couches d’un module

| Couche        | Contenu attendu                                                  | Dépendances attendues                                   |
| ------------- | ---------------------------------------------------------------- | ------------------------------------------------------- |
| `domain`      | Modèles métier, calculs déterministes, règles sans I/O           | Domaine partagé uniquement                              |
| `application` | Services de cas d’usage, orchestration, ports et modèles de page | Domaine, contrats et ports ; pas d’adaptateur concret   |
| `adapters`    | HTTP, PDF, stockage ou intégration d’une API concrète            | Ports/application et bibliothèques externes             |
| `components`  | Composants visuels spécialisés                                   | Propriétés, messages et services d’application injectés |
| `pages`       | Assemblage d’écran, navigation et état local de présentation     | Composants et modèles d’application                     |
| `styles`      | Styles encapsulés au module                                      | Aucun calcul métier                                     |
| `content`     | Textes visibles et contenus de présentation                      | Pas de dépendance d’infrastructure                      |

Toutes les fonctionnalités n’ont pas nécessairement chacune de ces sous-couches. L’organisation réelle varie par module ; il ne faut pas créer des dossiers vides uniquement pour faire correspondre une convention.

### Démarrage et navigation

- `frontend/src/modules/app/main.tsx` monte l’application.
- `modules/app/routing/AppRoutes.tsx` assemble les routes et charge les écrans administratifs et chauffeur à la demande.
- `modules/app/routing/Guard.tsx` applique les restrictions d’accès de navigation côté client. L’API reste responsable de l’autorisation réelle.
- `modules/shared/navigation/config/routes.ts` centralise les chemins utilisés dans les liens.
- `modules/shared/shell` porte la structure générale, tandis que `modules/admin/shell` porte la navigation d’administration.

### Flux de l’interface vers l’API

1. Une page ou un contrôleur appelle un service d’application.
2. Le service dépend d’un contrat/port, plutôt que de coder une URL ou une bibliothèque réseau dans la vue.
3. L’adaptateur HTTP de `modules/app` ou d’un module traduit le contrat vers `/api`.
4. Le backend répond avec des données typées et la vue les présente.

Les composants visuels ne doivent pas appeler `fetch`, `api.*` ou un adaptateur directement. Les contrôleurs coordonnent l’état d’écran et les effets ; les règles métier réutilisables restent dans les services ou le domaine. Ce principe est vérifié partiellement par `scripts/check-architecture.mjs`.

## Backend

Le backend suit une architecture hexagonale avec un domaine interne, des cas d’usage, des ports et des adaptateurs.

| Emplacement                               | Rôle                                                                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `backend/src/domain/`                     | Règles pures pour moving, pricing, inventory, accounting, fleet, identity et sécurité                                          |
| `backend/src/application/ports/`          | Contrats des dépôts et fournisseurs utilisés par les cas d’usage                                                               |
| `backend/src/application/services/`       | Cas d’usage groupés par comptabilité, administration, catalogue, flotte, identité, intégrations, déménagement et notifications |
| `backend/src/adapters/in/http/`           | Routes Express, validation Zod, identité de l’acteur, accès et traduction des erreurs HTTP                                     |
| `backend/src/adapters/out/prisma/`        | Dépôts PostgreSQL, requêtes Prisma et mappage entre modèle persistant et modèle métier                                         |
| `backend/src/adapters/out/maps/`          | Fournisseurs d’itinéraires et de géocodage                                                                                     |
| `backend/src/adapters/out/notifications/` | Adaptation des notifications et actualisation temps réel                                                                       |
| `backend/src/adapters/out/security/`      | Hachage, sessions, jetons et chiffrement                                                                                       |
| `backend/src/config/`                     | Lecture et validation des variables d’environnement                                                                            |
| `backend/src/composition.ts`              | Instanciation des adaptateurs et injection dans les services                                                                   |
| `backend/src/main.ts`                     | Démarrage de l’API, configuration HTTP et arrêt propre                                                                         |

### Cycle d’une requête

1. `main.ts` crée les ressources d’infrastructure et appelle `compose`.
2. `composition.ts` assemble les services avec les adaptateurs concrets via leurs interfaces.
3. Une route HTTP authentifie l’acteur, valide les paramètres et le corps avec Zod, puis appelle un service.
4. Le service exécute la règle d’application et délègue la persistance ou l’intégration à un port.
5. L’adaptateur de sortie convertit les modèles métier vers Prisma ou un fournisseur externe.
6. La route transforme le résultat en réponse HTTP.

Une route ne doit pas importer directement un dépôt Prisma. Le domaine et l’application ne doivent pas dépendre d’Express, Prisma, `generated/` ou de fournisseurs externes.

## Contrats partagés

Le dossier `shared/` contient les contrats TypeScript et valeurs initiales consommés des deux côtés, notamment les tarifs de référence et les prix de montage/comptabilité. Les valeurs partagées sont des valeurs par défaut ; les paramètres persistés en base restent la configuration active. Les modifications de formats partagés doivent être vérifiées dans les builds des deux workspaces.

## Règles de dépendance

| Depuis                       | Peut dépendre de                                         | Ne doit pas dépendre de                                                                        |
| ---------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Domaine frontend/backend     | Contrats et autres règles de domaine                     | UI, HTTP, Prisma, généré, environnement ou service concret                                     |
| Application frontend/backend | Domaine, modèles de cas d’usage, ports                   | Composants UI depuis un service backend ; adaptateurs concrets depuis les règles d’application |
| Vues frontend                | Modèles et composants de présentation, services injectés | `fetch`, accès API direct, logique de prix/persistances et adaptateurs concrets                |
| HTTP entrant backend         | Ports d’application, validateurs, modèles HTTP           | Dépôts Prisma et adaptateurs sortants                                                          |
| Adaptateurs sortants backend | Ports, Prisma ou fournisseur concerné                    | Règles d’interface utilisateur                                                                 |

Le script `check-architecture.mjs` interdit aussi les types `any` et signale les fichiers de plus de 1000 lignes. Ce sont des règles configurées, pas une preuve de qualité complète. Vérifier le résultat actuel du script avant de s’appuyer dessus comme barrière de déploiement.

## Architecture des calculs

| Besoin                                                | Emplacement de référence                                                         |
| ----------------------------------------------------- | -------------------------------------------------------------------------------- |
| Estimation de volume, équipe et durée                 | `frontend/src/modules/moving/domain/estimate/`                                   |
| Calcul du prix transport et lignes de devis           | `backend/src/domain/pricing/`                                                    |
| Prix de référence transport et remises de jours creux | `shared/` et `backend/src/domain/pricing/reference-pricing.ts`                   |
| Assemblage inventaire et compteurs                    | `frontend/src/modules/moving/domain/inventory/`, `backend/src/domain/inventory/` |
| Coût des manœuvres et menuisiers en comptabilité      | `backend/src/domain/accounting/accounting-costs.ts`                              |
| Projection financière et états comptables             | `frontend/src/modules/admin/accounting/domain/accounting-forecast.ts`            |

Les règles et leurs formules sont explicitées dans [calculations.md](calculations.md).

## Architecture de persistance

Prisma est défini dans `backend/prisma/schema.prisma`, dans le schéma PostgreSQL `demenag`. Les dépôts Prisma dans `backend/src/adapters/out/prisma/` sont l’accès applicatif à PostgreSQL. Certaines colonnes JSON de PostgreSQL contiennent des instantanés ou des collections structurées ; ce sont des données relationnelles JSONB persistées en base, pas un système de fichiers local.

Les réservations, les devis et les lignes de devis sont distincts. Le document d’un devis enregistré garde le prix, les lignes et la remise émis. Le journal associe ses écritures au devis source, avec des contraintes d’unicité pour éviter de recréer deux fois les mêmes écritures automatiques.

## Vérification

```bash
npm run check:architecture
npm run typecheck
npm test
npm test -w frontend
```

Ces commandes vérifient des dimensions différentes. Les tests n’établissent pas à eux seuls l’équivalence visuelle ou fonctionnelle avec un document de référence, ni le bon état d’une base déployée.
