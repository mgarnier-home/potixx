# Potixx — Chasse au trésor et pronostics

Site d'annonce de grossesse au thème pirate : le visiteur suit une carte au trésor, résout quatre
énigmes (cadenas, mot de passe, mots croisés, mots mêlés) et découvre le trésor : « Notre famille
s'agrandira en Avril 2027 » et une scène animée tirée au sort (le bébé qui sort du coffre, ou
porté par une mouette). Un second onglet recueille les pronostics sur le bébé (sexe, date,
taille, poids, yeux, prénom), consultables seulement sur `/admin`. Public familial, surtout sur
téléphone.

- Spec de la chasse : `docs/superpowers/specs/2026-09-26-potixx-chasse-au-tresor-design.md`
- Spec des onglets, pronostics et backend (0.1.0) :
  `docs/superpowers/specs/2026-11-14-potixx-onglets-pronostics-design.md`
- Besoin d'origine : `site.md`, grille des mots croisés : `activity.png`

**Périmètre :** la chasse au trésor (sans backend) et les pronostics (API Go, fichier JSON). Pas de
base de données, pas de son, pas de SSR.

## Commandes

| Action                                      | Commande                                                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Serveur de dev (http://localhost:4200)      | `npm start`                                                                                                   |
| Tests unitaires (Vitest, une passe)         | `npm test`                                                                                                    |
| Tests E2E (Playwright, mobile + ordinateur) | `npm run e2e`                                                                                                 |
| Lint                                        | `npm run lint`                                                                                                |
| Formatage / vérification                    | `npm run format` / `npm run format:check`                                                                     |
| Build de production                         | `npm run build` (sortie : `dist/potixx/browser`)                                                              |
| Image Docker locale                         | `docker build -t potixx . && docker run --rm -p 8080:8080 potixx`                                             |
| Backend local (pour `npm start`)            | `cd backend && POTIXX_PORT=18080 POTIXX_ADMIN_PASSWORD=dev POTIXX_DATA_PATH=../tmp/predictions.json go run .` |
| Tests et lint du backend                    | `cd backend && go vet ./... && go test -race ./... && golangci-lint run`                                      |

Node 24.16.0, Go 1.26.4, golangci-lint 2.15.0 (`.tool-versions`), Angular 22.2, npm.
`proxy.conf.json` relaie `/api` et `/version` de `npm start` vers le backend sur le port 18080.

## Arborescence

```
assets/                     images, carte — servis sous /assets/
public/robots.txt           interdit l'indexation
backend/                    binaire Go : front embarqué, en-têtes, /version, API
  predictions/              validation, stockage JSON, handlers /api
  spa.go                    fichiers du front, cache, en-têtes noindex (ex-nginx.conf)
src/app/
  app.ts, app.routes.ts     barre d'onglets et routes (/, /pronostics, /admin)
src/app/predictions/
  prediction-content.ts     bornes et libellés des pronostics (bornes dupliquées dans le Go)
  core/                     validation pure, en-tête Basic Auth
  prediction-form/, admin/  onglet Pronostics et page /admin
src/app/hunt/
  hunt.ts                   page de l'onglet Chasse au trésor
  hunt-content.ts           TOUT le contenu éditable (textes, réponses, grilles, positions)
  hunt-progress.service.ts  état de la partie (signals) + sauvegarde localStorage
  core/                     logique pure sans Angular (réponses, aléatoire, mots mêlés, mots croisés)
  <composant>/              un dossier par écran : carte, 4 énigmes, trésor, shared/
e2e/                        tests Playwright
```

## Conventions

- **Langues** : documentation, skills, specs et commentaires en français ; code (fichiers,
  variables, fonctions, composants) en anglais.
- Angular moderne : composants standalone, signals, sans zone.js, `input()` / `output()`,
  contrôle de flux `@if` / `@for`. Nommage de fichiers « 2025 » (`crossword.ts`, pas
  `crossword.component.ts`).
- La logique métier va dans `core/` (fonctions pures, testées) ; les composants restent minces.
- Les composants ne lisent jamais `localStorage` : ils passent par `HuntProgressService`. Le mot
  de passe admin reste en mémoire, jamais stocké.
- Le serveur Go fait foi pour la validation des pronostics : changer une borne dans
  `prediction-content.ts` impose de la changer dans `backend/predictions/prediction.go`.
- Le contenu (textes, réponses, définitions) ne se modifie que dans `hunt-content.ts`
  (voir le skill `modifier-le-contenu`).
- Mobile d'abord : référence 390×844, cibles tactiles ≥ 32 px ; doit rester agréable en 1280×800.
- Interface : charger le skill `frontend-design:frontend-design` avant de travailler les styles ;
  ambiance pirate/parchemin cohérente.
- Changer la forme de `HuntProgress` impose de passer la clé de sauvegarde de
  `potixx.progress.v1` à `v2`.

## Documentation des bibliothèques

Avant d'utiliser une API Angular, Vitest ou Playwright dont tu n'es pas sûr, consulte la
documentation à jour via le serveur MCP **Context7**. Les connaissances d'entraînement peuvent
être en retard sur Angular 22.

## Définition de « terminé »

Une modification n'est terminée que si, dans l'ordre :

1. `npm run lint` et `npm run format:check` passent ;
2. `npm test` passe (nouvelle logique = test écrit d'abord, vu en échec, puis vert) ;
3. `npm run e2e` passe ;
4. dans `backend/` : `go vet ./...`, `go test -race ./...` et `golangci-lint run` passent ;
5. pour tout changement visible : le skill `verifier-dans-le-navigateur` a été suivi (captures en
   390×844 et 1280×800, aucune erreur console).

Annonce le résultat réel des commandes, pas celui attendu.

## Interdits

- **Git : workflow de développement commun** (branche `release/vX.Y.Z` + PR vers `master`, voir
  `/mnt/dev/CLAUDE.md`). Jamais de réécriture d'historique (`rebase`, `reset --hard`,
  `commit --amend` sur un commit existant) sans demande explicite.
- Ne jamais retirer le `noindex` (meta robots dans `src/index.html`, `public/robots.txt`,
  en-tête `X-Robots-Tag` posé par `securityHeaders` dans `backend/spa.go`).
- Ne jamais publier d'image Docker (`docker push`) : c'est le rôle de la CI GitHub.
- Ne pas lire les fichiers `.env*`.

## Déploiement

Deux workflows GitHub Actions :

- `.github/workflows/test.yml` : sur chaque PR vers `master` et chaque push sur `master`, jobs
  Front (lint, formatage, Vitest, Playwright) et Back (vet, tests, golangci-lint). Ne publie rien.
- `.github/workflows/publish.yml` : déclenché par un tag `vX.Y.Z` présent sur la branche par
  défaut, poussé par `tag-release X.Y.Z` après la fusion. Construit les images amd64 et arm64 sur
  les runners auto-hébergés (déjà connectés à Docker Hub), puis publie
  `mgarnier11/potixx:X.Y.Z` et `latest`.

Le conteneur écoute sur 8080, tourne en `10001:10001` et garde ses données dans `/data` ; le mot
de passe admin vient de `POTIXX_ADMIN_PASSWORD`. Le HTTPS est géré par le reverse proxy du
propriétaire.
