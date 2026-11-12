# Demenag Express

Application web de gestion de déménagement : demandes de réservation, devis, planification, flotte, espace client et comptabilité. Le projet est organisé en workspaces npm pour le frontend et l’API backend.

## Documentation

- [Architecture frontend et backend](docs/architecture.md) : modules, couches, dépendances, flux de données et persistance.
- [Guide complet du projet](docs/project-guide.md) : fonctionnalités, rôles, API, base de données, configuration, sécurité, déploiement et limites.
- [Règles de calcul](docs/calculations.md) : tableaux détaillés des estimations, tarifs, devis, inventaire et comptabilité.
- [CI/CD](docs/ci-cd.md) : pipeline GitHub Actions et contrôles de déploiement.

## Technologies

| Partie           | Technologies                                                          |
| ---------------- | --------------------------------------------------------------------- |
| Interface        | React 19, TypeScript, Vite, React Router, Leaflet, jsPDF              |
| API              | Node.js 22.12+, TypeScript, Express 5, Zod 4                          |
| Données          | PostgreSQL, Prisma 7, Prisma Migrate                                  |
| Tests et qualité | Node test runner, Supertest, Playwright, ESLint, Prettier, TypeScript |

## Démarrage local

Prérequis : Node.js 22.12 ou supérieur, npm et une base PostgreSQL de développement.

```bash
npm install
cp backend/.env.example backend/.env
npm run db:generate
```

Renseigner dans `backend/.env` les URL de base de données de la même branche de développement. `DATABASE_URL` sert aux connexions de l’API et `DATABASE_URL_UNPOOLED` aux migrations. Ne jamais ajouter ces secrets à Git ni au frontend.

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

Le frontend est disponible à `http://localhost:5173`, l’API à `http://localhost:4000/api`. L’endpoint `/api/ready` vérifie la disponibilité de l’API et de la base.

Pour Docker Compose, configurer `backend/.env`, puis lancer :

```bash
docker compose up --build
```

Les ports locaux du compose sont `8080` pour l’application web et `4000` pour l’API.

## Commandes principales

| Commande                              | But                                                              |
| ------------------------------------- | ---------------------------------------------------------------- |
| `npm run dev`                         | Lance l’API et le frontend en développement                      |
| `npm run build`                       | Compile les workspaces frontend et backend                       |
| `npm run typecheck`                   | Vérifie les types TypeScript des deux workspaces                 |
| `npm test`                            | Lance les tests du backend                                       |
| `npm test -w frontend`                | Lance les tests du frontend                                      |
| `npm run test:integration -w backend` | Lance les tests d’intégration contre une base dédiée             |
| `npm run format:check`                | Vérifie Prettier sur le dépôt                                    |
| `npm run lint`                        | Lance ESLint                                                     |
| `npm run check:architecture`          | Vérifie les règles d’architecture configurées dans le script     |
| `npm run check:reference`             | Vérifie la présence et la cohérence des ressources de référence  |
| `npm run check`                       | Enchaîne les vérifications configurées dans le script racine     |
| `npm run db:migrate`                  | Applique les migrations Prisma à la base configurée              |
| `npm run db:seed`                     | Initialise les données de catalogue de base                      |
| `npm run admin:create`                | Crée un compte administrateur avec les variables locales prévues |

Les tests d’intégration peuvent modifier des données : utiliser exclusivement une base temporaire dédiée, jamais une base de production.

## Conventions de données et de calcul

- Les montants sont des entiers en XOF/FCFA.
- PostgreSQL est la source de persistance. Les colonnes JSONB éventuelles sont des champs de la base, pas des fichiers JSON locaux.
- Les paramètres enregistrés peuvent remplacer les valeurs initiales communes dans `shared/`.
- L’estimation de travail dans le navigateur sert à planifier. Le prix définitif est recalculé et validé côté backend à partir du catalogue et des paramètres autorisés.
- Les devis enregistrés conservent un instantané de leurs lignes et montants afin que les futurs changements de tarifs ne réécrivent pas l’historique.

Voir [les règles de calcul](docs/calculations.md) et [la documentation de la base](docs/project-guide.md#base-de-données-et-persistance).

## Structure racine

```text
backend/       API, domaine métier, Prisma, migrations et tests backend
frontend/      Application React, modules fonctionnels, styles et tests frontend
shared/        Contrats et valeurs par défaut partagés
docs/          Documentation projet et exploitation
scripts/       Vérifications et outils du dépôt
```

La structure détaillée est décrite dans [docs/architecture.md](docs/architecture.md).

## Sources de vérité

Les règles présentes dans la documentation ont été relevées dans les fichiers du dépôt. Pour toute modification métier, le code, les tests et les paramètres actifs de la base restent les sources de vérité. Une règle dont le comportement dépend de la configuration courante ne doit pas être interprétée comme une constante universelle.
