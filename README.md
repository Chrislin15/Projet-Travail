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

- Le moteur utilise une approche légale par défaut :
  - APIs officielles quand disponibles (ex: LinkedIn Jobs API, Indeed Publisher API),
  - automatisation uniquement sur plateformes autorisées et formulaires standardisés (ex: Welcome to the Jungle),
  - les autres plateformes restent en mode manuel/partenaire.
- Le scraping présent dans le repo est un moteur de démo/fallback (`scrapeOffers`) pour faciliter les tests.
- L'automatisation Playwright est activable avec la variable d'environnement:

```bash
ENABLE_REAL_AUTOMATION=true
```

- La lettre de motivation est envoyée uniquement si l'offre indique qu'elle est requise.
- La liste des compétences est volontairement large, incluant les métiers data (Data Engineer, Data Analyst, Analytics Engineer, dbt, Airflow, Spark, etc.).

## Déploiement (Render)

Le repo contient déjà `Dockerfile` et `render.yaml`.

1. Push le code sur `main`.
2. Sur Render, crée un service via **Blueprint** depuis ce repo.
3. Render build et déploie automatiquement l'application.