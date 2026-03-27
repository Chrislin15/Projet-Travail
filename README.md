# Application de candidature automatique

Application web full-stack (Node.js + Express + frontend statique) qui permet de :

- charger un CV PDF et extraire automatiquement les informations principales,
- sélectionner des compétences manuellement (tags),
- charger une lettre de motivation (PDF/texte),
- lancer des candidatures automatiques avec matching sémantique des titres,
- filtrer par localisation,
- éviter les doublons,
- appliquer un délai anti-spam entre candidatures,
- suivre les statuts dans un tableau de bord,
- exporter les candidatures en CSV.

## Installation

```bash
npm install
```

## Lancement

```bash
npm run dev
```

Puis ouvrir [http://localhost:3000](http://localhost:3000).

## Notes techniques

- Le scraping est fourni sous forme de moteur simulé (`scrapeOffers`) prêt à être branché à des connecteurs réels.
- L'automatisation Playwright est activable avec la variable d'environnement:

```bash
ENABLE_REAL_AUTOMATION=true
```

- La lettre de motivation est envoyée uniquement si l'offre indique qu'elle est requise.

## Déploiement (Render)

Le repo contient déjà `Dockerfile` et `render.yaml`.

1. Push le code sur `main`.
2. Sur Render, crée un service via **Blueprint** depuis ce repo.
3. Render build et déploie automatiquement l'application.