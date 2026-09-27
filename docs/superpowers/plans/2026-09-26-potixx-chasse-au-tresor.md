# Potixx — Chasse au trésor v1 : plan d'implémentation

> **Pour les agents :** SOUS-SKILL REQUIS : utiliser superpowers:subagent-driven-development
> (recommandé) ou superpowers:executing-plans pour exécuter ce plan tâche par tâche. Les étapes
> utilisent des cases à cocher (`- [ ]`).

**Objectif :** livrer le site d'annonce « chasse au trésor » (4 énigmes + trésor), sa
configuration Claude Code, son image Docker et sa CI.

**Architecture :** application Angular statique d'une seule page. Toute la logique métier est dans
des fonctions pures (`src/app/hunt/core/`), l'état vit dans un service à base de signals sauvegardé
dans `localStorage`, et tout le contenu éditable est dans `hunt-content.ts`. L'image Docker sert le
build avec nginx non privilégié.

**Stack :** Angular 22.2 (standalone, zoneless, SCSS), Vitest (lanceur par défaut d'Angular CLI),
`@playwright/test`, ESLint (angular-eslint), Prettier, Docker, GitHub Actions.

**Spec :** `docs/superpowers/specs/2026-09-26-potixx-chasse-au-tresor-design.md` (à lire avec ce
plan ; les numéros de section « §x » y renvoient).

## Contraintes globales

- Node `24.16.0` (`.tool-versions`). Angular `22.2.x`. Gestionnaire de paquets : npm.
- Documentation, skills et commentaires en français ; code (noms de fichiers, variables, fonctions,
  composants) en anglais.
- **Git : aucune commande d'écriture** (`git init`, `add`, `commit`, `push`). À la fin de chaque
  tâche, lister les fichiers créés ou modifiés : le propriétaire commite lui-même.
- Mobile d'abord : référence 390×844, cibles tactiles ≥ 32 px ; doit rester confortable en
  1280×800.
- `noindex` obligatoire : meta robots, `robots.txt`, en-tête `X-Robots-Tag`. Ne jamais le retirer.
- Seuil d'échecs : `3` pour toutes les énigmes (`MAX_FAILURES_BEFORE_SKIP`).
- Clé de sauvegarde : `potixx.progress.v1`.
- Image Docker : `docker.io/mgarnier11/potixx`, plateforme `linux/amd64` uniquement.
- Pas de son, pas de backend, pas de SSR.
- Tâches d'interface (7 à 12) : charger le skill `frontend-design:frontend-design` avant d'écrire
  les styles ; ambiance pirate/parchemin cohérente entre les écrans.
- Avant d'utiliser une API Angular ou Playwright dont on n'est pas sûr : consulter Context7.

## Points de vigilance pour la revue

1. **`localStorage` corrompu ou inaccessible** (JSON invalide, ancienne version, navigation privée
   qui lève une exception) : le jeu démarre de zéro sans erreur. Testé en tâche 6.
2. **Sélection des mots mêlés dans les deux sens** (toucher la dernière lettre puis la première) :
   le mot est trouvé. Une sélection non alignée ou d'une seule case ne plante pas et compte comme un
   échec. Testé en tâche 4.
3. **Clavier mobile dans les mots croisés** : minuscules, lettres accentuées (« é ») et
   effacement sur une case vide doivent donner une lettre majuscule sans accent ou reculer d'une
   case. Testé en tâche 10.
4. **Réponses avec espaces ou accents** (« Famille », « 7 » avec espace) : acceptées. Testé en
   tâches 2 et 8.
5. **Rechargement au milieu d'une énigme** : même grille de mots mêlés, mêmes lettres saisies, même
   nombre d'indices affichés. Testé en tâches 6 et 13.

---

## Structure des fichiers

```
.tool-versions, .mcp.json                          existants
CLAUDE.md                                          tâche 2
.claude/settings.json                              tâche 2 (complété)
.claude/hooks/format.sh                            tâche 2
.claude/skills/verifier-dans-le-navigateur/SKILL.md tâche 2
.claude/skills/modifier-le-contenu/SKILL.md        tâche 2
assets/map.svg, photo-us.jpg, treasure.mp4, treasure-poster.jpg   tâches 7, 8, 12
public/robots.txt                                  tâche 1
src/index.html, src/styles.scss                    tâche 1 (+7 pour les styles globaux)
src/app/app.ts|html|scss, app.config.ts            tâches 1, 7
src/app/hunt/
  hunt-content.ts                                  tâche 5
  hunt-progress.service.ts (+ .spec.ts)            tâche 6
  core/cell.ts                                     tâche 3
  core/normalize-answer.ts (+ .spec.ts)            tâche 3
  core/seeded-random.ts (+ .spec.ts)               tâche 3
  core/word-search.ts (+ .spec.ts)                 tâche 4
  core/crossword.ts (+ .spec.ts)                   tâche 5
  treasure-map/                                    tâche 7
  shared/skip-button/, shared/riddle-panel/        tâche 7
  padlock-riddle/                                  tâche 8
  password-riddle/                                 tâche 9
  crossword/                                       tâche 10
  word-search/                                     tâche 11
  treasure/                                        tâche 12
playwright.config.ts, e2e/hunt.spec.ts             tâches 7, 13
Dockerfile, nginx.conf, .dockerignore              tâche 14
.github/workflows/docker.yml                       tâche 15
```

Chaque composant vit dans son dossier : `<nom>.ts`, `<nom>.html`, `<nom>.scss`, `<nom>.spec.ts`
(convention de nommage « 2025 » d'Angular : pas de suffixe `.component`).

---

### Tâche 1 : Projet Angular et outillage

**Fichiers :**
- Créer (générés) : `package.json`, `angular.json`, `tsconfig*.json`, `src/**`, `.gitignore`,
  `.editorconfig`, `.prettierrc`, `eslint.config.js`
- Créer : `public/robots.txt`, `assets/.gitkeep`
- Modifier : `src/index.html`, `angular.json`, `package.json`, `.gitignore`

**Interfaces :**
- Produit : scripts npm `start`, `build`, `test` (Vitest, une passe), `lint`, `format`,
  `format:check`, `e2e` (ajouté en tâche 7). Les fichiers de `assets/` sont servis sous `/assets/`.

- [ ] **Étape 1 : Générer le projet dans le dossier courant**

```bash
npx -y @angular/cli@22.2 new potixx --directory . --style scss --routing false --ssr false \
  --zoneless --skip-git --ai-config none --package-manager npm
```

Attendu : projet créé sans dépôt git ; `site.md`, `activity.png`, `docs/`, `.claude/`, `.mcp.json`,
`.tool-versions` intacts. Si la CLI refuse le dossier non vide, générer dans un dossier temporaire
du scratchpad puis copier le contenu (sans `.git`) à la racine.

- [ ] **Étape 2 : Ajouter ESLint et Prettier**

```bash
npx ng add angular-eslint --skip-confirmation
npm i -D prettier
```

Scripts à ajouter dans `package.json` :
`"test": "ng test --watch=false"`, `"lint": "ng lint"`, `"format": "prettier --write ."`,
`"format:check": "prettier --check ."`.
Créer `.prettierignore` : `dist`, `.angular`, `coverage`, `test-results`, `playwright-report`,
`docs`, `site.md`.

- [ ] **Étape 3 : Brancher `assets/` et le noindex**

- `angular.json` → `build.options.assets` : ajouter
  `{ "glob": "**/*", "input": "assets", "output": "assets" }` en plus de `public`.
- `public/robots.txt` : `User-agent: *` puis `Disallow: /`.
- `src/index.html` : `<html lang="fr">`, `<title>Chasse au trésor</title>`,
  `<meta name="robots" content="noindex, nofollow">`.
- `.gitignore` : ajouter `.claude/settings.local.json`, `test-results/`, `playwright-report/`.

- [ ] **Étape 4 : Vérifier**

Run : `npm run lint && npm test && npm run build && grep -c 'noindex' dist/potixx/browser/index.html && cat dist/potixx/browser/robots.txt`
Attendu : lint OK, test par défaut OK, build OK, `1`, puis le contenu de `robots.txt`.

- [ ] **Étape 5 : Point de contrôle** — lister les fichiers créés (ne pas commiter).

---

### Tâche 2 : Configuration de Claude Code

**Fichiers :**
- Créer : `CLAUDE.md`, `.claude/hooks/format.sh`,
  `.claude/skills/verifier-dans-le-navigateur/SKILL.md`,
  `.claude/skills/modifier-le-contenu/SKILL.md`
- Modifier : `.claude/settings.json` (garder `enabledPlugins` existant)

**Interfaces :**
- Consomme : scripts npm de la tâche 1. Les chemins cités (`hunt-content.ts`, `core/`, `e2e/`) sont
  ceux de la structure ci-dessus, même s'ils n'existent pas encore.

- [ ] **Étape 1 : Écrire `CLAUDE.md`** (français, contenu listé en spec §9) : but et périmètre v1
  avec renvoi à la spec ; tableau des commandes (`npm start`, `npm test`, `npm run e2e`,
  `npm run lint`, `npm run build`, `docker build -t potixx . && docker run --rm -p 8080:8080 potixx`) ;
  arborescence ; conventions (§3 de la spec) ; « consulter Context7 pour Angular et Playwright » ;
  définition de « terminé » (lint + tests + e2e verts, puis skill `verifier-dans-le-navigateur`) ;
  interdits (git en écriture, retrait du noindex, `docker push`). Moins de 120 lignes.

- [ ] **Étape 2 : Écrire `.claude/hooks/format.sh`** (exécutable) : lit le JSON du hook sur stdin,
  extrait `tool_input.file_path` avec `node -e`, lance
  `npx prettier --write --ignore-unknown "$file"` ; sort toujours avec le code 0 (ne bloque jamais).

- [ ] **Étape 3 : Compléter `.claude/settings.json`**

```json
{
  "enabledPlugins": { "frontend-design@claude-plugins-official": true },
  "permissions": {
    "allow": [
      "Bash(npm run *)", "Bash(npm test*)", "Bash(npm ci)", "Bash(npm i *)",
      "Bash(npx ng *)", "Bash(npx playwright *)", "Bash(npx prettier *)",
      "Bash(docker build *)", "Bash(docker run *)",
      "mcp__playwright", "mcp__context7"
    ],
    "deny": [
      "Bash(git commit*)", "Bash(git push*)", "Bash(git init*)", "Bash(docker push*)",
      "Read(./.env*)"
    ]
  },
  "enableAllProjectMcpServers": true,
  "hooks": {
    "PostToolUse": [
      { "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/format.sh" }] }
    ]
  }
}
```

Vérifier la syntaxe exacte des permissions MCP et des hooks avec le skill `update-config` avant
d'écrire.

- [ ] **Étape 4 : Écrire les deux skills** (frontmatter `name` + `description` en français) :
  - `verifier-dans-le-navigateur` : quand l'utiliser (toute modification visible) ; lancer
    `npm start` en arrière-plan ; avec Playwright MCP : `browser_resize` 390×844, naviguer sur
    `http://localhost:4200`, `browser_snapshot`, capture, `browser_console_messages` (aucune
    erreur) ; recommencer en 1280×800 ; pour atteindre une énigme précise, injecter une
    progression dans `localStorage` (`potixx.progress.v1`) via `browser_evaluate` ; arrêter le
    serveur.
  - `modifier-le-contenu` : tout est dans `src/app/hunt/hunt-content.ts` (textes, réponses,
    indices, définitions, grille, mots, positions sur la carte en %) et `assets/` (noms attendus :
    `map.svg`, `photo-us.jpg`, `treasure.mp4`, `treasure-poster.jpg`) ; si les mots croisés
    changent, le test de cohérence de `crossword.spec.ts` doit passer ; changer la forme de
    `HuntProgress` impose de passer la clé à `v2` ; relancer `npm test` et `npm run e2e`.

- [ ] **Étape 5 : Vérifier**

Run : `node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'))" && echo '{"tool_input":{"file_path":"src/main.ts"}}' | .claude/hooks/format.sh; echo "exit=$?"`
Attendu : aucune erreur JSON, `exit=0`.

- [ ] **Étape 6 : Point de contrôle** — lister les fichiers (ne pas commiter). Signaler au
  propriétaire qu'un rechargement de Claude Code applique les nouvelles permissions et le hook.

---

### Tâche 3 : Fonctions de base (`cell`, `normalize-answer`, `seeded-random`)

**Fichiers :**
- Créer : `src/app/hunt/core/cell.ts`, `normalize-answer.ts`, `seeded-random.ts` et leurs `.spec.ts`

**Interfaces :**
- Produit :
  - `interface Cell { row: number; col: number }` ; `cellKey(cell: Cell): string` → `"row,col"`.
  - `normalizeAnswer(input: string): string` : NFD, suppression des diacritiques (`\p{M}`),
    minuscules, `trim()`.
  - `isCorrectAnswer(input: string, expected: string): boolean` : compare les deux normalisés.
  - `createSeededRandom(seed: number): () => number` : mulberry32, valeurs dans [0, 1).
  - `randomSeed(): number` : entier 32 bits non signé via `crypto.getRandomValues`.

- [ ] **Étape 1 : Écrire les tests**

```ts
it('normalise casse, accents et espaces', () => {
  expect(normalizeAnswer('  FaMîllé ')).toBe('famille');
});
it('accepte les variantes', () => {
  expect(isCorrectAnswer('Famille', 'famille')).toBe(true);
  expect(isCorrectAnswer(' 7 ', '7')).toBe(true);
  expect(isCorrectAnswer('familles', 'famille')).toBe(false);
});
it('même graine, même suite', () => {
  const a = createSeededRandom(42), b = createSeededRandom(42);
  expect([a(), a(), a()]).toEqual([b(), b(), b()]);
});
it('valeurs dans [0, 1)', () => {
  const r = createSeededRandom(1);
  for (let i = 0; i < 1000; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
});
it('cellKey', () => expect(cellKey({ row: 3, col: 5 })).toBe('3,5'));
```

- [ ] **Étape 2 : Lancer, vérifier l'échec** — `npm test` → FAIL (modules introuvables).
- [ ] **Étape 3 : Implémenter** les signatures ci-dessus.
- [ ] **Étape 4 : Lancer** — `npm test` → PASS.
- [ ] **Étape 5 : Point de contrôle** — lister les fichiers.

---

### Tâche 4 : Générateur de mots mêlés

**Fichiers :**
- Créer : `src/app/hunt/core/word-search.ts`, `word-search.spec.ts`

**Interfaces :**
- Consomme : `Cell`, `createSeededRandom`.
- Produit :

```ts
export type Direction = 'right' | 'down' | 'down-right' | 'down-left';
export interface PlacedWord { word: string; cells: Cell[] }
export interface WordSearchGrid { size: number; seed: number; letters: string[][]; words: PlacedWord[] }
export function generateWordSearch(words: readonly string[], size: number, seed: number): WordSearchGrid;
export function findWordAt(grid: WordSearchGrid, from: Cell, to: Cell): PlacedWord | null;
```

`seed` dans le résultat est la graine réellement utilisée (voir l'algorithme).

- [ ] **Étape 1 : Écrire les tests** (liste de mots de la spec §4.6, taille `10`) :
  - `places all 10 words for 200 seeds` : pour chaque graine 1..200, `words.length === 10`, la
    grille fait 10×10, chaque case contient une lettre `A-Z`, et les lettres aux `cells` de chaque
    mot reforment le mot.
  - `only uses allowed directions` : pour chaque mot, le pas entre deux cases consécutives est
    `(0,1)`, `(1,0)`, `(1,1)` ou `(1,-1)`.
  - `is deterministic` : `generateWordSearch(w, 10, 7)` deux fois → `toEqual`.
  - `regenerates identically from the returned seed` : `g = generate(w,10,s)` puis
    `generate(w,10,g.seed)` → mêmes `letters`.
  - `findWordAt matches both ends in either order` : pour un mot placé, `(first, last)` et
    `(last, first)` renvoient ce mot.
  - `findWordAt returns null` pour une case unique, deux cases non alignées, et un segment qui
    n'est pas un mot.
- [ ] **Étape 2 : Lancer, vérifier l'échec.**
- [ ] **Étape 3 : Implémenter.** Algorithme imposé :
  - pour `attempt` de 0 à 49 : `s = (seed + attempt * 0x9e3779b9) >>> 0`, `rand = createSeededRandom(s)` ;
  - trier les mots du plus long au plus court ; pour chaque mot, lister toutes les positions
    (case de départ × direction) qui tiennent dans la grille et dont les cases sont vides ou
    contiennent déjà la même lettre ; mélanger cette liste avec `rand` (Fisher-Yates) ; prendre la
    première ; si aucune, passer à l'`attempt` suivant ;
  - si tous les mots sont placés : remplir les cases vides avec des lettres `A-Z` tirées par
    `rand`, renvoyer la grille avec `seed: s` ;
  - après 50 échecs : lever une `Error`.
- [ ] **Étape 4 : Lancer** — `npm test` → PASS.
- [ ] **Étape 5 : Point de contrôle.**

---

### Tâche 5 : Contenu et logique des mots croisés

**Fichiers :**
- Créer : `src/app/hunt/core/crossword.ts`, `crossword.spec.ts`, `src/app/hunt/hunt-content.ts`

**Interfaces :**
- Consomme : `Cell`, `cellKey`.
- Produit (`crossword.ts`) :

```ts
export type Orientation = 'across' | 'down';
export interface CrosswordEntry { number: number; answer: string; orientation: Orientation; start: Cell; clue: string }
export interface CrosswordDefinition { rows: number; cols: number; entries: CrosswordEntry[]; highlight: Cell[]; hiddenWord: string }
export interface CrosswordCheck { wrongEntries: number[]; solved: boolean }
export function entryCells(entry: CrosswordEntry): Cell[];
export function buildSolution(def: CrosswordDefinition): Map<string, string>; // cellKey → lettre ; lève une Error si deux mots se contredisent
export function prefilledCells(def: CrosswordDefinition): Map<string, string>; // cases '-'
export function checkCrossword(def: CrosswordDefinition, letters: Record<string, string>): CrosswordCheck;
```

`checkCrossword` : une entrée est fausse si une de ses cases (hors `-`) est vide ou différente de
la solution ; `solved` si aucune entrée fausse.

- Produit (`hunt-content.ts`) :

```ts
export type StepId = 'padlock' | 'password' | 'crossword' | 'wordSearch' | 'treasure';
export const STEP_ORDER: readonly StepId[];               // dans cet ordre
export const MAX_FAILURES_BEFORE_SKIP = 3;
export const PADLOCK_RIDDLES: readonly { question: string; answer: string }[];
export type PasswordClue = { kind: 'image'; src: string; alt: string } | { kind: 'text'; text: string } | { kind: 'rebus'; parts: string[] };
export const PASSWORD: { answer: string; clues: readonly PasswordClue[] };
export const CROSSWORD: CrosswordDefinition;
export const WORD_SEARCH: { size: number; words: readonly string[] };
export const TREASURE: { videoSrc: string; posterSrc: string; message: string };
export const MAP: { imageSrc: string; steps: Record<StepId, { x: number; y: number; label: string }> };
```

Valeurs : recopier exactement la spec — §4.3 (énoncés et réponses du cadenas, « Je corresponds… »),
§4.4 (réponse `famille`, indices `image` `/assets/photo-us.jpg`, `text`, puis `rebus`
`['♪ Fa', '+', '1000']`), §4.5 (10×14 : `rows: 14`, `cols: 10`, 9 entrées avec départ, sens et
définition ; `highlight` = les 9 cases dans l'ordre ; `hiddenWord: 'AGRANDIRA'`), §4.6 (taille 10,
10 mots), §4.7 (`/assets/treasure.mp4`, `/assets/treasure-poster.jpg`, message exact). `MAP` :
`imageSrc: '/assets/map.svg'` ; positions provisoires, ajustées en tâche 7.

- [ ] **Étape 1 : Écrire les tests** (sur `CROSSWORD` réel) :
  - `content is consistent` : `buildSolution(CROSSWORD)` ne lève pas (les croisements
    concordent) ; toutes les cases sont dans la grille 14×10.
  - `highlight spells AGRANDIRA` : lettres de la solution aux cases de `highlight` jointes →
    `'AGRANDIRA'`.
  - `intersections from activity.png` : la solution vaut `S` en `3,1`, `R` en `3,5`, `N` en `5,5`,
    `-` en `7,5`, `A` en `7,2`, `R` en `9,2`, `E` en `9,5`, `A` en `11,0`, `I` en `11,2`.
  - `checkCrossword` : grille vide → les 9 entrées fausses ; solution complète → `solved: true` ;
    solution avec COUSIN modifié → `wrongEntries: [1]`.
  - `prefilledCells` → exactement `7,5` avec `-`.
- [ ] **Étape 2 : Lancer, vérifier l'échec.**
- [ ] **Étape 3 : Implémenter** `crossword.ts` puis `hunt-content.ts`.
- [ ] **Étape 4 : Lancer** — `npm test` → PASS.
- [ ] **Étape 5 : Point de contrôle.**

---

### Tâche 6 : Service de progression

**Fichiers :**
- Créer : `src/app/hunt/hunt-progress.service.ts`, `hunt-progress.service.spec.ts`

**Interfaces :**
- Consomme : tout `hunt-content.ts`, `isCorrectAnswer`, `generateWordSearch`, `findWordAt`,
  `checkCrossword`, `buildSolution`, `randomSeed`, `Cell`.
- Produit :

```ts
export const PROGRESS_STORAGE = new InjectionToken<Storage | null>(...); // défaut : localStorage, ou null si l'accès lève
export const STORAGE_KEY = 'potixx.progress.v1';
export type RiddleId = Exclude<StepId, 'treasure'>;
export interface HuntProgress {
  version: 1;
  padlock:    { digitIndex: number; failures: number; solved: boolean };  // failures remis à 0 à chaque chiffre
  password:   { failures: number; solved: boolean };                      // indices affichés = min(failures + 1, clues.length)
  crossword:  { letters: Record<string, string>; locked: number[]; failures: number; solved: boolean }; // locked = numéros des mots justes
  wordSearch: { seed: number; found: string[]; failures: number; solved: boolean };
}
@Injectable({ providedIn: 'root' }) export class HuntProgressService {
  readonly progress: Signal<HuntProgress>;
  readonly currentStep: Signal<StepId>;                // première énigme non résolue, sinon 'treasure'
  readonly wordSearchGrid: Signal<WordSearchGrid>;     // recalculée depuis progress.wordSearch.seed
  isUnlocked(step: StepId): boolean;                   // index(step) <= index(currentStep)
  canSkip(riddle: RiddleId): boolean;                  // failures >= MAX_FAILURES_BEFORE_SKIP
  answerPadlockDigit(input: string): boolean;
  answerPassword(input: string): boolean;
  setCrosswordLetter(key: string, letter: string): void; // letter '' efface ; ignore les cases préremplies et celles des mots verrouillés
  checkCrossword(): CrosswordCheck;                    // verrouille les mots justes ; +1 échec si non résolu ; solved sinon
  selectWordSearch(from: Cell, to: Cell): boolean;     // +1 échec si null ou déjà trouvé ; solved quand 10 trouvés
  skip(riddle: RiddleId): void;
  restart(): void;                                     // nouvel état, nouvelle graine
}
```

`skip` : `padlock` → révèle le chiffre en cours, passe au suivant (échecs à 0), `solved` après le
4ᵉ ; `password` → `solved` ; `crossword` → `letters` = solution complète, `solved` ;
`wordSearch` → `found` = tous les mots, `solved`. `skip` ne fait rien si `canSkip` est faux.
Au démarrage, `seed` de l'état neuf = `generateWordSearch(words, 10, randomSeed()).seed`.
Sauvegarde : `effect()` qui écrit `JSON.stringify(progress())` à chaque changement, dans un
`try/catch` silencieux. Chargement : `JSON.parse` dans un `try/catch` ; rejeter si `version !== 1`
ou si une des quatre clés manque ou n'est pas un objet → état neuf.

- [ ] **Étape 1 : Écrire les tests** (TestBed, `PROGRESS_STORAGE` fourni par un faux `Storage` en
  mémoire ; `TestBed.tick()` pour déclencher l'effet) :
  - `starts at padlock` : `currentStep()` = `'padlock'`, seul `padlock` débloqué.
  - `padlock: 4 bonnes réponses` (`'0'`, `' 4'`, `'2'`, `'7'`) → `solved`, `currentStep()` =
    `'password'`.
  - `padlock: skip after 3 failures` : 2 échecs → `canSkip` faux ; 3ᵉ → vrai ; `skip` →
    `digitIndex` = 1, `failures` = 0.
  - `password: accepts 'Famille'` ; 3 échecs → `canSkip('password')` vrai.
  - `crossword: check with errors counts a failure` ; `setCrosswordLetter('7,5', 'X')` ignoré ;
    COUSIN juste puis `checkCrossword()` → `locked` contient `1` et `setCrosswordLetter('0,1', 'X')`
    est ignoré ;
    toutes les lettres justes → `checkCrossword().solved` et `progress().crossword.solved`.
  - `wordSearch: selecting a placed word marks it found` (via `wordSearchGrid()`), resélection →
    `false` et +1 échec ; tous trouvés → `solved`.
  - `persists and restores` : après quelques actions et `TestBed.tick()`, un nouveau service avec
    le même stockage a le même `progress()` et le même `wordSearchGrid().letters`.
  - `ignores corrupted storage` : valeurs `'{oops'`, `'{"version":0}'`, `'{"version":1}'` → état
    neuf, aucune exception.
  - `works without storage` : `PROGRESS_STORAGE` = `null`, et un `Storage` dont `setItem` lève →
    aucune exception.
  - `restart` → état neuf, graine différente (graine injectée via un espion sur `randomSeed` ou
    fournie par un token `SEED_FACTORY` si plus simple).
- [ ] **Étape 2 : Lancer, vérifier l'échec.**
- [ ] **Étape 3 : Implémenter.**
- [ ] **Étape 4 : Lancer** — `npm test` → PASS.
- [ ] **Étape 5 : Point de contrôle.**

---

### Tâche 7 : Carte, panneau d'énigme, bouton « Passer » et socle E2E

**Fichiers :**
- Créer : `src/app/hunt/treasure-map/*`, `src/app/hunt/shared/riddle-panel/*`,
  `src/app/hunt/shared/skip-button/*`, `assets/map.svg`, `playwright.config.ts`,
  `e2e/hunt.spec.ts`
- Modifier : `src/app/app.ts|html|scss`, `src/styles.scss`, `hunt-content.ts` (positions `MAP`),
  `package.json` (script `e2e`)

**Interfaces :**
- Consomme : `HuntProgressService`, `MAP`, `STEP_ORDER`.
- Produit :
  - `App` : `openStep = signal<StepId | null>(null)` ; affiche `TreasureMap` si `null`, sinon le
    composant de l'étape dans un `RiddlePanel`.
  - `TreasureMap` : `output stepSelected: StepId` ; émet seulement pour une étape débloquée.
    Chaque étape est un `<button>` avec `data-testid="step-<id>"` et un `aria-label` = libellé ;
    classes d'état `locked` / `current` / `solved`.
  - `RiddlePanel` : `input title: string` ; `output closed` ; bouton « Retour à la carte »
    (`data-testid="back-to-map"`) ; contenu projeté.
  - `SkipButton` : `input visible: boolean` ; `output skipped` ; libellé « Passer l'énigme »,
    `data-testid="skip"`.
  - Les composants d'énigme (tâches 8 à 12) exposent tous `output solved` ; `App` revient à la
    carte à la réception. Ouverts sur une énigme déjà résolue, ils affichent son état final
    (spec §4.2) sans rien émettre.
- `assets/map.svg` : parchemin illustré (bords usés, mer, île, chemin en pointillés, rose des
  vents), format portrait 3:4 ; les 5 positions `MAP.steps` (en %) sont placées sur le chemin, le
  trésor marqué d'une croix.
- Playwright : projets `mobile` (`devices['iPhone 13']` avec `browserName: 'chromium'`) et
  `desktop` (Chromium 1280×800) ; `webServer` : `npm start` sur `http://localhost:4200`,
  `reuseExistingServer: !process.env.CI`. Script : `"e2e": "playwright test"`.

- [ ] **Étape 1 : Tests composant** (`treasure-map.spec.ts`) : au départ, `step-padlock` a la
  classe `current` et les autres `locked` ; clic sur `step-password` n'émet rien ; clic sur
  `step-padlock` émet `'padlock'`. (`skip-button.spec.ts`) : invisible si `visible` faux.
- [ ] **Étape 2 : Lancer, vérifier l'échec.**
- [ ] **Étape 3 : Implémenter** les composants, la carte SVG et les styles globaux (charger le
  skill `frontend-design:frontend-design` d'abord).
- [ ] **Étape 4 : E2E de base** : `npm i -D @playwright/test && npx playwright install chromium`,
  puis dans `e2e/hunt.spec.ts` : `map shows the first step` (page d'accueil,
  `step-padlock` visible, meta robots `noindex, nofollow` présente).
- [ ] **Étape 5 : Lancer** — `npm test && npm run e2e` → PASS sur les deux projets.
- [ ] **Étape 6 : Vérification visuelle** — skill `verifier-dans-le-navigateur` (carte en mobile
  et ordinateur, aucune erreur console).
- [ ] **Étape 7 : Point de contrôle.**

---

### Tâche 8 : Énigme 1 — Le cadenas

**Fichiers :** créer `src/app/hunt/padlock-riddle/*`.

**Interfaces :** consomme `HuntProgressService` (`progress().padlock`, `answerPadlockDigit`,
`canSkip('padlock')`, `skip('padlock')`), `PADLOCK_RIDDLES`, `SkipButton`. Produit
`PadlockRiddle` (`output solved`). `data-testid` : `padlock-question`, `padlock-input`
(`inputmode="numeric"`, `maxlength="1"`), `padlock-submit`, `padlock-digit-0..3`.

- [ ] **Étape 1 : Tests composant** : affiche `PADLOCK_RIDDLES[0].question` ; saisir `0` et
  valider → affiche la 2ᵉ question et `padlock-digit-0` contient `0` ; mauvaise réponse → message
  d'erreur, question inchangée ; 3 mauvaises réponses → `skip` visible ; après les 4 chiffres,
  `solved` est émis après l'animation d'ouverture (`vi.useFakeTimers()`, l'application est
  sans zone.js donc pas de `fakeAsync`) ; ouvert avec `padlock.solved` vrai → cadenas ouvert
  0-4-2-7 affiché.
- [ ] **Étape 2 : Lancer, vérifier l'échec.**
- [ ] **Étape 3 : Implémenter** (cadenas dessiné en SVG/CSS, 4 molettes, animation d'ouverture
  ≤ 1,5 s ; brancher dans `App`).
- [ ] **Étape 4 : Lancer** — `npm test` → PASS.
- [ ] **Étape 5 : Vérification visuelle** (skill).
- [ ] **Étape 6 : Point de contrôle.**

---

### Tâche 9 : Énigme 2 — Le mot de passe

**Fichiers :** créer `src/app/hunt/password-riddle/*`, `assets/photo-us.jpg` (provisoire).

**Interfaces :** consomme `progress().password`, `answerPassword`, `canSkip('password')`,
`skip('password')`, `PASSWORD`, `SkipButton`. Produit `PasswordRiddle` (`output solved`).
`data-testid` : `password-clue-<index>`, `password-input`, `password-submit`.

- [ ] **Étape 1 : Tests composant** : seul `password-clue-0` (l'image) visible au départ ; une
  erreur → `password-clue-1` visible ; deux → `password-clue-2` (rebus) ; trois → `skip` visible ;
  `FAMILLE` → `solved` émis.
- [ ] **Étape 2 : Lancer, vérifier l'échec.**
- [ ] **Étape 3 : Implémenter** ; photo provisoire générée avec
  `docker run --rm -v "$PWD/assets:/out" jrottenberg/ffmpeg:7.1-alpine -f lavfi -i "color=c=0xC8A165:s=800x600,drawtext=text='Photo de nous':fontsize=48:x=(w-tw)/2:y=(h-th)/2" -frames:v 1 /out/photo-us.jpg`
  (si `drawtext` n'est pas disponible, retirer le filtre). Rebus : trois blocs visuels
  (♪ Fa, +, 1000).
- [ ] **Étape 4 : Lancer** — `npm test` → PASS.
- [ ] **Étape 5 : Vérification visuelle** (skill).
- [ ] **Étape 6 : Point de contrôle.**

---

### Tâche 10 : Énigme 3 — Les mots croisés

**Fichiers :** créer `src/app/hunt/crossword/*`.

**Interfaces :** consomme `CROSSWORD`, `entryCells`, `prefilledCells`, `buildSolution`,
`progress().crossword`, `setCrosswordLetter`, `checkCrossword()`, `canSkip('crossword')`,
`skip('crossword')`. Produit `Crossword` (`output solved`). `data-testid` : `cw-cell-<row>-<col>`
(cases blanches seulement), `cw-clue-<number>`, `cw-input` (champ caché, `autocapitalize="characters"`,
`autocomplete="off"`), `cw-check`, `cw-hidden-word`.

Règles d'interaction (spec §4.5) : sélection = entrée active + case active ; toucher une case déjà
active qui appartient à deux entrées bascule d'orientation ; saisie d'une lettre →
`normalizeAnswer(letter).toUpperCase()`, ignorée si hors `A-Z`, puis avance à la case suivante de
l'entrée en sautant les cases préremplies ; effacement → vide la case, ou recule si elle est déjà
vide. Les entrées fausses après « Vérifier » ont la classe `wrong` jusqu'à la prochaine
modification d'une de leurs cases. Résolu → illuminer les cases de `highlight` une à une
(≈ 250 ms d'intervalle), afficher `AGRANDIRA` dans `cw-hidden-word`, puis bouton « Continuer »
qui émet `solved`. Grille : 10 colonnes qui tiennent dans 358 px en mobile.

- [ ] **Étape 1 : Tests composant** : 9 définitions affichées ; la case `7-5` affiche `-` et
  n'est pas éditable ; clic sur `cw-clue-1` puis saisie `c`, `o` → `0,1` = `C`, `1,1` = `O` ;
  saisie `é` dans une case → `E` ; effacement sur case vide → recule ; « Vérifier » sur grille
  incomplète → au moins une case avec la classe `wrong` ; un mot juste vérifié n'est plus
  modifiable ; grille complète juste →
  `cw-hidden-word` contient `AGRANDIRA`.
- [ ] **Étape 2 : Lancer, vérifier l'échec.**
- [ ] **Étape 3 : Implémenter.**
- [ ] **Étape 4 : Lancer** — `npm test` → PASS.
- [ ] **Étape 5 : Vérification visuelle** (skill), dont la saisie au clavier virtuel simulé en
  390×844.
- [ ] **Étape 6 : Point de contrôle.**

---

### Tâche 11 : Énigme 4 — Les mots mêlés

**Fichiers :** créer `src/app/hunt/word-search/*`.

**Interfaces :** consomme `wordSearchGrid()`, `progress().wordSearch`, `selectWordSearch`,
`canSkip('wordSearch')`, `skip('wordSearch')`, `WORD_SEARCH`. Produit `WordSearch`
(`output solved`). `data-testid` : `ws-cell-<row>-<col>`, `ws-word-<WORD>` (classe `found`).

Interaction : 1ᵉʳ toucher = case d'ancrage (surlignée) ; 2ᵉ toucher = appel à
`selectWordSearch(ancre, case)` puis remise à zéro de l'ancre ; toucher de nouveau l'ancre
l'annule sans compter d'échec. Les mots trouvés restent surlignés sur la grille (une couleur
par mot). Résolu → bouton « Continuer » qui émet `solved`.

- [ ] **Étape 1 : Tests composant** (graine fixée via le stockage de test) : 100 cases, 10 mots
  listés ; toucher la 1ʳᵉ puis la dernière case d'un mot placé → `ws-word-<mot>` a la classe
  `found` ; ordre inverse → idem pour un autre mot ; toucher deux fois la même case → aucun échec ;
  3 sélections invalides → `skip` visible.
- [ ] **Étape 2 : Lancer, vérifier l'échec.**
- [ ] **Étape 3 : Implémenter.**
- [ ] **Étape 4 : Lancer** — `npm test` → PASS.
- [ ] **Étape 5 : Vérification visuelle** (skill).
- [ ] **Étape 6 : Point de contrôle.**

---

### Tâche 12 : Le trésor

**Fichiers :** créer `src/app/hunt/treasure/*`, `assets/treasure.mp4`,
`assets/treasure-poster.jpg` (provisoires).

**Interfaces :** consomme `TREASURE`, `restart()`. Produit `Treasure`. `data-testid` :
`treasure-chest`, `treasure-video`, `treasure-message`, `restart`.

Comportement : animation d'ouverture du coffre (≤ 2 s), puis vidéo (`muted`, `playsinline`,
`controls`, `poster`) et message exact de `TREASURE.message`. « Recommencer » →
`confirm('Recommencer la chasse depuis le début ?')` ; si oui, `restart()` et retour à la carte
(`output restarted`, géré par `App`).

- [ ] **Étape 1 : Tests composant** : `treasure-message` = « Notre famille s'agrandira en Avril
  2027 » ; la vidéo a `muted` et `playsinline` ; `restart` avec `confirm` → `false` ne fait rien,
  → `true` appelle `restart()` et émet `restarted`.
- [ ] **Étape 2 : Lancer, vérifier l'échec.**
- [ ] **Étape 3 : Implémenter** ; médias provisoires :
  `docker run --rm -v "$PWD/assets:/out" jrottenberg/ffmpeg:7.1-alpine -f lavfi -i testsrc2=s=720x1280:d=5 -pix_fmt yuv420p -movflags +faststart /out/treasure.mp4`
  puis la première image en `treasure-poster.jpg` (`-i /out/treasure.mp4 -frames:v 1`).
- [ ] **Étape 4 : Lancer** — `npm test` → PASS.
- [ ] **Étape 5 : Vérification visuelle** (skill).
- [ ] **Étape 6 : Point de contrôle.**

---

### Tâche 13 : Scénarios E2E complets

**Fichiers :** modifier `e2e/hunt.spec.ts` ; créer `e2e/helpers.ts`.

**Interfaces :** consomme tous les `data-testid` des tâches 7 à 12. `helpers.ts` : fonctions
`solvePadlock(page)`, `solvePassword(page)`, `solveCrossword(page)`, `solveWordSearch(page)`,
`skipRiddle(page, failAction)`. `localStorage` ne contient que la graine des mots mêlés :
`solveWordSearch` reconstruit la grille à partir du texte des `ws-cell-*` et y cherche chaque
mot dans les 4 directions.

- [ ] **Étape 1 : Écrire les scénarios** (spec §6) :
  1. `full hunt with correct answers` → `treasure-message` visible avec le texte exact.
  2. `full hunt by skipping every riddle` (3 échecs puis `skip` à chaque énigme, 4 fois pour le
     cadenas).
  3. `progress survives reload` : résoudre les 3 premières énigmes, trouver 1 mot mêlé, noter les
     lettres de la ligne 0, recharger → `step-wordSearch` courant ; ouvrir l'énigme : mêmes
     lettres, mot toujours `found`.
  4. `restart from treasure` → après confirmation, `step-padlock` courant.
  5. `noindex` (déjà écrit en tâche 7).
- [ ] **Étape 2 : Lancer** — `npm run e2e` → PASS sur `mobile` et `desktop`.
- [ ] **Étape 3 : Point de contrôle.**

---

### Tâche 14 : Image Docker

**Fichiers :** créer `Dockerfile`, `nginx.conf`, `.dockerignore`.

**Interfaces :** produit une image qui écoute sur `8080`.

- `Dockerfile` : étape `build` sur `node:24.16-alpine` (`npm ci`, `npm run build`) ; étape finale
  `nginxinc/nginx-unprivileged:alpine`, copie de `dist/potixx/browser` vers
  `/usr/share/nginx/html` et de `nginx.conf` vers `/etc/nginx/conf.d/default.conf`,
  `EXPOSE 8080`.
- `nginx.conf` : `listen 8080` ; `add_header X-Robots-Tag "noindex, nofollow" always;` au niveau
  `server` ; `location /` → `try_files $uri $uri/ /index.html` ; `location = /index.html` →
  `Cache-Control: no-cache` ; fichiers `*.js|*.css` hashés →
  `Cache-Control: public, max-age=31536000, immutable` ; `assets/` sans hash → `max-age=3600`.
  Répéter `add_header X-Robots-Tag` dans chaque `location` qui ajoute ses propres en-têtes (nginx
  n'hérite pas des `add_header` sinon).
- `.dockerignore` : spec §7.

- [ ] **Étape 1 : Construire et lancer**
  `docker build -t potixx:local . && docker run -d --rm -p 8080:8080 --name potixx-test potixx:local`
- [ ] **Étape 2 : Vérifier**
  `curl -sI http://localhost:8080/ | grep -iE 'x-robots|cache-control'` → `noindex, nofollow` et
  `no-cache` ; `curl -sI http://localhost:8080/une/route/inconnue` → `200` ;
  `curl -sI http://localhost:8080/robots.txt` → `200` avec `X-Robots-Tag` ;
  `curl -sI http://localhost:8080/$(ls dist/potixx/browser | grep -m1 '^main-.*\.js$')` →
  `immutable`.
- [ ] **Étape 3 : Nettoyer** — `docker stop potixx-test`.
- [ ] **Étape 4 : Point de contrôle.**

---

### Tâche 15 : Workflow GitHub

**Fichiers :** créer `.github/workflows/docker.yml`.

- Déclencheurs : `pull_request`, `push` sur `main` et tags `v*`.
- Job `test` (ubuntu-latest) : `actions/checkout`, `actions/setup-node` avec
  `node-version-file: .tool-versions` et cache npm, `npm ci`, `npm run lint`,
  `npm run format:check`, `npm test`, `npx playwright install --with-deps chromium`,
  `npm run e2e` ; en cas d'échec, `upload-artifact` de `playwright-report/`.
- Job `docker` (`needs: test`) : `docker/setup-buildx-action`, `docker/metadata-action` (images
  `docker.io/mgarnier11/potixx`, tags : `type=raw,value=latest,enable={{is_default_branch}}`,
  `type=sha`, `type=semver,pattern={{version}}`), `docker/login-action` avec
  `secrets.DOCKERHUB_USERNAME` / `secrets.DOCKERHUB_TOKEN` seulement si
  `github.event_name != 'pull_request'`, `docker/build-push-action` avec
  `platforms: linux/amd64`, `push: ${{ github.event_name != 'pull_request' }}`, cache
  `type=gha`.
- Utiliser les dernières versions majeures des actions (vérifier avec Context7 ou la page de
  chaque action).

- [ ] **Étape 1 : Écrire le workflow.**
- [ ] **Étape 2 : Valider** — `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest`
  → aucune erreur.
- [ ] **Étape 3 : Vérification finale complète** —
  `npm run lint && npm run format:check && npm test && npm run build && npm run e2e` → tout vert.
- [ ] **Étape 4 : Point de contrôle final** — lister tous les fichiers du projet à commiter et
  rappeler au propriétaire de créer les secrets `DOCKERHUB_USERNAME` et `DOCKERHUB_TOKEN`.

---

## Retours de test du propriétaire (2026-09-27)

Tâches ajoutées après les tests du propriétaire (notes de `site.md`, réponses aux questions du
2026-09-27). La spec a été révisée en conséquence (§4.4 à §4.7). Elles passent avant les tâches 14
et 15.

### Tâche 16 : Mots mêlés dans les 8 directions

**Fichiers :** modifier `src/app/hunt/core/word-search.ts` (+ spec), `e2e/helpers.ts`,
éventuellement `src/app/hunt/word-search/word-search.ts` (aperçu de ligne au survol).

**Interfaces :** `Direction` couvre les 8 directions (`right`, `left`, `down`, `up`,
`down-right`, `down-left`, `up-right`, `up-left`). Signatures de `generateWordSearch` et
`findWordAt` inchangées.

- [ ] **Étape 1 : Tests** (sur 200 graines, liste réelle de `WORD_SEARCH`) : 10 mots placés ;
  pas entre cases consécutives dans les 8 directions autorisées ; au moins 3 mots en diagonale ;
  au moins 2 mots à l'envers (pas `left`, `up`, `up-left`, `up-right`, ou toute direction dont la
  ligne ou la colonne décroît… définition retenue : un mot est « à l'envers » si sa direction a une
  composante `left` ou `up`) ; aucun mot n'apparaît ailleurs qu'à sa position placée dans aucune
  des 8 directions ; un mot palindrome (ex. `ELLE`) ajouté à la liste ne fait pas échouer la
  génération ; déterminisme et régénération depuis la graine retournée conservés ;
  `findWordAt` trouve un mot à l'envers dans les deux ordres de toucher.
- [ ] **Étape 2 : Échec vu. Étape 3 : implémenter** (mêmes règles de graine dérivée et 50
  tentatives ; une tentative est rejetée si les contraintes de diagonales/envers/doublons ne sont
  pas satisfaites ; la détection de doublon exclut la position placée elle-même et sa lecture
  inverse, pour qu'un palindrome passe). Mesurer sur 20 000 graines que la génération n'échoue
  jamais et rapporter le nombre moyen de tentatives.
- [ ] **Étape 4 :** `e2e/helpers.ts` cherche dans les 8 directions ; `npm test` et `npm run e2e`
  verts ; vérification visuelle d'une grille (mots à l'envers et en diagonale visibles).

### Tâche 17 : Mot de passe — rébus sur portée et champ ignoré des gestionnaires

**Fichiers :** `src/app/hunt/password-riddle/*`, `src/app/hunt/hunt-content.ts` (type de l'indice
rébus si nécessaire).

- [ ] Rébus (spec §4.4) : SVG inline accessible (portée 5 lignes, clé de sol, ronde ou noire sur
  le 1ᵉʳ interligne en partant du bas = Fa, puis « + 1000 »), sans le mot « Fa » ; lisible sur
  390 px ; `role="img"` + texte alternatif de la spec.
- [ ] Champ de réponse (spec §4.4) : `type="text"`, `autocomplete="off"`, `autocapitalize="none"`,
  `spellcheck="false"`, `name`/`id` sans « password » (ex. `secret-word`), libellé « Le mot
  secret », `data-bwignore`, `data-1p-ignore`, `data-lpignore="true"`. Le `data-testid`
  `password-input` est conservé (contrat E2E).
- [ ] Tests composant : le champ n'est pas de type password et porte les attributs d'exclusion ; le
  rébus est un SVG avec un texte alternatif et ne contient pas le texte « Fa ».
- [ ] Vérification visuelle du rébus en 390×844 et 1280×800.

### Tâche 18 : Mots croisés — cases partagées, changement de sens, saisie sans décalage

**Fichiers :** `src/app/hunt/crossword/*`, `src/app/hunt/hunt-content.ts` (définition 8),
`e2e/hunt.spec.ts`.

- [ ] Définition 8 : « Ta tante, comme l'appellent les petits ».
- [ ] Règles de sélection de la spec §4.5 (définition → 1ʳᵉ case ; case partagée : mot actif
  conservé, sinon mot qui commence sur la case, sinon mot non verrouillé, sinon horizontal ;
  2ᵉ toucher bascule) + bouton « Changer de sens » dans la barre de définition, visible seulement
  quand la case active est partagée.
- [ ] Saisie sans décalage (spec §4.5) : le curseur ne saute plus les cases verrouillées ou
  préremplies ; saisir sur une telle case ne la modifie pas mais avance d'une case. Revoir
  l'effacement en cohérence (reculer sur une case verrouillée ne l'efface pas).
- [ ] Tests composant : chaque règle de sélection ; bouton de changement de sens ; taper « SOEUR »
  après avoir verrouillé COUSIN (case S partagée) remplit S-O-E-U-R à leur place ; taper
  « GRANDPERE » depuis la définition 2 saute proprement le tiret (le « - » est tapé par-dessus
  avec n'importe quelle lettre ; décision : la saisie d'une lettre sur « - » avance simplement).
  Attention : pour GRAND-PERE, le joueur tape 9 lettres sans tiret ; le curseur doit donc sauter
  automatiquement le « - » quand il y arrive par avance **et** ignorer une frappe sur « - » si le
  joueur tape quand même un caractère pour le tiret. Décision retenue : sauter automatiquement les
  cases « - » préremplies à l'avance (comme avant), mais ne plus sauter les cases verrouillées
  (tapées par-dessus).
- [ ] E2E : un scénario tape les mots entiers depuis leurs définitions (y compris après qu'un mot
  croisant est rempli et verrouillé) et résout la grille ; `solveCrossword` peut revenir à cette
  saisie naturelle.
- [ ] Vérification visuelle (sélection d'une case partagée, bouton de sens, saisie d'un mot
  croisant un mot verrouillé).

### Tâche 19 : Trésor — coffre illustré

**Fichiers :** `src/app/hunt/treasure/*` (éventuellement un SVG dans `assets/`).

- [ ] Coffre au trésor en SVG dans le style de la carte (bois, ferrures dorées, cadenas ouvert,
  pièces qui débordent, éclat doré), couvercle qui s'ouvre (≤ 2 s ; instantané si mouvements
  réduits), puis apparition de la vidéo et du message **après** l'ouverture (spec §4.7).
- [ ] Tests composant existants conservés (data-testid inchangés) ; ajouter un test que la
  révélation est marquée visible après la fin de l'ouverture (`vi.useFakeTimers()` ou classe
  d'état pilotée par `animationend`).
- [ ] Vérification visuelle : pendant l'ouverture, révélation finale, en 390×844 et 1280×800 ;
  comparer à la carte pour la cohérence de style.
