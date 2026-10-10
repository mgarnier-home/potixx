import { TestBed } from "@angular/core/testing";
import type { ComponentFixture } from "@angular/core/testing";
import { TREASURE } from "../hunt-content";
import { HuntProgressService, PROGRESS_STORAGE, SEED_FACTORY } from "../hunt-progress.service";
import { CHEST_OPENING_MS, TREASURE_RANDOM, Treasure } from "./treasure";

describe("Treasure", () => {
  let fixture: ComponentFixture<Treasure>;
  let restartedCount: number;

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function testid(id: string): HTMLElement | null {
    return el().querySelector(`[data-testid="${id}"]`);
  }

  /** Vrai si l'écran a marqué la révélation (message + animation) comme visible. */
  function isRevealed(): boolean {
    return el().querySelector(".treasure")?.classList.contains("is-revealed") ?? false;
  }

  /** `random` remplace le tirage qui choisit l'animation du bébé (0 → coffre, 0,99 → mouette). */
  function createComponent(random?: () => number): void {
    if (random) {
      TestBed.overrideProvider(TREASURE_RANDOM, { useValue: random });
    }
    fixture = TestBed.createComponent(Treasure);
    restartedCount = 0;
    fixture.componentInstance.restarted.subscribe(() => restartedCount++);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Treasure],
      providers: [
        { provide: PROGRESS_STORAGE, useValue: null },
        { provide: SEED_FACTORY, useValue: () => 42 },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("ouverture du coffre puis révélation", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("l'ouverture dure au plus 2 s", () => {
      expect(CHEST_OPENING_MS).toBeGreaterThan(0);
      expect(CHEST_OPENING_MS).toBeLessThanOrEqual(2000);
    });

    it("le message et l'animation ne sont révélés qu'une fois le coffre ouvert", async () => {
      createComponent();
      expect(isRevealed()).toBe(false);

      await vi.advanceTimersByTimeAsync(CHEST_OPENING_MS - 1);
      fixture.detectChanges();
      expect(isRevealed()).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      fixture.detectChanges();
      expect(isRevealed()).toBe(true);
    });

    it("mouvements réduits : la révélation est immédiate", () => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn((query: string) => ({ matches: query.includes("reduce"), media: query })),
      );
      createComponent();
      expect(isRevealed()).toBe(true);
    });
  });

  describe("scène tirée au sort à chaque ouverture", () => {
    /** Attribut `data-animation` de l'écran : la scène retenue par le tirage. */
    function drawnAnimation(): string | null {
      return el().querySelector(".treasure")?.getAttribute("data-animation") ?? null;
    }

    it("tirage bas : le coffre, d'où sort le bébé, sans la mouette", () => {
      createComponent(() => 0);
      expect(drawnAnimation()).toBe("chest");
      expect(testid("treasure-chest")).not.toBeNull();
      expect(testid("treasure-chest")?.querySelector('[data-testid="chest-baby"]')).not.toBeNull();
      expect(testid("treasure-gull")).toBeNull();
      expect(el().querySelector("app-baby-gull")).toBeNull();
    });

    it("tirage haut : la mouette et son baluchon, sans le coffre", () => {
      createComponent(() => 0.99);
      expect(drawnAnimation()).toBe("gull");
      expect(testid("treasure-gull")?.querySelector("app-baby-gull")).not.toBeNull();
      expect(testid("treasure-chest")).toBeNull();
      expect(testid("chest-baby")).toBeNull();
    });

    it("la mouette porte une description pour les lecteurs d'écran", () => {
      createComponent(() => 0.99);
      expect(el().querySelector("app-baby-gull svg")?.getAttribute("aria-label")).toBeTruthy();
    });

    it("sous la scène, il ne reste que le message et « Recommencer »", () => {
      for (const random of [() => 0, () => 0.99]) {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
          imports: [Treasure],
          providers: [
            { provide: PROGRESS_STORAGE, useValue: null },
            { provide: SEED_FACTORY, useValue: () => 42 },
          ],
        });
        createComponent(random);
        const reveal = el().querySelector(".reveal");
        expect(reveal?.querySelector('[data-testid="treasure-message"]')).not.toBeNull();
        expect(reveal?.querySelector('[data-testid="restart"]')).not.toBeNull();
        expect(reveal?.querySelector("app-baby-gull, video, .animation")).toBeNull();
      }
    });
  });

  describe("contenu et « Recommencer »", () => {
    beforeEach(() => {
      createComponent();
    });

    it("affiche le message exact du trésor", () => {
      expect(testid("treasure-message")?.textContent?.trim()).toBe(TREASURE.message);
    });

    it("n'affiche plus de vidéo", () => {
      expect(el().querySelector("video")).toBeNull();
    });

    it("« Recommencer » annulé (confirm → false) : ne réinitialise rien et n'émet rien", () => {
      const service = TestBed.inject(HuntProgressService);
      const restartSpy = vi.spyOn(service, "restart");
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

      (testid("restart") as HTMLButtonElement).click();

      expect(confirmSpy).toHaveBeenCalledWith("Recommencer la chasse depuis le début ?");
      expect(restartSpy).not.toHaveBeenCalled();
      expect(restartedCount).toBe(0);
    });

    it("« Recommencer » confirmé (confirm → true) : réinitialise la progression et émet `restarted`", () => {
      const service = TestBed.inject(HuntProgressService);
      const restartSpy = vi.spyOn(service, "restart");
      vi.spyOn(window, "confirm").mockReturnValue(true);

      (testid("restart") as HTMLButtonElement).click();

      expect(restartSpy).toHaveBeenCalledTimes(1);
      expect(restartedCount).toBe(1);
    });
  });
});
