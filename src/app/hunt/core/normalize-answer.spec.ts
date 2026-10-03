import { isCorrectAnswer, normalizeAnswer } from "./normalize-answer";

describe("normalizeAnswer", () => {
  it("normalise la casse, les accents et les espaces autour", () => {
    expect(normalizeAnswer("  FaMîllé ")).toBe("famille");
  });
});

describe("isCorrectAnswer", () => {
  it("accepte les variantes de casse, d’accents et d’espaces", () => {
    expect(isCorrectAnswer("Famille", "famille")).toBe(true);
    expect(isCorrectAnswer(" 7 ", "7")).toBe(true);
  });

  it("refuse une réponse différente", () => {
    expect(isCorrectAnswer("familles", "famille")).toBe(false);
  });
});
