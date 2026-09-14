# Mémoire

Mémoire rassemble dans un registre unique les actions à venir, rendez-vous, réalisations passées et connaissances. Les vues calendrier et journal sont calculées depuis les mêmes objets : l'information n'est jamais recopiée.

![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white) ![Go](https://img.shields.io/badge/Go-1.26-00add8?logo=go&logoColor=white) ![Docker](https://img.shields.io/badge/Docker-ready-2496ed?logo=docker&logoColor=white)

## Fonctionnalités

- Tableau de bord, actions datées ou estimées et rendez-vous avec horaires.
- Journal des actions effectuées avec dates, résultats et commentaires.
- Base de connaissances structurée en sujet, relation et valeur.
- Relations validées entre tous les objets via leurs identifiants.
- Calendrier mensuel dérivé de tout objet daté et recherche globale.
- Interface responsive, colorée, animée et respectueuse de `prefers-reduced-motion`.
- Thème clair/sombre automatique suivant le système, avec choix manuel mémorisé.
- Langue FR/EN autodétectée depuis le navigateur, avec bascule manuelle.
- Page d'aide intégrée et bilingue.
- Persistance locale atomique, sans base de données ni service externe.

## Démarrage en moins de cinq minutes

### Avec Docker Compose — recommandé

Prérequis : Docker Engine avec le plugin Compose.

```bash
docker compose up --build -d
docker compose ps
```

Ouvrir <http://localhost:8088>. Les données résident dans le volume nommé `memoire-data` et survivent aux recréations du conteneur.

Pour choisir un autre port :

```bash
APP_PORT=9000 docker compose up --build -d
```

Arrêter la stack sans supprimer les données :

```bash
docker compose down
```

> `docker compose down -v` supprime aussi le volume et toutes les données. Ne l'utilisez que pour une réinitialisation volontaire.

### En développement local

Prérequis : Go 1.26+, Node.js 22+ et npm 9+.

```bash
cd frontend
npm ci
npm run build
cd ..
go run .
```

L'application est disponible sur <http://localhost:8080>. Le backend crée `data/records.json` avec quelques exemples au premier démarrage.

Pour le rechargement à chaud :

```bash
# Terminal 1 — API
PORT=8080 go run .

# Terminal 2 — frontend
cd frontend
npm run dev -- --host 0.0.0.0
```

## Utilisation

### Identifiants uniques

Chaque objet exige un identifiant explicite, stable et immuable. Le format accepte un préfixe suivi de un à trois segments :

- `ACT-2026-001` pour une action ;
- `RDV-DENTISTE` pour un rendez-vous ;
- `JRN-2026-042` pour une entrée de journal ;
- `PER-MARIE` ou `LIE-CABINET` pour une connaissance.

Un identifiant déjà utilisé provoque une réponse HTTP `409 Conflict`. Les relations vers un identifiant inexistant sont également rejetées. Cette contrainte est le mécanisme central de déduplication.

### Thème et langue

Au premier chargement, le thème suit `prefers-color-scheme` et la langue suit `navigator.language` (`fr` pour le français, anglais dans les autres cas). Les boutons de l'en-tête permettent de changer ces choix. Le thème manuel est conservé dans `localStorage`.

## Architecture

```text
Navigateur
  └── React / Vite
        ├── tableau de bord, calendrier et journal dérivés
        ├── connaissances et relations
        └── aide, traductions et thèmes
                 │ JSON / HTTP
                 ▼
          API Go net/http
                 │ validation + verrou RW
                 ▼
       data/records.json (écriture atomique)
```

Le serveur Go sert l'API et le frontend compilé. Une seule structure `Record` représente les quatre catégories (`action`, `event`, `journal`, `fact`). Les références sont une liste d'identifiants vers d'autres records. Cette architecture minimise la complexité pour un usage personnel tout en laissant une migration future vers SQLite ou PostgreSQL possible.

### Organisation du dépôt

```text
.
├── main.go                    # API, validation, persistance et serveur statique
├── frontend/
│   ├── src/main.jsx           # interface React, vues et traductions
│   ├── src/styles.css         # design principal et responsive
│   └── src/theme.css          # thèmes, animations et page d'aide
├── Dockerfile                 # build multi-stage Node + Go
├── compose.yaml               # stack locale et volume persistant
└── .github/workflows/ci.yml   # contrôles Go, React et image Docker
```

## API HTTP

Toutes les réponses utilisent JSON.

| Méthode | Route | Description | Réponses |
|---|---|---|---|
| `GET` | `/api/health` | État du service | `200` |
| `GET` | `/api/records` | Liste tous les objets | `200` |
| `POST` | `/api/records` | Crée un objet unique | `201`, `400`, `409` |
| `PATCH` | `/api/records/{id}` | Modifie un objet existant | `200`, `400`, `404` |

Exemple :

```bash
curl -X POST http://localhost:8088/api/records \
  -H 'Content-Type: application/json' \
  -d '{"id":"ACT-2026-002","kind":"action","title":"Réserver le train","status":"active","date":"2026-09-20T10:00","tags":["voyage"],"relatedIds":["PER-MARIE"]}'
```

Les écritures sont sérialisées par un verrou, sauvegardées dans un fichier temporaire puis renommées atomiquement. L'API n'implémente actuellement ni authentification, ni pagination, ni limitation de débit : elle doit être exposée uniquement sur un réseau de confiance.

## Configuration

| Variable | Défaut | Usage |
|---|---:|---|
| `PORT` | `8080` | Port d'écoute interne du serveur Go |
| `APP_PORT` | `8088` | Port hôte utilisé uniquement par Compose |

## Vérification et CI

```bash
GOCACHE=/tmp/memoire-go-cache go test ./...
cd frontend && npm ci && npm run build
docker build -t personal-manager:test .
```

GitHub Actions exécute le formatage, `go vet`, les tests Go avec détection de courses, l'installation reproductible et le build React, puis le build Docker avec cache et un test HTTP de l'image.

## Sauvegarde et restauration

```bash
docker compose exec memoire cat /app/data/records.json > records.backup.json
```

Pour une installation locale, copier simplement `data/records.json` pendant que l'application est arrêtée. La restauration consiste à replacer ce fichier au même emplacement avec des permissions lisibles par le processus.

## Dépannage

- Port déjà occupé : lancer avec `APP_PORT=9000 docker compose up -d`.
- Conteneur non sain : consulter `docker compose logs memoire`.
- Données absentes après un lancement local : vérifier le répertoire de travail et `data/records.json`.
- Build frontend obsolète : exécuter `npm ci && npm run build` dans `frontend/`.

## Contribution

1. Créer une branche depuis `main`.
2. Modifier le backend et/ou le frontend.
3. Exécuter les commandes de vérification ci-dessus.
4. Documenter toute modification d'API ou de configuration.
5. Ouvrir une pull request ; la CI doit être verte.

Les évolutions prioritaires pour un usage multi-utilisateur seraient l'authentification, une base SQL, les migrations, la pagination et une politique de sauvegarde automatisée.

## Licence

Aucune licence n'est actuellement déclarée. Tous droits réservés au propriétaire du dépôt.
