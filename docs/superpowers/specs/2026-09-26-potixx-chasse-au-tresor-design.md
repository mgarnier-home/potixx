# Potixx — Chasse au trésor (v1) et configuration du LLM

- Date : 2026-09-26
- Statut : design validé ; révisé le 2026-09-27 après les retours de test du propriétaire
  (§4.4 rébus et champ de saisie, §4.5 définition 8 et sélection des cases partagées, §4.6 huit
  directions, §4.7 coffre illustré)
- Source du besoin : `site.md`, `activity.png`

## 1. Objectif

Annoncer une grossesse à la famille et aux amis via un site au thème pirate. Le visiteur suit un
chemin sur une carte au trésor, résout quatre énigmes, puis découvre le trésor : une vidéo de
l'échographie et le message « Notre famille s'agrandira en Avril 2027 ».

Le lien est envoyé à tout le monde au même moment. Le public est de tous âges et joue
principalement sur téléphone ; le site doit rester confortable sur ordinateur.

Le site est maintenu par une seule personne, avec l'aide de Claude Code. La configuration du LLM
(section 9) fait partie du livrable.

### Critères de réussite

- Un visiteur sur téléphone peut aller du début au trésor sans aide, y compris en passant les
  énigmes qu'il ne trouve pas.
- La progression survit à la fermeture de l'onglet.
- Le site n'apparaît dans aucun moteur de recherche.
- Un push sur `main` produit une image `docker.io/mgarnier11/potixx` prête à déployer.
- Claude Code peut développer, tester (unitaires, E2E, vérification visuelle) et documenter le
  site en suivant uniquement `CLAUDE.md` et les skills du projet.

### Hors périmètre de la v1

- Formulaire de nouvelles du bébé, liste de naissance (prévus en v2, sous forme d'onglets).
- Backend, base de données, comptes.
- Son et musique.
- Protection contre la triche : les réponses sont lisibles dans le code client, c'est accepté.
- Build multi-architecture : l'image est construite pour amd64 uniquement (à revoir plus tard).
- Personnalisation par prénoms ou surnoms.

## 2. Stack

| Élément | Choix |
|---|---|
| Framework | Angular 22.2 (dernière stable), composants standalone, signals, zoneless |
| Styles | SCSS |
| Runtime | Node 24.16.0 (`.tool-versions`) |
| Tests unitaires | Lanceur par défaut d'Angular CLI (Vitest, à confirmer à la création du projet) |
| Tests E2E | `@playwright/test` |
| Qualité | ESLint (angular-eslint), Prettier |
| Service | nginx non privilégié dans Docker, derrière le reverse proxy existant (HTTPS géré en amont) |

Pas de SSR ni de prérendu : `ng build` produit un site statique.

## 3. Conventions

- Documentation, `CLAUDE.md`, skills, specs et commentaires : **en français**.
- Code (noms de fichiers, variables, fonctions, composants) : **en anglais**.
- Mobile d'abord : largeur de référence 390 px, cibles tactiles d'au moins 32 px.
- Git est géré par le propriétaire du projet : Claude ne fait ni `git init`, ni commit, ni push.

## 4. Déroulé de la chasse

### 4.1 Carte

- Image plein écran : `assets/map.svg` (provisoire, style parchemin, remplaçable).
- Un chemin relie 5 étapes : énigmes 1 à 4, puis le trésor.
- États d'une étape : verrouillée (grisée), en cours (animée), résolue (cochée).
- Les positions des étapes sont exprimées en pourcentage de l'image, dans `hunt-content.ts`.
- Toucher l'étape en cours ou une étape résolue ouvre son écran. Une étape verrouillée ne réagit
  pas.
- Les étapes se débloquent strictement dans l'ordre.

### 4.2 Règles communes aux énigmes

- **Normalisation des réponses** : minuscules, accents retirés, espaces de début et de fin retirés.
  « Famille », « FAMILLE » et « famille » sont acceptés.
- **Échecs** : chaque énigme compte ses échecs. À partir du 3ᵉ échec, un bouton « Passer
  l'énigme » apparaît. Il affiche la solution et marque l'énigme comme résolue.
- Une énigme résolue reste consultable, dans son état final.

### 4.3 Énigme 1 — Le cadenas

Les quatre mini-énigmes s'affichent l'une après l'autre. Chaque bonne réponse ajoute le chiffre au
cadenas. La règle des 3 échecs s'applique à chaque chiffre séparément.

| Ordre | Énoncé | Réponse |
|---|---|---|
| 1 | Je représente le rien | 0 |
| 2 | Je suis le nombre de saisons dans une année | 4 |
| 3 | Je suis le seul chiffre pair et premier | 2 |
| 4 | Je corresponds au nombre de jours dans une semaine | 7 |

Quand les quatre chiffres sont trouvés, le cadenas 0-4-2-7 s'ouvre (animation), puis l'énigme est
résolue. L'ordre des chiffres est volontaire : 04/27, le mois de naissance prévu.

### 4.4 Énigme 2 — Le mot de passe

Réponse : `famille`.

Les indices apparaissent un par un :

1. Affiché dès le départ : une photo du couple (`assets/photo-us.jpg`, provisoire).
2. Après le 1ᵉʳ échec : « L'équipage que l'on ne choisit pas toujours, mais que l'on garde toute sa
   vie. »
3. Après le 2ᵉ échec : rébus classique dessiné (SVG) : une portée avec une clé de sol et une note
   placée sur le **Fa** (1ᵉʳ interligne en partant du bas), suivie de « + 1000 ». Le mot « Fa »
   n'est pas écrit : c'est au joueur de lire la note. Texte alternatif : « Rébus : une note de
   musique sur une portée, plus 1000 ».

Après le 3ᵉ échec, le bouton « Passer l'énigme » apparaît.

Le champ de réponse ne doit pas déclencher les gestionnaires de mots de passe (Bitwarden,
1Password, LastPass, navigateur) : champ texte, sans le mot « password » dans son `name`, son `id`,
son `autocomplete` ni son libellé (« Le mot secret »), `autocomplete="off"`, et les attributs
d'exclusion `data-bwignore`, `data-1p-ignore`, `data-lpignore="true"`.

### 4.5 Énigme 3 — Les mots croisés

Grille identique à `activity.png` : 10 colonnes × 14 lignes. Les tirets de GRAND-MÈRE et
GRAND-PÈRE sont pré-remplis et non modifiables. Les mots sont écrits sans accents dans la grille.

Coordonnées (ligne, colonne), origine en haut à gauche, à partir de 0 :

| N° | Mot dans la grille | Sens | Départ | Définition |
|---|---|---|---|---|
| 1 | COUSIN | vertical | (0, 1) | L'enfant de ton oncle ou de ta tante |
| 2 | GRAND-PERE | vertical | (2, 5) | Le papa de papa ou de maman |
| 3 | SOEUR | horizontal | (3, 1) | Fille des mêmes parents que toi |
| 4 | ONCLE | horizontal | (5, 4) | Le frère de papa ou de maman |
| 5 | MARRAINE | vertical | (6, 2) | Elle veille sur toi depuis ton baptême |
| 6 | GRAND-MERE | horizontal | (7, 0) | La maman de papa ou de maman |
| 7 | FRERE | horizontal | (9, 1) | Garçon des mêmes parents que toi |
| 8 | TATA | vertical | (10, 0) | Ta tante, comme l'appellent les petits |
| 9 | AMIS | horizontal | (11, 0) | La famille que l'on choisit |

Cases du mot caché **AGRANDIRA**, dans l'ordre d'illumination :

| Lettre | Mot | Case (ligne, colonne) |
|---|---|---|
| A | MARRAINE (2ᵉ A) | (10, 2) |
| G | GRAND-MERE (G initial) | (7, 0) |
| R | FRERE (2ᵉ R) | (9, 4) |
| A | TATA (dernier A) | (13, 0) |
| N | ONCLE | (5, 5) |
| D | GRAND-PERE | (6, 5) |
| I | COUSIN | (4, 1) |
| R | SOEUR | (3, 5) |
| A | AMIS | (11, 0) |

Interaction :

- Toucher une définition sélectionne toujours ce mot, curseur sur sa **première** case.
- Toucher une case d'un seul mot sélectionne ce mot. Toucher une case partagée par deux mots :
  - si le mot actif contient déjà cette case, il reste sélectionné (on déplace juste le curseur) ;
  - sinon, on choisit le mot qui **commence** sur cette case ; à défaut, le mot qui n'est pas encore
    verrouillé ; à défaut, le mot horizontal ;
  - toucher à nouveau la même case bascule vers l'autre mot.
- Un bouton visible dans la barre de définition (« ↔ / ↕ Changer de sens ») bascule aussi vers
  l'autre mot quand la case active est partagée, pour ceux qui ne devinent pas le double toucher.
- La saisie passe par un champ caché qui ouvre le clavier du téléphone ; le curseur avance
  automatiquement et recule avec la touche d'effacement.
- Taper le mot entier depuis sa première case remplit chaque lettre **à sa place** : une case
  appartenant à un mot verrouillé n'est plus sautée, elle est « tapée par-dessus » (la lettre
  saisie est ignorée pour cette case et le curseur avance d'une case). Seule la case préremplie
  « - » est sautée automatiquement, puisque le joueur tape GRANDPERE sans tiret.
- Bouton « Vérifier » : si la grille contient des erreurs, les mots faux passent en rouge et un
  échec est compté. Les mots justes sont verrouillés.
- Grille juste (ou énigme passée) : les 9 cases s'illuminent une à une dans l'ordre ci-dessus, puis
  le mot AGRANDIRA s'affiche sous la grille.

### 4.6 Énigme 4 — Les mots mêlés

Mots, sans accents : BEBE, FAMILLE, AMOUR, NAISSANCE, FOYER, JEUX, BIBERON, COUCHES, DOUDOUS,
PARENTS.

- Grille de 10×10 : 62 lettres de mots pour 100 cases, cases d'environ 34 px sur un écran de
  360 px.
- Directions : les **8 directions** (horizontale, verticale et diagonales, dans les deux sens de
  lecture, donc aussi à l'envers). Chaque grille contient au moins 3 mots en diagonale et au moins
  2 mots écrits à l'envers. Les mots peuvent se croiser sur une lettre commune.
- Aucun mot de la liste ne doit apparaître ailleurs qu'à sa position placée, dans aucune des 8
  directions (sinon le joueur sélectionne une copie et se voit compter un échec). Un mot
  palindrome ne doit pas faire échouer la génération.
- Grille aléatoire par visiteur : une graine est tirée à la première ouverture et sauvegardée avec
  la progression, donc un rechargement redonne la même grille.
- Le générateur doit placer les 10 mots. S'il échoue avec une graine, il réessaie avec une graine
  dérivée, jusqu'à 50 tentatives. La graine retenue est celle qui est sauvegardée.
- Sélection : toucher la première lettre, puis la dernière. Une sélection qui correspond à un mot
  non trouvé le marque comme trouvé et le raye dans la liste. Toute autre sélection compte comme un
  échec.
- Le bouton « Passer l'énigme » (après 3 échecs) révèle tous les mots restants.

### 4.7 Le trésor

- Coffre au trésor illustré en SVG, dans le style de la carte (bois, ferrures, cadenas ouvert,
  pièces d'or qui débordent), qui s'ouvre (≤ 2 s, instantané si « mouvements réduits »).
- La vidéo et le message apparaissent **après** l'ouverture du coffre, sur fond parchemin.
- Vidéo `assets/treasure.mp4` (provisoire), lue sans son par défaut, avec les contrôles natifs et
  `playsinline` pour iOS.
- Message : « Notre famille s'agrandira en Avril 2027 ».
- Bouton « Recommencer » : demande une confirmation, efface la progression, revient à la carte.

### 4.8 Progression

- Stockée dans `localStorage` sous la clé `potixx.progress.v1`.
- Contenu : étape en cours, et pour chaque énigme son état (résolue ou non, échecs, avancement :
  chiffres trouvés, indices affichés, lettres saisies, graine et mots trouvés).
- Sauvegarde à chaque changement d'état.
- Données absentes, illisibles ou d'une autre version : on repart de zéro sans erreur visible.
- Si `localStorage` est indisponible (navigation privée stricte), le jeu fonctionne sans
  sauvegarde.

## 5. Organisation du code

```
assets/                      images, vidéo, carte (servis sous /assets)
src/
  index.html                 meta robots noindex
  app/
    app.config.ts, app.routes.ts, app.ts
    hunt/
      hunt-content.ts        tout le contenu éditable (textes, réponses, grilles, positions)
      hunt-progress.service.ts
      core/                  logique pure, sans Angular
        normalize-answer.ts
        seeded-random.ts
        word-search.ts       generateWordSearch(words, size, seed)
        crossword.ts         checkCrossword, highlightCells
      treasure-map/
      padlock-riddle/
      password-riddle/
      crossword/
      word-search/
      treasure/
      shared/skip-button/
public/robots.txt            User-agent: * / Disallow: /
e2e/                         tests Playwright
```

- `hunt-content.ts` est la seule source des textes et réponses : modifier le contenu ne demande pas
  de toucher aux composants.
- `core/` ne dépend pas d'Angular et porte toute la logique testable.
- `HuntProgressService` expose l'état en signals, applique les transitions (réponse, échec, passer,
  recommencer) et gère la sauvegarde.
- Les composants d'énigme reçoivent leur contenu et émettent des événements ; ils ne lisent pas
  `localStorage` directement.

## 6. Tests

### Unitaires

- `normalizeAnswer` : casse, accents, espaces.
- `seededRandom` : même graine, même suite.
- `generateWordSearch` : 10 mots placés, grille de 10×10, aucune lettre vide, directions
  autorisées uniquement, déterministe pour une graine donnée, sur au moins 200 graines.
- `checkCrossword` : détection des mots faux, grille juste, cases de AGRANDIRA.
- `HuntProgressService` : transitions, apparition du bouton après 3 échecs, sauvegarde et
  restauration, données corrompues, recommencer.

### E2E (Playwright)

Deux profils : mobile (iPhone, 390×844) et ordinateur (1280×800). Scénarios :

1. Chasse complète en donnant les bonnes réponses.
2. Chasse complète en passant chaque énigme après 3 échecs.
3. Rechargement au milieu de la chasse : progression et grille de mots mêlés conservées.
4. Recommencer depuis le trésor.
5. Présence de la balise `noindex`.

### Vérification visuelle

Avant de déclarer une tâche terminée, Claude ouvre les écrans modifiés avec Playwright MCP en
390×844 et en 1280×800, fait des captures et vérifie que la console ne contient pas d'erreur.

## 7. Docker

- `Dockerfile` en deux étapes :
  1. `node:24-alpine` : `npm ci`, `npm run build`.
  2. `nginxinc/nginx-unprivileged:alpine` : copie de `dist/<projet>/browser`, port 8080.
- `nginx.conf` :
  - repli de toutes les routes sur `index.html` ;
  - `Cache-Control: public, max-age=31536000, immutable` pour les fichiers dont le nom contient un
    hash ;
  - `Cache-Control: no-cache` pour `index.html` ;
  - `X-Robots-Tag: noindex, nofollow` sur toutes les réponses.
- `.dockerignore` : `node_modules`, `dist`, `.angular`, `.git`, `.claude`, `docs`, résultats des
  tests.

## 8. CI — `.github/workflows/docker.yml`

- Déclencheurs : pull request, push sur `main`, tag `v*`.
- Job `test` : `npm ci`, lint, tests unitaires, installation de Chromium, tests E2E.
- Job `docker` (après `test`) : build avec `docker/build-push-action`, plateforme `linux/amd64`.
  - Sur une pull request : build sans publication.
  - Sur `main` ou un tag : publication sur `docker.io/mgarnier11/potixx`, tags générés par
    `docker/metadata-action` : `latest` (sur `main`), `sha-<court>`, et la version pour un tag
    `v*`.
- Secrets GitHub à créer par le propriétaire : `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`.

## 9. Configuration du LLM

### Déjà en place

- `.tool-versions` : `nodejs 24.16.0`.
- `.mcp.json` : serveurs Playwright MCP et Context7.
- `.claude/settings.json` : plugin `frontend-design` activé.

### `CLAUDE.md` (français)

1. But du site et périmètre de la v1 (renvoi vers cette spec).
2. Commandes : dev, tests unitaires, E2E, lint, build, build et lancement de l'image en local.
3. Arborescence et rôle de `hunt-content.ts` et de `core/`.
4. Conventions : langues, standalone et signals, logique pure dans `core/`, mobile d'abord.
5. Documentation : consulter Context7 pour Angular et Playwright avant d'utiliser une API.
6. Définition de « terminé » : lint, tests unitaires et E2E au vert, vérification visuelle en
   mobile et en ordinateur.
7. Interdits : aucune commande git d'écriture, ne jamais retirer le `noindex`, ne pas publier
   d'image.

### `.claude/settings.json` (complété)

- Autorisé sans confirmation : `npm run *`, `npm ci`, `npx ng *`, `npx playwright *`,
  `docker build *`, `docker run *`, outils `mcp__playwright__*` et `mcp__context7__*`.
- Interdit : `git commit *`, `git push *`, `docker push *`, lecture de `.env*`.
- Hook `PostToolUse` sur `Edit|Write` : Prettier sur le fichier modifié (sans bloquer si le fichier
  n'est pas pris en charge).

### Skills (`.claude/skills/`, en français)

- `verifier-dans-le-navigateur` : lancer `ng serve`, parcourir les écrans concernés avec Playwright
  MCP en 390×844 puis 1280×800, captures, lecture de la console, arrêt du serveur.
- `modifier-le-contenu` : emplacement des textes, réponses, définitions, positions de la carte et
  fichiers d'`assets/` ; tests à relancer après modification.

### `.gitignore`

Fichiers générés par Angular, plus `.claude/settings.local.json`, `test-results/`,
`playwright-report/`.
