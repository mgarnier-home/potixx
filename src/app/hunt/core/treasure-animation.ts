/** Animations du bébé montrées sous le message du trésor : une seule est tirée au sort. */
export const TREASURE_ANIMATIONS = ["chest", "gull"] as const;

export type TreasureAnimation = (typeof TREASURE_ANIMATIONS)[number];

/**
 * Tire une animation au sort, à parts égales. `random` renvoie un nombre dans [0, 1) (comme
 * `Math.random`) ; il est passé en paramètre pour que le tirage soit testable.
 */
export function pickTreasureAnimation(random: () => number): TreasureAnimation {
  const index = Math.floor(random() * TREASURE_ANIMATIONS.length);
  return TREASURE_ANIMATIONS[Math.min(index, TREASURE_ANIMATIONS.length - 1)];
}
