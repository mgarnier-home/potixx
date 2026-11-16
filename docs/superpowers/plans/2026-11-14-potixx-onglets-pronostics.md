# Potixx 0.1.0 — Onglets et pronostics : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ranger la chasse au trésor dans un onglet, ajouter un onglet Pronostics et une page
admin servis par un backend Go, et publier sur tag comme visite.

**Architecture:** Un binaire Go (`backend/`, stdlib `net/http`) embarque le build Angular,
remplace nginx, expose `/api/predictions` (public), `/api/admin/predictions` (Basic Auth) et
`/version`, et stocke les pronostics dans un fichier JSON. Le front active le router Angular :
`/` chasse, `/pronostics` formulaire, `/admin` tableau.

**Tech Stack:** Go 1.26.4 (stdlib + `github.com/mgarnier-home/utils` v1.4.0), Angular 22.2
(standalone, signals, Reactive Forms, `HttpClient`), Vitest, Playwright, GitHub Actions sur
runners auto-hébergés.

**Spec:** `docs/superpowers/specs/2026-11-14-potixx-onglets-pronostics-design.md`

## Global Constraints

- Branche `release/v0.1.0`, commits Conventional Commits terminés par
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Commentaires, docs, messages d'erreur visibles en français ; identifiants en anglais.
- Nommage Angular « 2025 » (`prediction-form.ts`), composants standalone, `OnPush`, signals,
  `@if` / `@for`, sans zone.js.
- Logique pure dans `core/`, testée ; composants minces ; aucun composant ne lit `localStorage`.
- `potixx.progress.v1` et la forme de `HuntProgress` ne changent pas.
- Ne jamais retirer `noindex` (meta, `robots.txt`, en-tête `X-Robots-Tag` désormais posé par Go).
- Mobile d'abord : 390×844, cibles tactiles ≥ 32 px ; agréable en 1280×800.
- Bornes : date 2027-01-01 → 2027-07-31 ; taille 30 → 70 cm ; poids 1 → 7 kg, une décimale max ;
  nom 1 → 60 caractères ; prénom 1 → 40 caractères ; couleurs `blue`, `green`, `brown`, `grey`,
  `hazel` ; sexe `girl`, `boy` ; corps POST ≤ 4 Ko ; 1000 pronostics max.
- Définition de terminé (avant chaque push) : `npm run lint`, `npm run format:check`, `npm test`,
  `npm run e2e`, `cd backend && go vet ./... && go test -race ./... && golangci-lint run`, et pour
  le visible la skill `verifier-dans-le-navigateur`.

## Review Focus

1. Nom ou prénom accentué (« Zoé », « Anaïs ») de 60 / 40 caractères : accepté (longueur en runes,
   pas en octets) — test dans Task 1.
2. Poids `3.4` ou `6.9` : accepté malgré l'arrondi flottant ; `3.45` refusé — test dans Task 1.
3. Date impossible (`2027-02-30`) ou au mauvais format (`30/03/2027`) : refusée côté Go ; côté
   front, la date reste une chaîne `AAAA-MM-JJ` jamais convertie en `Date` (pas de décalage de
   fuseau) — tests dans Task 1 et Task 6.
4. Deux envois simultanés : aucun pronostic perdu, fichier valide — test sous `-race` dans Task 2.
5. Mot de passe admin contenant `:` ou un caractère non ASCII : l'en-tête Basic est encodé en UTF-8
   côté front (`btoa` seul lève une exception) et accepté côté Go — tests dans Task 3 et Task 6.

---

### Task 1: Module Go, modèle et validation

**Files:**
- Create: `backend/go.mod`, `backend/.golangci.yml` (copie de `../homepage/backend/.golangci.yml`)
- Create: `backend/predictions/prediction.go`
- Test: `backend/predictions/prediction_test.go`

**Interfaces:**
- Produces (package `predictions`, module `github.com/mgarnier-home/potixx/backend`) :
  - `type Input struct { Name, Sex, BirthDate string; HeightCm, WeightKg float64; EyeColor, FirstName string }`
    avec tags JSON `name`, `sex`, `birthDate`, `heightCm`, `weightKg`, `eyeColor`, `firstName`.
  - `type Prediction struct { ID string; Input; CreatedAt time.Time }` (tags `id`, `createdAt`,
    `Input` embarqué donc champs à plat en JSON).
  - `func (in Input) Normalize() Input` : `TrimSpace` sur `Name`, `FirstName`.
  - `func (in Input) Validate() error` : `nil` ou erreur dont le message est la phrase française
    affichée à l'utilisateur (ex. « Le poids doit être compris entre 1 et 7 kg. »).

- [ ] **Step 1: Initialiser le module** — `cd backend && go mod init github.com/mgarnier-home/potixx/backend`, `go 1.26.4` dans `go.mod`.
- [ ] **Step 2: Écrire le test table `TestValidate`**

Cas (une ligne chacun, `wantErr bool`) : entrée valide de référence
`{Name:"Mamie", Sex:"girl", BirthDate:"2027-04-12", HeightCm:50, WeightKg:3.4, EyeColor:"blue", FirstName:"Zoé"}` → ok ;
nom vide / espaces seuls → err ; nom de 60 « é » → ok ; 61 → err ; prénom 40 « ï » → ok ; 41 → err ;
sexe `""`, `"other"` → err ; date `2026-12-31`, `2027-08-01`, `2027-02-30`, `30/03/2027` → err ;
`2027-01-01`, `2027-07-31` → ok ; taille 29.9, 70.1 → err, 30, 70 → ok ; poids 0.9, 7.1, 3.45 → err ;
1, 7, 3.4, 6.9, 1.1 → ok ; couleur `"red"` → err, chacune des cinq → ok.

- [ ] **Step 3: Lancer** `go test ./predictions/` — attendu : échec de compilation (`Validate` non défini).
- [ ] **Step 4: Implémenter** `Normalize` et `Validate` — longueurs avec `utf8.RuneCountInString`,
  date avec `time.Parse("2006-01-02", …)` puis comparaison de chaînes aux bornes, décimale avec
  `math.Abs(w*10-math.Round(w*10)) < 1e-9`. Les bornes sont des constantes du fichier.
- [ ] **Step 5: Lancer** `go test ./predictions/ && go vet ./... && golangci-lint run` — attendu : PASS, 0 issue.
- [ ] **Step 6: Commit** — `feat(backend): modèle et validation des pronostics`

### Task 2: Stockage JSON

**Files:**
- Create: `backend/predictions/store.go`
- Test: `backend/predictions/store_test.go`

**Interfaces:**
- Consumes: `Input`, `Prediction` (Task 1).
- Produces:
  - `var ErrFull, ErrNotFound error`
  - `const MaxPredictions = 1000`
  - `func Open(path string) (*Store, error)` : fichier absent = liste vide ; JSON invalide = erreur.
  - `func (s *Store) Add(in Input, now time.Time) (Prediction, error)` : id = 16 octets
    `crypto/rand` en hex, `CreatedAt = now.UTC()`, `ErrFull` à 1000.
  - `func (s *Store) List() []Prediction` : copie, `CreatedAt` décroissant.
  - `func (s *Store) Delete(id string) error` : `ErrNotFound` si absent.

- [ ] **Step 1: Écrire les tests** (`t.TempDir()`) :
  `TestOpenMissingFile` (liste vide, aucun fichier créé) ; `TestAddPersists` (Add puis `Open` du
  même chemin → 1 pronostic identique, id de 32 caractères hex) ; `TestListNewestFirst` ;
  `TestDelete` (puis rechargement → absent ; second `Delete` → `ErrNotFound`) ; `TestFull`
  (1000 Add ok, le 1001ᵉ → `ErrFull`, fichier inchangé) ; `TestOpenCorruptFile` → erreur ;
  `TestConcurrentAdd` (50 goroutines, puis `Open` → 50 pronostics).
- [ ] **Step 2: Lancer** `go test -race ./predictions/` — attendu : échec de compilation.
- [ ] **Step 3: Implémenter** — `sync.Mutex` ; écriture par `os.CreateTemp(filepath.Dir(path), …)`,
  `json.Encoder`, `f.Sync()`, `f.Close()`, `os.Rename`. Le dossier parent est créé par `Add`
  (`os.MkdirAll`) s'il manque. En cas d'échec d'écriture, l'état en mémoire n'est pas modifié.
- [ ] **Step 4: Lancer** `go test -race ./predictions/` — attendu : PASS.
- [ ] **Step 5: Commit** — `feat(backend): stockage des pronostics dans un fichier JSON`

### Task 3: Handlers de l'API

**Files:**
- Create: `backend/predictions/handlers.go`
- Test: `backend/predictions/handlers_test.go`

**Interfaces:**
- Consumes: `Store`, `ErrFull`, `ErrNotFound`, `Input.Normalize/Validate` (Tasks 1-2).
- Produces:
  - `type Handlers struct { Store *Store; AdminPassword string; Now func() time.Time }`
  - `func (h *Handlers) Register(mux *http.ServeMux)` : monte `POST /api/predictions`,
    `GET /api/admin/predictions`, `DELETE /api/admin/predictions/{id}` et un repli `/api/` qui
    répond 404 JSON.
  - Toute erreur répond `{"error": "<message français>"}` avec `Content-Type: application/json`.

- [ ] **Step 1: Écrire les tests** (`httptest`, `Store` sur `t.TempDir()`) :
  POST valide → 201, corps contient `id` et `createdAt` ; POST nom vide → 400 et
  `error` non vide ; POST champ inconnu `{"foo":1,…}` → 400 ; POST corps de 5000 octets → 400 ;
  POST JSON invalide → 400 ; POST store plein → 507 ;
  GET admin sans en-tête → 401 et **pas** d'en-tête `WWW-Authenticate` ; mauvais mot de passe → 401 ;
  bon mot de passe (`SetBasicAuth("", "pa:ss-é")`) → 200 + tableau ; `AdminPassword` vide → 503 ;
  DELETE existant → 204 ; DELETE inconnu → 404 ; `GET /api/inconnu` → 404 JSON.
- [ ] **Step 2: Lancer** `go test ./predictions/` — attendu : échec de compilation.
- [ ] **Step 3: Implémenter** — `http.MaxBytesReader(w, r.Body, 4096)`, `json.Decoder` avec
  `DisallowUnknownFields` ; admin via `r.BasicAuth()` (utilisateur ignoré) et
  `subtle.ConstantTimeCompare`. Messages : « Pronostic invalide. » (JSON illisible),
  « Trop de pronostics enregistrés. » (507), « Mot de passe incorrect. » (401),
  « Administration non configurée. » (503), « Pronostic introuvable. » (404),
  « Route inconnue. » (404).
- [ ] **Step 4: Lancer** `go test -race ./... && golangci-lint run` — attendu : PASS, 0 issue.
- [ ] **Step 5: Commit** — `feat(backend): API des pronostics et administration`

### Task 4: Serveur (config, front embarqué, en-têtes, /version)

**Files:**
- Create: `backend/main.go`, `backend/config.go`, `backend/spa.go`, `backend/web/browser/.gitkeep`
- Modify: `.gitignore` (ajouter `backend/web/browser/*`, `!backend/web/browser/.gitkeep`, `tmp/`)
- Test: `backend/config_test.go`, `backend/spa_test.go`

**Interfaces:**
- Consumes: `predictions.Open`, `predictions.Handlers` (Tasks 2-3) ;
  `github.com/mgarnier-home/utils/version.Handler()` (`go get github.com/mgarnier-home/utils@v1.4.0`).
- Produces:
  - `type Config struct { AdminPassword, DataPath, Port string }`
  - `func loadConfig(getenv func(string) string) Config` : défauts `/data/predictions.json`, `8080`.
  - `func spaHandler(fsys fs.FS) http.Handler` : comme `../homepage/backend/spa.go`, plus les
    `Cache-Control` de la spec (`index.html` et repli : `no-cache` ; `*.js`/`*.css` :
    `public, max-age=31536000, immutable` ; `assets/` : `public, max-age=3600`).
  - `func securityHeaders(next http.Handler) http.Handler` : `X-Robots-Tag: noindex, nofollow`,
    `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
  - `main` : `//go:embed all:web/browser`, `mux` = `GET /version` + `Handlers.Register` +
    `/` spa ; le tout enveloppé par `securityHeaders` ; `slog.Warn` si mot de passe vide.

- [ ] **Step 1: Écrire les tests** — `TestLoadConfigDefaults`, `TestLoadConfigOverrides` ;
  `spa_test.go` sur `fstest.MapFS{"index.html", "main-abc.js", "assets/map.webp"}` :
  `/pronostics` → contenu de `index.html` + `no-cache` ; `/main-abc.js` → `immutable` ;
  `/assets/map.webp` → `max-age=3600` ; `securityHeaders` pose les trois en-têtes sur une réponse
  quelconque (y compris un 404 `/api`).
- [ ] **Step 2: Lancer** `go test ./...` — attendu : échec de compilation.
- [ ] **Step 3: Implémenter** les fichiers ci-dessus.
- [ ] **Step 4: Vérifier** — `go test -race ./... && golangci-lint run` PASS ; puis
  `POTIXX_ADMIN_PASSWORD=dev POTIXX_DATA_PATH=../tmp/p.json go run .` et
  `curl -si localhost:8080/version` → 200 JSON avec `X-Robots-Tag` ; `curl -si -X POST
  localhost:8080/api/predictions -d '{}'` → 400 JSON.
- [ ] **Step 5: Commit** — `feat(backend): serveur Go, front embarqué et route /version`

### Task 5: Image Docker

**Files:**
- Modify: `Dockerfile` (réécriture sur le modèle de `../visite/Dockerfile`), `.dockerignore`
- Delete: `nginx.conf`

**Interfaces:**
- Consumes: `npm run build` → `dist/potixx/browser` ; binaire `backend` (Task 4).
- Produces: image écoutant sur 8080, utilisateur 10001:10001, `VOLUME /data`, build-args
  `VERSION`, `COMMIT`, `DATE` injectés dans `github.com/mgarnier-home/utils/buildinfo.*`.

- [ ] **Step 1: Réécrire le Dockerfile** — trois étapes (images épinglées par digest comme visite) :
  node `npm ci` + `npm run build` (garder `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`) ; golang
  `--platform=$BUILDPLATFORM`, copie de `dist/potixx/browser/` dans `web/browser/`,
  `CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -ldflags …` ; alpine avec
  `ENV POTIXX_DATA_PATH=/data/predictions.json`, healthcheck
  `wget -qO- http://localhost:8080/version`.
- [ ] **Step 2: `.dockerignore`** — garder l'existant, ajouter `tmp`, `backend/web/browser`.
- [ ] **Step 3: Vérifier** — `docker build --build-arg VERSION=0.1.0-dev -t potixx:dev .` puis
  `docker run --rm -d -p 8080:8080 -e POTIXX_ADMIN_PASSWORD=dev --name potixx-dev potixx:dev` :
  `curl -s localhost:8080/version` contient `0.1.0-dev` ; `curl -sI localhost:8080/` → 200 +
  `X-Robots-Tag` ; un POST valide → 201 ; `docker stop potixx-dev`.
- [ ] **Step 4: Commit** — `build: image Go multi-étapes à la place de nginx`

### Task 6: Contenu, validation et API côté front

**Files:**
- Create: `src/app/predictions/prediction-content.ts`
- Create: `src/app/predictions/core/prediction.ts`
- Create: `src/app/predictions/predictions-api.ts`
- Modify: `src/app/app.config.ts` (`provideHttpClient(withFetch())`)
- Test: `src/app/predictions/core/prediction.spec.ts`, `src/app/predictions/predictions-api.spec.ts`

**Interfaces:**
- Produces:
  - `prediction-content.ts` : `PREDICTION_LIMITS` (mêmes bornes que Go),
    `SEXES: readonly {value: Sex; label: string}[]` (Fille / Garçon),
    `EYE_COLORS: readonly {value: EyeColor; label: string}[]` (Bleus, Verts, Marron, Gris, Noisette).
  - `core/prediction.ts` : `type Sex = "girl" | "boy"`, `type EyeColor = "blue" | "green" | "brown" | "grey" | "hazel"`,
    `interface PredictionInput { name; sex; birthDate; heightCm; weightKg; eyeColor; firstName }`,
    `interface Prediction extends PredictionInput { id: string; createdAt: string }`,
    `type PredictionErrors = Partial<Record<keyof PredictionInput, string>>`,
    `function validatePrediction(value: PredictionFormValue): PredictionErrors` où
    `PredictionFormValue` a les mêmes clés mais `sex`, `eyeColor` en `string`, et `heightCm`,
    `weightKg` en `number | null`,
    `function basicAuthHeader(password: string): string` → `"Basic " + base64(UTF-8(":" + password))`.
  - `predictions-api.ts` : `@Injectable({providedIn: "root"}) class PredictionsApi` avec
    `create(input: PredictionInput): Observable<Prediction>`,
    `list(password: string): Observable<Prediction[]>`,
    `remove(id: string, password: string): Observable<void>`.

- [ ] **Step 1: Écrire les tests** — `validatePrediction` : mêmes cas limites que Task 1 (nom
  « é »×60 ok / ×61 erreur, date `2027-02-30` erreur, poids 3.45 erreur, 6.9 ok, champ `null`
  → message « Champ obligatoire. »), message attendu sous chaque clé ; la date est validée comme
  chaîne (le test tourne aussi avec `TZ=Pacific/Kiritimati npm test`).
  `basicAuthHeader("pa:ss-é")` === `"Basic " + Buffer.from(":pa:ss-é").toString("base64")`.
  `PredictionsApi` avec `HttpTestingController` : `create` → `POST /api/predictions` ;
  `list("x")` → `GET /api/admin/predictions` avec l'en-tête `Authorization` ; `remove` → `DELETE`.
- [ ] **Step 2: Lancer** `npm test` — attendu : échec (modules absents).
- [ ] **Step 3: Implémenter** — base64 UTF-8 via
  `btoa(String.fromCharCode(...new TextEncoder().encode(s)))`.
- [ ] **Step 4: Lancer** `npm test && npm run lint` — attendu : PASS.
- [ ] **Step 5: Commit** — `feat(front): validation et client API des pronostics`

### Task 7: Router, onglets et page de la chasse

**Files:**
- Create: `src/app/app.routes.ts`, `src/app/hunt/hunt.ts`, `hunt.html`, `hunt.scss`
- Modify: `src/app/app.ts`, `app.html`, `app.scss`, `app.config.ts` (`provideRouter(routes)`)
- Move: `src/app/app.spec.ts` → `src/app/hunt/hunt.spec.ts` (tests de la chasse sur `Hunt`) ;
  nouveau `src/app/app.spec.ts` pour les onglets.

**Interfaces:**
- Consumes: composants existants de `hunt/`.
- Produces: `export const routes: Routes` — `""` → `Hunt`, `"pronostics"` →
  `PredictionForm` (lazy `loadComponent`), `"admin"` → `Admin` (lazy), `"**"` → redirection `""`.
  Cette tâche crée `PredictionForm` (`predictions/prediction-form/prediction-form.ts`,
  `selector: app-prediction-form`) et `Admin` (`predictions/admin/admin.ts`,
  `selector: app-admin`) avec un template vide ; les Tasks 8 et 9 les remplissent.
  `data-testid` : `tab-hunt`, `tab-predictions`.

- [ ] **Step 1: Déplacer** le contenu de `App` (signal `openStep`, méthodes, template, styles
  `.map-screen`…) dans `Hunt` (`selector: app-hunt`) sans le modifier ; adapter `hunt.spec.ts`
  (`TestBed.createComponent(Hunt)`) et le lancer — attendu : PASS (même comportement).
- [ ] **Step 2: Écrire `app.spec.ts`** — avec `provideRouter(routes)` et `RouterTestingHarness` :
  `/` affiche `app-hunt` et `tab-hunt` porte `aria-current="page"` ; clic sur `tab-predictions`
  → `app-prediction-form` présent et `aria-current` déplacé ; `/admin` → `app-admin`, aucun
  onglet actif ; `/nimporte` → `app-hunt`.
- [ ] **Step 3: Lancer** `npm test` — attendu : échec des tests d'onglets.
- [ ] **Step 4: Implémenter** `App` : `<nav>` avec deux `routerLink` (`routerLinkActive="active"`,
  `ariaCurrentWhenActive="page"`, `[routerLinkActiveOptions]="{exact: true}"` sur `/`) puis
  `<router-outlet />`. Styles parchemin repris des variables de `src/styles.scss`, cibles ≥ 32 px.
- [ ] **Step 5: Lancer** `npm test && npm run lint && npm run format:check && npm run e2e` —
  attendu : PASS (la suite E2E existante part de `/`).
- [ ] **Step 6: Vérifier visuellement** avec la skill `verifier-dans-le-navigateur` (onglets en
  390×844 et 1280×800, énigme ouverte sous les onglets, aucune erreur console).
- [ ] **Step 7: Commit** — `feat(front): onglets et page dédiée à la chasse au trésor`

### Task 8: Onglet Pronostics

**Files:**
- Modify: `src/app/predictions/prediction-form/prediction-form.ts`, `.html`, `.scss`
- Create: `proxy.conf.json` ; Modify: `angular.json` (`serve.options.proxyConfig`)
- Test: `src/app/predictions/prediction-form/prediction-form.spec.ts`

**Interfaces:**
- Consumes: `validatePrediction`, `PREDICTION_LIMITS`, `SEXES`, `EYE_COLORS`, `PredictionsApi.create` (Task 6).
- Produces: composant `PredictionForm`. `data-testid` : `prediction-name`, `prediction-sex-girl`,
  `prediction-sex-boy`, `prediction-birth-date`, `prediction-height`, `prediction-weight`,
  `prediction-eye-<value>`, `prediction-first-name`, `prediction-submit`, `prediction-error`
  (erreur globale), `prediction-thanks`. Erreur de champ : `prediction-<champ>-error`.

- [ ] **Step 1: Écrire les tests** (`HttpTestingController`) : envoi vide → aucune requête,
  message sous chaque champ ; saisie valide → `POST` avec un `birthDate` chaîne et des nombres,
  bouton désactivé pendant l'envoi, puis `prediction-thanks` visible et formulaire masqué ;
  réponse 400 `{"error":"Le poids …"}` → ce message dans `prediction-error`, saisie conservée ;
  réponse 500 ou réseau → « L'envoi a échoué, réessayez dans un instant. », saisie conservée.
- [ ] **Step 2: Lancer** `npm test` — attendu : échec.
- [ ] **Step 3: Implémenter** — `FormGroup` non typé `nonNullable` sauf `heightCm`/`weightKg`
  (`number | null`) ; les erreurs affichées sont `validatePrediction(form.getRawValue())`
  calculées au submit puis à chaque changement après la première tentative ; date
  `<input type="date" [min] [max]>` ; poids `step="0.1"`, `inputmode="decimal"` ; radios en
  `<fieldset>` + `<legend>`. Intro courte : « Fille ou garçon ? Quel jour ? Faites vos paris ! ».
  `proxy.conf.json` : `/api` et `/version` → `http://localhost:8080`.
- [ ] **Step 4: Lancer** `npm test && npm run lint && npm run format:check` — attendu : PASS.
- [ ] **Step 5: Vérifier visuellement** (`verifier-dans-le-navigateur`, backend lancé en local) :
  envoi réel jusqu'au remerciement ; `tmp/predictions.json` contient le pronostic.
- [ ] **Step 6: Commit** — `feat(front): onglet Pronostics`

### Task 9: Page admin

**Files:**
- Modify: `src/app/predictions/admin/admin.ts`, `.html`, `.scss`
- Test: `src/app/predictions/admin/admin.spec.ts`

**Interfaces:**
- Consumes: `PredictionsApi.list/remove`, `SEXES`, `EYE_COLORS` (libellés) (Task 6).
- Produces: composant `Admin`. `data-testid` : `admin-password`, `admin-login`, `admin-error`,
  `admin-table`, `admin-row`, `admin-delete`.

- [ ] **Step 1: Écrire les tests** : connexion → `GET` avec l'en-tête, tableau rendu (libellés
  « Fille », « Bleus », date d'envoi formatée `fr-FR`) ; 401 → « Mot de passe incorrect. » et
  champ toujours affiché ; 503 → « Administration non configurée. » ; suppression confirmée
  (`confirm` simulé) → `DELETE` puis ligne retirée ; suppression avec réponse 404 → ligne retirée
  aussi ; suppression refusée au `confirm` → aucune requête.
- [ ] **Step 2: Lancer** `npm test` — attendu : échec.
- [ ] **Step 3: Implémenter** — mot de passe et liste en signals ; tableau dans un conteneur
  `overflow-x: auto`.
- [ ] **Step 4: Lancer** `npm test && npm run lint && npm run format:check` — attendu : PASS.
- [ ] **Step 5: Vérifier visuellement** (`verifier-dans-le-navigateur`, `/admin` avec le backend
  local) en 390×844 et 1280×800.
- [ ] **Step 6: Commit** — `feat(front): page d'administration des pronostics`

### Task 10: E2E des pronostics

**Files:**
- Create: `e2e/predictions.spec.ts`

**Interfaces:**
- Consumes: `data-testid` des Tasks 7 à 9 ; `PREDICTION_LIMITS` pour les valeurs saisies.

- [ ] **Step 1: Écrire les scénarios** (API simulée par `page.route`) : depuis `/`, clic
  `tab-predictions`, URL `/pronostics`, remplir et envoyer → `prediction-thanks` et la requête
  interceptée contient les valeurs saisies ; réponse 400 simulée → message affiché ; `/admin` :
  401 puis bon mot de passe → 2 lignes, suppression → 1 ligne ; retour navigateur depuis
  `/pronostics` → carte au trésor.
- [ ] **Step 2: Lancer** `npm run e2e` — attendu : PASS sur `mobile` et `desktop`, suite de la
  chasse comprise.
- [ ] **Step 3: Commit** — `test(e2e): onglets, pronostics et administration`

### Task 11: CI et documentation

**Files:**
- Modify: `.github/workflows/test.yml`, `.github/workflows/publish.yml`
- Modify: `CLAUDE.md`, `README.md`

- [ ] **Step 1: `test.yml`** — déclencheurs `pull_request: branches: [master]` et
  `push: branches: [master]` ; job `front` = étapes actuelles ; job `back`
  (`working-directory: backend`) = `actions/setup-go@v7` (`go-version-file: backend/go.mod`,
  `cache-dependency-path: backend/go.sum`), `go vet ./...`, `go test -race ./...`,
  `golangci/golangci-lint-action@v9` `version: v2.15.0`, comme `../homepage/.github/workflows/test.yml`.
- [ ] **Step 2: `publish.yml`** — copie de `../visite/.github/workflows/publish.yml` :
  images `mgarnier11/potixx:{amd64,arm64,VERSION,latest}`, `--build-arg "VERSION=$VERSION"`
  (sans préfixe `v`, comme homepage), vérification
  `git merge-base --is-ancestor "$GITHUB_SHA" "origin/$DEFAULT_BRANCH"` avec
  `DEFAULT_BRANCH: ${{ github.event.repository.default_branch }}` en variable d'environnement.
- [ ] **Step 3: Vérifier** — `npx prettier --check .github` et `actionlint` s'il est installé.
- [ ] **Step 4: Docs** — `CLAUDE.md` : titre et périmètre (onglets, pronostics, backend Go ;
  toujours ni son ni SSR), arborescence (`backend/`, `src/app/predictions/`), commandes Go
  (`go run`, tests, lint), définition de terminé avec le backend, `noindex` posé par
  `backend/spa.go`, section Déploiement (tag `vX.Y.Z` via `tag-release X.Y.Z`, plus de secrets
  Docker Hub, variables `POTIXX_*`, volume `/data`) ; nouvelle spec en référence.
  `README.md` : mêmes commandes.
- [ ] **Step 5: Commit** — `ci: tests sur PR et publication multi-arch sur tag` puis
  `docs: backend Go, pronostics et publication sur tag`

### Task 12: dev-vms — tag-release sur la branche par défaut

Repo `/mnt/dev/dev-vms`, branche `release/v1.1.0` (PR #2 ouverte).

**Files:**
- Modify: `home/scripts/tag-release.sh`, `claude/CLAUDE.md`

- [ ] **Step 1: Script** — après la validation de version :
  `git remote set-head origin --auto >/dev/null` puis
  `branch=$(git symbolic-ref --short refs/remotes/origin/HEAD)`, `branch=${branch#origin/}` ;
  remplacer `main` par `"$branch"` dans `checkout` et `pull` ; mettre à jour le commentaire d'en-tête.
- [ ] **Step 2: Vérifier** — `shellcheck home/scripts/tag-release.sh` ; dans un clone jetable de
  potixx (scratchpad), la résolution de branche affiche `master` (exécuter uniquement les deux
  lignes de résolution, jamais le script complet qui pousserait un tag).
- [ ] **Step 3: `claude/CLAUDE.md`** — la ligne « potixx : `gh workflow run publish.yml …` »
  disparaît ; « autoscaler, homepage, visite, utils » devient « autoscaler, homepage, visite,
  utils, potixx », et la parenthèse dit « met la branche par défaut à jour ».
- [ ] **Step 4: Commit et push** — `fix: tag-release publie depuis la branche par défaut` sur
  `release/v1.1.0`, `git push`, `gh pr checks --watch`.

### Fin : PR potixx

- [ ] Définition de terminé complète, puis `git push -u origin release/v0.1.0` et
  `gh pr create --base master --title "v0.1.0 : onglets, pronostics et backend Go"` (description
  en français : changements, vérifications, déploiement orchestrator à faire après publication).
- [ ] `gh pr checks --watch` ; attention : le nouveau `test.yml` ne se déclenche que si la PR le
  contient déjà (c'est le cas) ; corriger et repousser en cas d'échec.
- [ ] Donner sans la lancer : `tag-release 0.1.0` (après fusion de la PR potixx **et** de la PR
  dev-vms #2), puis les étapes orchestrator de la spec, chacune soumise à accord.
