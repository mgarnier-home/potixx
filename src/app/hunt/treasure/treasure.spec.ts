import { TestBed } from "@angular/core/testing";
import type { ComponentFixture } from "@angular/core/testing";
import { TREASURE } from "../hunt-content";
import { HuntProgressService, PROGRESS_STORAGE, SEED_FACTORY } from "../hunt-progress.service";
import { CHEST_OPENING_MS, Treasure } from "./treasure";

describe("Treasure", () => {
  let fixture: ComponentFixture<Treasure>;
  let restartedCount: number;

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function testid(id: string): HTMLElement | null {
    return el().querySelector(`[data-testid="${id}"]`);
  }

  /** Vrai si l'écran a marqué la révélation (vidéo + message) comme visible. */
  function isRevealed(): boolean {
    return el().querySelector(".treasure")?.classList.contains("is-revealed") ?? false;
  }

  function createComponent(): void {
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

    it("la vidéo et le message ne sont révélés qu'une fois le coffre ouvert", async () => {
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

  describe("contenu et « Recommencer »", () => {
    beforeEach(() => {
      createComponent();
    });

    it("affiche le coffre au trésor", () => {
      expect(testid("treasure-chest")).not.toBeNull();
    });

    it("affiche le message exact du trésor", () => {
      expect(testid("treasure-message")?.textContent?.trim()).toBe(TREASURE.message);
    });

    it("affiche la vidéo sans son, adaptée à iOS, avec contrôles et affiche", () => {
      const video = testid("treasure-video") as HTMLVideoElement;
      expect(video).not.toBeNull();
      // La propriété `muted`, pas seulement l'attribut : un attribut statique ne coupe le son
      // qu'à la création, `defaultMuted` restant vrai mais `video.muted` pouvant valoir faux.
      expect(video.muted).toBe(true);
      expect(video.hasAttribute("playsinline")).toBe(true);
      expect(video.hasAttribute("controls")).toBe(true);
      expect(video.src).toContain(TREASURE.videoSrc);
      expect(video.poster).toContain(TREASURE.posterSrc);
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
