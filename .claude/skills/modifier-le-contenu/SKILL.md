---
name: modifier-le-contenu
description: Modifie le contenu de la chasse au trésor Potixx (textes des énigmes, réponses, indices, définitions et grille des mots croisés, mots mêlés, message du trésor, positions sur la carte) ou remplace les images et la vidéo. À utiliser pour toute demande de changement de texte ou de média, sans toucher aux composants.
---

# Modifier le contenu

## Où se trouve quoi

| À modifier                                               | Emplacement                                                                  |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Énoncés et réponses du cadenas                           | `PADLOCK_RIDDLES` dans `src/app/hunt/hunt-content.ts`                        |
| Réponse et indices du mot de passe                       | `PASSWORD`                                                                   |
| Grille, définitions, cases de AGRANDIRA                  | `CROSSWORD`                                                                  |
| Liste des mots mêlés, taille de grille                   | `WORD_SEARCH`                                                                |
| Vidéo, image d'attente, message final                    | `TREASURE`                                                                   |
| Image de la carte, position des étapes (en % de l'image) | `MAP`                                                                        |
| Seuil d'échecs avant « Passer l'énigme »                 | `MAX_FAILURES_BEFORE_SKIP`                                                   |
| Fichiers médias                                          | `assets/` : `map.svg`, `photo-us.jpg`, `treasure.mp4`, `treasure-poster.jpg` |

Ne modifie pas les composants pour un changement de contenu : si c'est nécessaire, c'est que la
demande dépasse le contenu, et elle mérite son propre design.

## Règles

- Les réponses sont comparées sans casse, sans accents et sans espaces autour : écris-les
  simplement en minuscules.
- Mots croisés et mots mêlés : lettres majuscules **sans accents** dans la grille (`SOEUR`,
  `BEBE`). Les coordonnées sont `(ligne, colonne)`, à partir de 0, en haut à gauche.
- Si tu changes la grille des mots croisés, le test de cohérence de
  `src/app/hunt/core/crossword.spec.ts` vérifie les croisements et le mot caché : il doit passer.
- Mots mêlés : chaque mot doit tenir dans la grille (le plus long ≤ taille) ; le test du
  générateur vérifie que tous les mots sont placés.
- Remplacer un média : garder le même nom de fichier, ou mettre à jour le chemin dans
  `hunt-content.ts`. Vidéo en MP4 (H.264), la plus légère possible (le public est sur mobile).
- Si tu changes la structure de la progression sauvegardée, la clé `potixx.progress.v1` doit
  passer à `v2` ; un simple changement de texte ne l'exige pas.

## Vérifier

1. `npm test`
2. `npm run e2e` : les scénarios E2E utilisent les vraies réponses ; mets-les à jour si une
   réponse change.
3. Skill `verifier-dans-le-navigateur` sur les écrans concernés.
