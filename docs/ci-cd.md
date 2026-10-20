# CI/CD GitHub Actions

Le dépôt dispose de deux contrôles indépendants, exécutés sur chaque pull request vers `main` et chaque push sur une branche :

- **Backend CI** : formatage, ESLint, validation/génération Prisma, replay des migrations sur un PostgreSQL temporaire vide, seed du catalogue de test, tests unitaires et API avec PostgreSQL, compilation TypeScript et construction de l’image Docker Render.
- **Frontend CI** : formatage, ESLint, vérification TypeScript et build Vite avec la même commande que Vercel.

Les bases de données utilisées par le workflow backend sont temporaires et propres à l’exécution. Aucun secret de production n’est requis ni exposé dans GitHub Actions.

## Bloquer les déploiements de production si un contrôle échoue

Les workflows vérifient le code. Pour en faire une barrière effective avant la production, relier les contrôles aux services existants :

1. Dans **GitHub → Settings → Rules → Rulesets** (ou **Branches → Branch protection rules**), protéger `main`, interdire les pushes directs et exiger les contrôles `Backend CI / backend-ci` et `Frontend CI / frontend-ci` avant fusion.
2. Le `render.yaml` déclare maintenant `autoDeployTrigger: checksPass`. Synchroniser ce Blueprint avec le service Render, ou sélectionner **After CI Checks Pass** dans **Render → service API → Settings → Auto-Deploy** si le service existant n’est pas géré par ce Blueprint. Render attend les résultats GitHub Actions avant le déploiement. Le `preDeployCommand` garde l’application des migrations sur la base Render au moment du déploiement.
3. Dans **Vercel → projet frontend → Settings → Deployment Checks**, ajouter comme contrôles GitHub Actions `Backend CI / backend-ci` et `Frontend CI / frontend-ci`. Vercel peut préparer le déploiement, mais ne l’associera pas au domaine de production avant le succès de ces contrôles.
4. Faire une pull request de test vers `main`, attendre les deux contrôles verts, puis fusionner. Confirmer dans Render et Vercel qu’ils attendent bien les contrôles avant la mise en production.

Les deux services peuvent continuer à construire automatiquement depuis GitHub. Aucun token de déploiement n’est nécessaire dans les secrets GitHub avec ces réglages natifs.

## Limite des vérifications

Le build frontend est effectué sans secret ni adresse d’API de production ; le frontend utilise `/api` et le proxy Vercel configuré. Le test backend d’intégration s’exécute contre le PostgreSQL temporaire du workflow, jamais contre la base de production. Le démarrage de l’API réelle et les vérifications après déploiement restent assurés par le health check Render `/api/ready` et par les plateformes.

Le script historique `npm run check:architecture` n’est pas un contrôle bloquant pour l’instant : son exécution sur l’état actuel du dépôt signale déjà de nombreux écarts dans des fichiers existants. Il faudra traiter ces écarts avant de l’ajouter à la barrière de déploiement.
