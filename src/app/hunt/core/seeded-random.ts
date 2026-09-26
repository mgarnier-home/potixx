/**
 * Générateur pseudo-aléatoire reproductible (mulberry32) : une même graine donne toujours la
 * même suite, ce qui permet de régénérer la grille de mots mêlés d'un visiteur.
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}
