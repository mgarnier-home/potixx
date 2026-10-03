import { TestBed } from "@angular/core/testing";
import type { ComponentFixture } from "@angular/core/testing";
import type { StepId } from "../hunt-content";
import { PROGRESS_STORAGE, SEED_FACTORY } from "../hunt-progress.service";
import { HuntProgressService } from "../hunt-progress.service";
import { TreasureMap } from "./treasure-map";

describe("TreasureMap", () => {
  let fixture: ComponentFixture<TreasureMap>;
  let emitted: StepId[];

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [TreasureMap],
      providers: [
        { provide: PROGRESS_STORAGE, useValue: null },
        { provide: SEED_FACTORY, useValue: () => 42 },
      ],
    });
    fixture = TestBed.createComponent(TreasureMap);
    emitted = [];
    fixture.componentInstance.stepSelected.subscribe((step) => emitted.push(step));
    await fixture.whenStable();
  });

  function step(id: StepId): HTMLButtonElement {
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      `[data-testid="step-${id}"]`,
    );
    if (button === null) {
      throw new Error(`Étape ${id} introuvable`);
    }
    return button;
  }

  it("marque le cadenas comme étape en cours et les autres comme verrouillées au départ", () => {
    expect(step("padlock").classList).toContain("current");
    for (const id of ["password", "crossword", "wordSearch", "treasure"] as const) {
      expect(step(id).classList).toContain("locked");
    }
  });

  it("donne à chaque étape un aria-label égal à son libellé", () => {
    expect(step("padlock").getAttribute("aria-label")).toBe("Le cadenas");
    expect(step("treasure").getAttribute("aria-label")).toBe("Le trésor");
  });

  it("n'émet rien au clic sur une étape verrouillée", () => {
    step("password").click();
    expect(emitted).toEqual([]);
  });

  it("émet l'identifiant de l'étape en cours au clic", () => {
    step("padlock").click();
    expect(emitted).toEqual(["padlock"]);
  });

  it("marque une étape résolue et permet de la rouvrir", async () => {
    const service = TestBed.inject(HuntProgressService);
    for (const answer of ["0", "4", "2", "7"]) {
      service.answerPadlockDigit(answer);
    }
    await fixture.whenStable();

    expect(step("padlock").classList).toContain("solved");
    expect(step("password").classList).toContain("current");
    step("padlock").click();
    expect(emitted).toEqual(["padlock"]);
  });
});
