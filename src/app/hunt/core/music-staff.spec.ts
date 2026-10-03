import { trebleStaffOffset } from "./music-staff";

describe("trebleStaffOffset", () => {
  it("place Mi4 (E4) sur la ligne du bas (décalage 0)", () => {
    expect(trebleStaffOffset("E4")).toBe(0);
  });

  it("place Fa4 (F4) sur le premier interligne en partant du bas (décalage 1)", () => {
    expect(trebleStaffOffset("F4")).toBe(1);
  });

  it("place Fa5 (F5) sur la ligne du haut (décalage 8)", () => {
    expect(trebleStaffOffset("F5")).toBe(8);
  });

  it("ignore la casse de l'octave", () => {
    expect(trebleStaffOffset("f4")).toBe(1);
  });

  it("renvoie null pour une note hors de la portée ou inconnue", () => {
    expect(trebleStaffOffset("G6")).toBeNull();
    expect(trebleStaffOffset("pas une note")).toBeNull();
  });
});
