# Potixx 0.1.0 — Onglets et pronostics

Date : 2026-11-14. Version : `0.1.0` (branche `release/v0.1.0`).

## Objectif

1. Ranger la chasse au trésor existante dans un onglet dédié.
2. Ajouter un onglet « Pronostics » où les visiteurs parient sur le bébé : sexe, date de
   naissance, taille, poids, couleur des yeux, prénom.
3. Permettre aux propriétaires de consulter (et nettoyer) les pronostics sur une page admin.
4. Aligner la CI sur les autres projets : tests sur PR, publication sur tag `vX.Y.Z`.

## Décisions du propriétaire

- Backend en Go, comme visite et homepage.
- Les pronostics ne sont visibles que des propriétaires (page admin protégée par mot de passe).
- L'onglet Pronostics est toujours visible, même avant la fin de la chasse.
- Champ « Votre nom » obligatoire ; un envoi = un pronostic, pas de modification. Les doublons se
  suppriment depuis l'admin.
- Endpoint `/version` alimenté par `utils/buildinfo`.

## Architecture

```
Navigateur ──► binaire Go (port 8080)
                ├── GET  /version                         utils/version.Handler()
                ├── POST /api/predictions                 public
                ├── GET  /api/admin/predictions           Basic Auth
                ├── DELETE /api/admin/predictions/{id}    Basic Auth
                └── /*                                    front Angular embarqué (repli SPA)
                         │
                         └── /data/predictions.json
```

Le binaire Go remplace nginx : `nginx.conf` est supprimé.

### Arborescence

```
backend/
  go.mod                module github.com/mgarnier-home/potixx/backend
  main.go               configuration, montage des routes, écoute
  spa.go                fichiers du front + repli index.html + en-têtes (ex-nginx.conf)
  predictions/
    prediction.go       type Prediction, validation
    store.go            fichier JSON, verrou, écriture atomique
    handlers.go         routes /api
  web/browser/          build Angular copié au build Docker (.gitkeep versionné)
  .golangci.yml         copie de celui de homepage
src/app/
  app.ts / app.html     barre d'onglets + <router-outlet>
  app.routes.ts         "" → hunt, "pronostics" → predictions, "admin" → admin
  hunt/hunt.ts          page de la chasse (ancien contenu de app.ts / app.html, inchangé)
  predictions/
    prediction-content.ts   bornes, couleurs d'yeux, libellés (contenu éditable)
    core/                   validation pure (testée)
    predictions-api.ts      appels HTTP
    prediction-form/        onglet Pronostics
    admin/                  page /admin
proxy.conf.json         /api et /version → http://localhost:8080 pour `npm start`
```

## Backend

### Configuration (variables d'environnement)

| Variable                 | Défaut                   | Rôle                                                  |
| ------------------------ | ------------------------ | ----------------------------------------------------- |
| `POTIXX_ADMIN_PASSWORD`  | vide                     | Mot de passe admin. Vide : l'admin répond 503.        |
| `POTIXX_DATA_PATH`       | `/data/predictions.json` | Fichier des pronostics (créé au premier envoi).       |
| `POTIXX_PORT`            | `8080`                   | Port d'écoute.                                        |

Sans mot de passe, le reste du site fonctionne : un log d'avertissement est émis au démarrage.

### Modèle

| Champ       | Type JSON | Règle                                               |
| ----------- | --------- | --------------------------------------------------- |
| `id`        | string    | généré par le serveur (16 octets aléatoires, hex)   |
| `name`      | string    | 1 à 60 caractères après `TrimSpace`                 |
| `sex`       | string    | `girl` ou `boy`                                     |
| `birthDate` | string    | `AAAA-MM-JJ`, du 2027-01-01 au 2027-07-31 inclus    |
| `heightCm`  | number    | 30 à 70                                             |
| `weightKg`  | number    | 1 à 7, au plus une décimale                         |
| `eyeColor`  | string    | `blue`, `green`, `brown`, `grey`, `hazel`           |
| `firstName` | string    | 1 à 40 caractères après `TrimSpace`                 |
| `createdAt` | string    | RFC 3339, posé par le serveur                       |

Tous les champs saisis sont obligatoires. Les longueurs se comptent en caractères (runes), pas en
octets. Les champs inconnus sont refusés (`DisallowUnknownFields`).

### Stockage

- Un fichier JSON contenant le tableau des pronostics, chargé au démarrage (absent = vide).
- Toutes les opérations passent par un `sync.Mutex`.
- Chaque écriture : fichier temporaire dans le même dossier, `fsync`, puis `os.Rename` sur le
  fichier final. Une coupure ne laisse jamais un fichier tronqué.
- Plafond de 1000 pronostics : au-delà, `POST` répond 507 (un robot ne remplit pas le disque).

### API

| Méthode et route                    | Accès      | Réponse                                                 |
| ----------------------------------- | ---------- | ------------------------------------------------------- |
| `POST /api/predictions`             | public     | 201 + pronostic créé ; 400 `{"error": "…"}` en français |
| `GET /api/admin/predictions`        | Basic Auth | 200 + tableau trié du plus récent au plus ancien        |
| `DELETE /api/admin/predictions/{id}`| Basic Auth | 204 ; 404 si l'id n'existe pas                          |
| `GET /version`                      | public     | `{"version","commit","date"}` de `utils/buildinfo`      |

- Corps de `POST` limité à 4 Ko (`http.MaxBytesReader`).
- Admin : en-tête `Authorization: Basic`, utilisateur ignoré, mot de passe comparé avec
  `crypto/subtle.ConstantTimeCompare`. 401 sans en-tête `WWW-Authenticate`, pour que le
  navigateur n'ouvre pas sa fenêtre de connexion native. 503 si aucun mot de passe n'est
  configuré.
- Une route `/api/...` inconnue répond 404 en JSON, jamais `index.html`.

### Front servi par Go

`spa.go` reprend le `spaHandler` de homepage et les en-têtes de `nginx.conf` :

- partout : `X-Robots-Tag: noindex, nofollow`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin` (y compris sur `/api` et `/version`) ;
- `index.html` et repli SPA : `Cache-Control: no-cache` ;
- `*.js`, `*.css` : `Cache-Control: public, max-age=31536000, immutable` ;
- `/assets/*` : `Cache-Control: public, max-age=3600`.

Le serveur Go compresse en gzip les fichiers texte (html, js, css, svg, json), comme nginx.

### Version

Le build injecte `buildinfo.Version`, `Commit` et `Date` par `-ldflags`, comme visite. `GET
/version` est monté avec `version.Handler()` de `github.com/mgarnier-home/utils` (dernier tag
v1.4.0). Le healthcheck Docker interroge `/version`.

## Front

### Onglets et routes

- Le router Angular (déjà en dépendance) est activé : `provideRouter(routes)`.
- `/` : la chasse au trésor. Le contenu actuel de `app.ts` / `app.html` / `app.scss` devient la
  page `hunt/hunt.ts`, sans changement de comportement ni de sauvegarde (`potixx.progress.v1`
  inchangée).
- `/pronostics` : formulaire.
- `/admin` : page admin, absente de la barre d'onglets.
- Route inconnue → redirection vers `/`.
- `app.html` : barre d'onglets « Chasse au trésor | Pronostics » (`routerLink` +
  `routerLinkActive`, `aria-current="page"`), puis `<router-outlet>`. Style parchemin cohérent
  avec l'existant, cibles tactiles ≥ 32 px. Quand une énigme est ouverte (`RiddlePanel`), la barre
  reste visible au-dessus.

### Onglet Pronostics

- Reactive Forms : nom, sexe (deux boutons radio Fille / Garçon), date (`<input type="date">`
  bornée par `min`/`max`), taille (`number`, cm), poids (`number`, pas de 0,1 kg), couleur des
  yeux (radios Bleus / Verts / Marron / Gris / Noisette), prénom.
- Les bornes, la liste des couleurs et les libellés vivent dans `prediction-content.ts`. Les
  mêmes bornes sont dupliquées côté Go : le serveur reste la référence.
- Validation dans `predictions/core/` (fonctions pures) : messages d'erreur sous chaque champ
  après la première tentative d'envoi.
- Pendant l'envoi : bouton désactivé. Succès : message de remerciement à la place du formulaire.
  Erreur 400 : le message du serveur est affiché ; erreur réseau ou 5xx : message générique,
  la saisie est conservée.
- Pas de mémoire locale de l'envoi : un rechargement réaffiche un formulaire vide.

### Page admin

- Un champ mot de passe ; le mot de passe reste en mémoire (signal), jamais en stockage local.
- Après connexion : tableau (nom, sexe, date, taille, poids, yeux, prénom, date d'envoi), plus
  récent en tête, bouton « Supprimer » par ligne avec confirmation.
- 401 : « Mot de passe incorrect » et retour au champ. 503 : « Admin non configuré ».
- En 390 px de large, le tableau défile horizontalement dans son conteneur.

### Développement local

`proxy.conf.json` (référencé par `angular.json`) renvoie `/api` et `/version` vers
`http://localhost:8080`. Lancer le backend : `cd backend && POTIXX_ADMIN_PASSWORD=dev
POTIXX_DATA_PATH=../tmp/predictions.json go run .`.

## Tests

- **Go** : validation (chaque règle, cas limites des bornes), stockage (création, suppression,
  rechargement depuis le fichier, plafond), handlers (`httptest` : 201/400/404/401/503, corps trop
  gros, champs inconnus, route `/api` inconnue en JSON, en-têtes `noindex` et cache, `/version`).
- **Vitest** : validation front ; composants formulaire et admin avec `HttpTestingController`.
- **Playwright** (mobile + ordinateur) : API simulée par `page.route`. Navigation par onglets ;
  envoi d'un pronostic ; erreur serveur affichée ; connexion admin, liste, suppression. La suite
  existante de la chasse continue de passer (elle part de `/`).

## Docker

`Dockerfile` en trois étapes, sur le modèle de visite :

1. `node:24.16.0-alpine` : `npm ci`, `npm run build`.
2. `golang:1.26.4-alpine` : copie de `dist/potixx/browser` dans `backend/web/browser`, build
   statique (`CGO_ENABLED=0`) avec `-ldflags` buildinfo, `GOOS`/`GOARCH` de la cible.
3. `alpine:3.24.3` : utilisateur 10001:10001, `/data` lui appartenant, `VOLUME /data`,
   `EXPOSE 8080`, healthcheck `wget` sur `/version`.

`.dockerignore` exclut `backend/web/browser` local, `node_modules`, `dist`, `tmp`.

## CI

### `test.yml`

- Déclenchement : `pull_request` vers `master`, `push` sur `master`.
- Job **Front** : étapes actuelles (lint, format, Vitest, Playwright, rapport en cas d'échec).
- Job **Back** (`working-directory: backend`) : `go vet ./...`, `go test -race ./...`,
  `golangci-lint` v2.15.0 avec `backend/.golangci.yml`.
- `embed` exige un fichier dans `web/browser` : le `.gitkeep` versionné suffit pour les tests.

### `publish.yml`

Copie de celui de visite, adaptée :

- déclenché par un tag `v*.*.*` ; le job « version » vérifie le format `vX.Y.Z` et que le commit
  est un ancêtre de `origin/${{ github.event.repository.default_branch }}` (pas de nom de
  branche en dur) ;
- build natif amd64 et arm64 sur les runners auto-hébergés (`linux/amd64`, `linux/arm64`),
  build-args `VERSION`, `COMMIT`, `DATE` ;
- manifeste multi-arch `mgarnier11/potixx:X.Y.Z` et `latest`.

Les secrets GitHub `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` ne servent plus (auth des runners).

## Hors du repo potixx

- **dev-vms** (PR #2, `release/v1.1.0`, encore ouverte) : `home/scripts/tag-release.sh` passe sur
  la branche par défaut lue par `git symbolic-ref --short refs/remotes/origin/HEAD` au lieu de
  `main` ; la ligne potixx de `claude/CLAUDE.md` devient `tag-release X.Y.Z`.
- **orchestrator** (après publication de 0.1.0, chaque étape avec accord) : image `0.1.0` dans
  `utils/apollon.utils.yml`, volume `docker-data` sous-chemin `utils/potixx/data` → `/data`
  (dossier en 10001:10001), `POTIXX_ADMIN_PASSWORD: ${POTIXX_ADMIN_PASSWORD}` avec la valeur
  dans `/mnt/secrets/utils/utils.env` (mot de passe aléatoire de 20 caractères).
- **Docs potixx** : `CLAUDE.md` (périmètre, arborescence, commandes Go, déploiement) et
  `README.md`.

## Hors périmètre

Modification d'un pronostic envoyé, affichage public des pronostics, export CSV, statistiques,
affichage de la version dans l'interface.
