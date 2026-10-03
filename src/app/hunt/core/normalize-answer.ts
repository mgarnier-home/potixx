/** Met une réponse sous forme comparable : sans accents, en minuscules, sans espaces autour. */
export function normalizeAnswer(input: string): string {
  return input.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

export function isCorrectAnswer(input: string, expected: string): boolean {
  return normalizeAnswer(input) === normalizeAnswer(expected);
}
