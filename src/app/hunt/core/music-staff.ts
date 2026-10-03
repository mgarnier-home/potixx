/**
 * Notes de la portée de clé de sol, du Mi4 (ligne du bas) au Fa5 (ligne du haut), sans lignes
 * supplémentaires. Décalage exprimé en demi-interlignes au-dessus de la ligne du bas : chaque
 * ligne ou interligne vaut 1 (Mi4 = 0, Fa4 = 1, Sol4 = 2, …, Fa5 = 8).
 */
const TREBLE_STAFF_NOTES = ["E4", "F4", "G4", "A4", "B4", "C5", "D5", "E5", "F5"] as const;

/**
 * Position d'une note sur la portée de clé de sol (spec §4.4), en demi-interlignes au-dessus de la
 * ligne du bas (Mi4). `null` si la note est hors de la portée ou non reconnue.
 */
export function trebleStaffOffset(note: string): number | null {
  const index = TREBLE_STAFF_NOTES.indexOf(
    note.toUpperCase() as (typeof TREBLE_STAFF_NOTES)[number],
  );
  return index === -1 ? null : index;
}
