import { cellKey } from "./cell";

describe("cellKey", () => {
  it('forme une clé "ligne,colonne"', () => {
    expect(cellKey({ row: 3, col: 5 })).toBe("3,5");
  });
});
