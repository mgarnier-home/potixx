---
name: verifier-dans-le-navigateur
description: Vérifie visuellement le site Potixx dans un vrai navigateur avec Playwright MCP, en mobile (390×844) puis en ordinateur (1280×800). À utiliser après toute modification visible (composant, style, contenu, image) et avant de déclarer une tâche terminée.
---

# Vérifier dans le navigateur

Les tests automatiques ne disent pas si l'écran est beau, lisible et utilisable au doigt. Cette
vérification le fait, sur les écrans que tu viens de modifier.

## 1. Lancer le serveur

Lance `npm start` **en arrière-plan** et attends que `http://localhost:4200` réponde (le message
« Local: http://localhost:4200/ » apparaît dans la sortie). Si un serveur tourne déjà sur ce port,
réutilise-le.

## 2. Atteindre l'écran à vérifier

La chasse se débloque dans l'ordre. Pour aller directement à une énigme, injecte une progression
dans `localStorage` avec `browser_evaluate`, puis recharge la page :

```js
localStorage.setItem("potixx.progress.v1", JSON.stringify({/* HuntProgress voulu */}));
location.reload();
```

La forme de `HuntProgress` est définie dans `src/app/hunt/hunt-progress.service.ts`. Pour repartir
de zéro : `localStorage.removeItem('potixx.progress.v1')`.

## 3. Vérifier en mobile, puis en ordinateur

Pour chaque taille, dans cet ordre : `browser_resize` (390×844, puis 1280×800), `browser_navigate`
vers `http://localhost:4200`, `browser_snapshot`, `browser_take_screenshot`, puis
`browser_console_messages`.

Pour chaque capture, contrôle :

- rien ne déborde horizontalement, aucun texte coupé ou illisible ;
- les cases et boutons font au moins 32 px et sont faciles à toucher ;
- l'ambiance pirate/parchemin est cohérente avec les autres écrans ;
- l'interaction modifiée fonctionne vraiment (clic, saisie, bouton « Passer l'énigme »…) ;
- la console ne contient **aucune erreur**.

## 4. Conclure

- Arrête le serveur si c'est toi qui l'as lancé, et ferme le navigateur (`browser_close`).
- Dans ton compte rendu, dis ce que tu as regardé, en quelles tailles, et tout problème trouvé.
  Un problème trouvé se corrige avant de déclarer la tâche terminée.
