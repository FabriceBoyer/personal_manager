# Mémoire

Mémoire rassemble actions, rendez-vous, journal et connaissances dans une interface React. Supabase fournit l'authentification et la persistance PostgreSQL. Chaque compte voit uniquement ses propres objets grâce aux politiques RLS.

## Démarrage

Prérequis : Node.js 22+ et npm. Le projet est configuré pour le projet Supabase `ilqgjfzpyclswoowdlte` avec sa clé **publishable** publique. Aucun secret serveur n'est nécessaire dans le navigateur.

```bash
cd frontend
npm ci
npm run dev
```

Ouvrez l'adresse affichée par Vite, créez un compte ou connectez-vous. Selon la configuration Auth du projet Supabase, la création d'un compte peut nécessiter une confirmation par courriel. Si le lien de confirmation doit revenir à votre déploiement, ajoutez son origine dans **Authentication → URL Configuration → Redirect URLs** du tableau de bord Supabase. Le schéma requis est dans `supabase/migrations/20260916195312_create_records.sql` et a été appliqué au projet Supabase.

Pour utiliser un autre projet Supabase, créez `frontend/.env.local` :

```dotenv
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Appliquez aussi la migration SQL à cet autre projet. N'utilisez jamais une clé `service_role` ou `sb_secret_` dans une variable `VITE_`.

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
docker compose config
docker build -t personal-manager:test .
```

La CI compile le frontend et vérifie que l'image Docker sert l'application. Pour vérifier le schéma distant, consultez les avis Security et Performance du projet Supabase et testez lecture, création et modification avec un compte connecté.
