# Mémoire — Personal Manager

Application personnelle qui réunit actions, rendez-vous, journal et connaissances dans un registre unique. Les vues calendrier et activité sont déduites des mêmes objets : aucune information n'est dupliquée.

## Démarrage

```bash
cd frontend
npm install
npm run build
cd ..
go run .
```

Ouvrir http://localhost:8080. Les données sont conservées dans `data/records.json` (créé automatiquement).

Pour développer le frontend avec le rechargement à chaud :

```bash
# terminal 1
go run .
# terminal 2
cd frontend && npm run dev -- --host 0.0.0.0
```

## Modèle

Tous les éléments partagent un identifiant unique, immuable et fourni explicitement à la saisie (`ACT-2026-001`, `PER-MARIE`, etc.). Les relations utilisent ces identifiants et sont validées par l'API. Un doublon d'identifiant est rejeté avec une réponse HTTP 409.
