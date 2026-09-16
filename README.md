# Mémoire

Mémoire rassemble actions, rendez-vous, journal et connaissances dans une interface React. Supabase fournit l'authentification et la persistance PostgreSQL. Chaque compte voit uniquement ses propres objets grâce aux politiques RLS.

## Démarrage

Prérequis : Node.js 22+ et npm. Le projet est configuré pour le projet Supabase `ilqgjfzpyclswoowdlte` avec sa clé **publishable** publique. Aucun secret serveur n'est nécessaire dans le navigateur.

```bash
cd frontend
npm ci
npm run dev
```

Ouvrez l'adresse affichée par Vite, créez un compte ou connectez-vous. Selon la configuration Auth du projet Supabase, la création d'un compte peut nécessiter une confirmation par courriel. Le schéma requis est dans `supabase/migrations/20260916195312_create_records.sql` et a été appliqué au projet Supabase.

Pour utiliser un autre projet Supabase, créez `frontend/.env.local` :

```dotenv
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Appliquez aussi la migration SQL à cet autre projet. N'utilisez jamais une clé `service_role` ou `sb_secret_` dans une variable `VITE_`.

## GitHub Pages

La version publiée se trouve à <https://fabriceboyer.github.io/personal_manager/>. Le workflow [CI](.github/workflows/ci.yml) vérifie les builds React, GitHub Pages et Docker ; après un push sur `main`, il publie `frontend/dist` si les contrôles passent. Le dépôt est déjà configuré pour publier via GitHub Actions. Le build Pages utilise le préfixe `/personal_manager/`, tandis que le build Docker garde `/`.

Pour que les liens de confirmation Supabase reviennent à l'application, définissez **Site URL** sur `https://fabriceboyer.github.io/personal_manager/` et ajoutez la même adresse dans **Authentication → URL Configuration → Redirect URLs** du projet Supabase. Le frontend utilise automatiquement cette URL lors de l'inscription sur Pages.

## Docker Compose

```bash
docker compose up --build -d
```

L'application est disponible sur <http://localhost:8088>. `APP_PORT=9000 docker compose up --build -d` change le port hôte. L'image ne contient qu'un serveur Nginx statique ; les données sont dans Supabase et ne dépendent plus d'un volume Docker.

## Données et migration depuis Go

La table `public.records` stocke les quatre catégories dans la même structure. Les identifiants lisibles sont générés dans PostgreSQL pour chaque compte, de façon sûre lors de créations concurrentes. Une contrainte empêche les doublons et un déclencheur vérifie que les relations pointent vers des objets du même compte. Les politiques RLS contrôlent lecture, création et modification. L'application ne propose pas de suppression.

Si vous avez utilisé l'ancien backend Go, gardez une copie de `data/records.json`. Après connexion, ouvrez **Aide → Importer vos anciennes données** et sélectionnez ce fichier. Les objets portant un identifiant déjà présent sont ignorés ; les relations sont restaurées après l'import des objets. Le fichier local reste intact.

La clé publishable et l'URL Supabase sont visibles par les utilisateurs du navigateur : c'est normal. La protection des données dépend de Supabase Auth et des politiques RLS, pas du secret de cette clé.

## Vérification

```bash
cd frontend && npm ci && npm run build
cd frontend && npm run build:pages
docker compose config
docker build -t personal-manager:test .
```

La CI compile le frontend et vérifie que l'image Docker sert l'application. Pour vérifier le schéma distant, consultez les avis Security et Performance du projet Supabase et testez lecture, création et modification avec un compte connecté.
