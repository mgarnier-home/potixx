import { TREASURE_ANIMATIONS, pickTreasureAnimation } from "./treasure-animation";

describe("pickTreasureAnimation", () => {
  it("propose le bébé dans le coffre et le bébé porté par la mouette", () => {
    expect(TREASURE_ANIMATIONS).toEqual(["chest", "gull"]);
  });

  it("choisit le coffre pour la première moitié du tirage", () => {
    expect(pickTreasureAnimation(() => 0)).toBe("chest");
    expect(pickTreasureAnimation(() => 0.49)).toBe("chest");
  });

  it("choisit la mouette pour la seconde moitié du tirage", () => {
    expect(pickTreasureAnimation(() => 0.5)).toBe("gull");
    expect(pickTreasureAnimation(() => 0.999999)).toBe("gull");
  });

  it("reste dans la liste même si le tirage vaut 1", () => {
    expect(pickTreasureAnimation(() => 1)).toBe("gull");
  });
});
