import { TestBed } from "@angular/core/testing";
import type { ComponentFixture } from "@angular/core/testing";
import { PASSWORD } from "../hunt-content";
import { HuntProgressService, PROGRESS_STORAGE, SEED_FACTORY } from "../hunt-progress.service";
import { PasswordRiddle } from "./password-riddle";

describe("PasswordRiddle", () => {
  let fixture: ComponentFixture<PasswordRiddle>;
  let solvedCount: number;

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function testid(id: string): HTMLElement | null {
    return el().querySelector(`[data-testid="${id}"]`);
  }

  async function answer(value: string): Promise<void> {
    const input = testid("password-input") as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event("input"));
    fixture.detectChanges();
    (testid("password-submit") as HTMLButtonElement | null)?.click();
    fixture.detectChanges();
  }

  function createFixture(): void {
    fixture = TestBed.createComponent(PasswordRiddle);
    solvedCount = 0;
    fixture.componentInstance.solved.subscribe(() => solvedCount++);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PasswordRiddle],
      providers: [
        { provide: PROGRESS_STORAGE, useValue: null },
        { provide: SEED_FACTORY, useValue: () => 42 },
      ],
    });
  });

  it("n'affiche que le premier indice (l'image) à l'ouverture", async () => {
    createFixture();
    fixture.detectChanges();

    expect(testid("password-clue-0")).not.toBeNull();
    expect(testid("password-clue-1")).toBeNull();
    expect(testid("password-clue-2")).toBeNull();
  });

  it("mauvaise réponse : affiche un message d’erreur et révèle le deuxième indice", async () => {
    createFixture();
    fixture.detectChanges();

    await answer("pirate");

    expect(testid("password-error")?.textContent?.trim()).toBeTruthy();
    expect(testid("password-clue-1")).not.toBeNull();
    expect(testid("password-clue-2")).toBeNull();
  });

  it("deux mauvaises réponses : révèle le troisième indice (le rébus dessiné)", async () => {
    createFixture();
    fixture.detectChanges();

    await answer("pirate");
    await answer("pirate");

    const rebus = testid("password-clue-2");
    expect(rebus).not.toBeNull();
    // Le rébus ne doit jamais écrire le mot « Fa » : c'est au joueur de lire la note dessinée.
    expect(rebus?.textContent).not.toContain("Fa");
    expect(rebus?.textContent).toContain("1000");

    const svg = rebus?.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("role")).toBe("img");
    const labelledText =
      svg?.getAttribute("aria-label") ?? svg?.querySelector("title")?.textContent ?? "";
    expect(labelledText).toBe("Rébus : une note de musique sur une portée, plus 1000");

    // Une note dessinée (tête de note) et une portée à 5 lignes, pas juste la clé.
    expect(svg?.querySelectorAll("line").length).toBe(5);
    expect(svg?.querySelector("ellipse")).not.toBeNull();
  });

  it("le champ de réponse est conçu pour ne jamais déclencher un gestionnaire de mots de passe", async () => {
    createFixture();
    fixture.detectChanges();

    const input = testid("password-input") as HTMLInputElement;
    expect(input.type).toBe("text");
    expect(input.getAttribute("autocomplete")).toBe("off");
    expect(input.getAttribute("autocapitalize")).toBe("none");
    expect(input.getAttribute("spellcheck")).toBe("false");
    expect(input.hasAttribute("data-bwignore")).toBe(true);
    expect(input.getAttribute("data-1p-ignore")).not.toBeNull();
    expect(input.getAttribute("data-lpignore")).toBe("true");

    // Ni l'id, ni le name, ni le libellé ne doivent contenir « password » ou « mot de passe » :
    // c'est ce qui fait apparaître Bitwarden/1Password/LastPass sur le champ.
    expect((input.id ?? "").toLowerCase()).not.toContain("password");
    expect((input.getAttribute("name") ?? "").toLowerCase()).not.toContain("password");
    expect((input.getAttribute("autocomplete") ?? "").toLowerCase()).not.toContain("password");

    const label = el().querySelector(`label[for="${input.id}"]`);
    expect(label?.textContent?.trim()).toBe("Le mot secret");
  });

  it("fait apparaître « Passer l'énigme » après 3 mauvaises réponses", async () => {
    createFixture();
    fixture.detectChanges();

    expect(testid("skip")).toBeNull();

    await answer("pirate");
    await answer("pirate");
    await answer("pirate");

    expect(testid("skip")).not.toBeNull();
  });

  it("« Passer l'énigme » affiche la réponse sans félicitations, puis « Continuer » émet `solved`", async () => {
    createFixture();
    fixture.detectChanges();

    await answer("pirate");
    await answer("pirate");
    await answer("pirate");
    testid("skip")?.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(el().textContent).not.toContain("Bravo");
    expect(el().textContent?.toLowerCase()).toContain("famille");
    expect(solvedCount).toBe(0);

    const continueButton = testid("password-continue") as HTMLButtonElement | null;
    expect(continueButton).not.toBeNull();
    continueButton?.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(solvedCount).toBe(1);
  });

  it("détruit le composant pendant l'animation de succès : la minuterie est annulée (pas de NG0953)", async () => {
    vi.useFakeTimers();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      createFixture();
      fixture.detectChanges();

      await answer("FAMILLE");
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

  it("« FAMILLE » émet `solved` après la brève animation de succès", async () => {
    vi.useFakeTimers();
    try {
      createFixture();
      fixture.detectChanges();

      await answer("FAMILLE");

      expect(solvedCount).toBe(0);

      await vi.advanceTimersByTimeAsync(1500);

      expect(solvedCount).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("accepte les variantes de casse, accents et espaces (« FAMILLE », « Famille » avec espaces)", async () => {
    vi.useFakeTimers();
    try {
      createFixture();
      fixture.detectChanges();

      await answer(" Famille ");

      expect(testid("password-error")).toBeNull();

      await vi.advanceTimersByTimeAsync(1500);

      expect(solvedCount).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ouvert alors que le mot de passe est déjà résolu : affiche tous les indices et la réponse, sans rien émettre", async () => {
    const service = TestBed.inject(HuntProgressService);
    service.answerPassword(PASSWORD.answer);

    createFixture();
    fixture.detectChanges();

    expect(testid("password-clue-0")).not.toBeNull();
    expect(testid("password-clue-1")).not.toBeNull();
    expect(testid("password-clue-2")).not.toBeNull();
    expect(testid("password-input")).toBeNull();
    expect(el().textContent?.toLowerCase()).toContain("famille");
    expect(solvedCount).toBe(0);
  });
});
