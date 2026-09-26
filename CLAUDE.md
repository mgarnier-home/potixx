# Potixx — Chasse au trésor

Site d'annonce de grossesse au thème pirate : le visiteur suit une carte au trésor, résout quatre
énigmes (cadenas, mot de passe, mots croisés, mots mêlés) et découvre le trésor (vidéo de
l'échographie + « Notre famille s'agrandira en Avril 2027 »). Public familial, surtout sur
téléphone.

- Spec (référence) : `docs/superpowers/specs/2026-09-26-potixx-chasse-au-tresor-design.md`
- Plan d'implémentation : `docs/superpowers/plans/2026-09-26-potixx-chasse-au-tresor.md`
- Besoin d'origine : `site.md`, grille des mots croisés : `activity.png`

**Périmètre v1 : uniquement la chasse au trésor.** Pas de backend, pas de base de données, pas de
son, pas de SSR. Le formulaire de nouvelles et la liste de naissance viendront en v2 (onglets).

## Commandes

| Action                                      | Commande                                                          |
| ------------------------------------------- | ----------------------------------------------------------------- |
| Serveur de dev (http://localhost:4200)      | `npm start`                                                       |
| Tests unitaires (Vitest, une passe)         | `npm test`                                                        |
| Tests E2E (Playwright, mobile + ordinateur) | `npm run e2e`                                                     |
| Lint                                        | `npm run lint`                                                    |
| Formatage / vérification                    | `npm run format` / `npm run format:check`                         |
| Build de production                         | `npm run build` (sortie : `dist/potixx/browser`)                  |
| Image Docker locale                         | `docker build -t potixx . && docker run --rm -p 8080:8080 potixx` |

Node 24.16.0 (`.tool-versions`), Angular 22.2, npm.

## Arborescence

```
assets/                     images, vidéo, carte — servis sous /assets/
public/robots.txt           interdit l'indexation
src/app/hunt/
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
- Les composants ne lisent jamais `localStorage` : ils passent par `HuntProgressService`.
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
3. `npm run e2e` passe (dès que la suite E2E existe) ;
4. pour tout changement visible : le skill `verifier-dans-le-navigateur` a été suivi (captures en
   390×844 et 1280×800, aucune erreur console).

Annonce le résultat réel des commandes, pas celui attendu.

## Interdits

- **Git : commits locaux autorisés, jamais de `git push`** ni de réécriture d'historique
  (`rebase`, `reset --hard`, `commit --amend` sur un commit existant) sans demande explicite. Le
  propriétaire gère le dépôt distant. Messages au format Conventional Commits (`feat: …`,
  `test: …`, `chore: …`).
- Ne jamais retirer le `noindex` (meta robots dans `src/index.html`, `public/robots.txt`,
  en-tête `X-Robots-Tag` dans `nginx.conf`).
- Ne jamais publier d'image Docker (`docker push`) : c'est le rôle de la CI GitHub.
- Ne pas lire les fichiers `.env*`.

## Déploiement

La CI (`.github/workflows/docker.yml`) teste puis publie `docker.io/mgarnier11/potixx`
(amd64) sur push vers `main` et sur tag `v*`. Secrets requis côté GitHub : `DOCKERHUB_USERNAME`,
`DOCKERHUB_TOKEN`. Le conteneur écoute sur 8080 ; le HTTPS est géré par le reverse proxy du
propriétaire.
