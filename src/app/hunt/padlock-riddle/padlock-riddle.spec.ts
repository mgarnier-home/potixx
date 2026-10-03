import { TestBed } from "@angular/core/testing";
import type { ComponentFixture } from "@angular/core/testing";
import { PADLOCK_RIDDLES } from "../hunt-content";
import { HuntProgressService, PROGRESS_STORAGE, SEED_FACTORY } from "../hunt-progress.service";
import { PadlockRiddle } from "./padlock-riddle";

describe("PadlockRiddle", () => {
  let fixture: ComponentFixture<PadlockRiddle>;
  let solvedCount: number;

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function testid(id: string): HTMLElement | null {
    return el().querySelector(`[data-testid="${id}"]`);
  }

  function digit(index: number): string | undefined {
    return testid(`padlock-digit-${index}`)?.textContent?.trim();
  }

  async function answer(value: string): Promise<void> {
    const input = testid("padlock-input") as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event("input"));
    fixture.detectChanges();
    (testid("padlock-submit") as HTMLButtonElement | null)?.click();
    fixture.detectChanges();
  }

  function createFixture(): void {
    fixture = TestBed.createComponent(PadlockRiddle);
    solvedCount = 0;
    fixture.componentInstance.solved.subscribe(() => solvedCount++);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PadlockRiddle],
      providers: [
        { provide: PROGRESS_STORAGE, useValue: null },
        { provide: SEED_FACTORY, useValue: () => 42 },
      ],
    });
  });

  it("affiche la question du premier chiffre à l'ouverture", async () => {
    createFixture();
    fixture.detectChanges();

    expect(testid("padlock-question")?.textContent?.trim()).toBe(PADLOCK_RIDDLES[0].question);
  });

  it("valide un bon chiffre : affiche la question suivante et révèle le chiffre trouvé", async () => {
    createFixture();
    fixture.detectChanges();

    await answer("0");

    expect(testid("padlock-question")?.textContent?.trim()).toBe(PADLOCK_RIDDLES[1].question);
    expect(digit(0)).toBe("0");
  });

  it("accepte une réponse avec des espaces autour (« 4 »)", async () => {
    createFixture();
    fixture.detectChanges();

    await answer("0");
    await answer(" 4 ");

    expect(testid("padlock-question")?.textContent?.trim()).toBe(PADLOCK_RIDDLES[2].question);
    expect(digit(1)).toBe("4");
  });

  it("mauvaise réponse : affiche un message d’erreur et garde la même question", async () => {
    createFixture();
    fixture.detectChanges();

    await answer("9");

    expect(testid("padlock-question")?.textContent?.trim()).toBe(PADLOCK_RIDDLES[0].question);
    expect(testid("padlock-error")?.textContent?.trim()).toBeTruthy();
  });

  it("fait apparaître « Passer l'énigme » après 3 mauvaises réponses", async () => {
    createFixture();
    fixture.detectChanges();

    expect(testid("skip")).toBeNull();

    await answer("9");
    await answer("9");
    await answer("9");

    expect(testid("skip")).not.toBeNull();
  });

  it("passer le chiffre courant le révèle immédiatement", async () => {
    createFixture();
    fixture.detectChanges();

    await answer("9");
    await answer("9");
    await answer("9");
    testid("skip")?.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(digit(0)).toBe("0");
    expect(testid("padlock-question")?.textContent?.trim()).toBe(PADLOCK_RIDDLES[1].question);
  });

  it("émet `solved` après l’animation, une fois les 4 chiffres trouvés", async () => {
    vi.useFakeTimers();
    try {
      createFixture();
      fixture.detectChanges();

      await answer("0");
      await answer("4");
      await answer("2");
      await answer("7");

      expect(solvedCount).toBe(0);

      await vi.advanceTimersByTimeAsync(1500);

      expect(solvedCount).toBe(1);
      expect(digit(0)).toBe("0");
      expect(digit(1)).toBe("4");
      expect(digit(2)).toBe("2");
      expect(digit(3)).toBe("7");
    } finally {
      vi.useRealTimers();
    }
  });

  it("détruit le composant pendant l'animation d'ouverture : la minuterie est annulée (pas de NG0953)", async () => {
    vi.useFakeTimers();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      createFixture();
      fixture.detectChanges();

      await answer("0");
      await answer("4");
      await answer("2");
      await answer("7");
      expect(solvedCount).toBe(0);

      fixture.destroy();
      vi.advanceTimersByTime(1500);

      expect(solvedCount).toBe(0);
      expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining("NG0953"));
    } finally {
      warnSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("ouvert alors que le cadenas est déjà résolu : affiche 0-4-2-7 sans rien émettre", async () => {
    const service = TestBed.inject(HuntProgressService);
    for (const value of ["0", "4", "2", "7"]) {
      service.answerPadlockDigit(value);
    }

    createFixture();
    fixture.detectChanges();

    expect(digit(0)).toBe("0");
    expect(digit(1)).toBe("4");
    expect(digit(2)).toBe("2");
    expect(digit(3)).toBe("7");
    expect(testid("padlock-question")).toBeNull();
    expect(solvedCount).toBe(0);
  });
});
