import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import type { ComponentFixture } from "@angular/core/testing";
import { TestBed } from "@angular/core/testing";
import { PROGRESS_STORAGE } from "../../hunt/hunt-progress.service";
import { PredictionForm } from "./prediction-form";

describe("PredictionForm", () => {
  let fixture: ComponentFixture<PredictionForm>;
  let element: HTMLElement;
  let http: HttpTestingController;

  beforeEach(async () => {
    const items = new Map<string, string>();
    const storage = {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
    } as unknown as Storage;
    TestBed.configureTestingModule({
      imports: [PredictionForm],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PROGRESS_STORAGE, useValue: storage },
      ],
    });
    fixture = TestBed.createComponent(PredictionForm);
    element = fixture.nativeElement as HTMLElement;
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  const byTestId = <T extends HTMLElement>(id: string) =>
    element.querySelector<T>(`[data-testid="${id}"]`);

  function type(id: string, value: string): void {
    const input = byTestId<HTMLInputElement>(id)!;
    input.value = value;
    input.dispatchEvent(new Event("input"));
  }

  function select(id: string, value: string): void {
    const field = byTestId<HTMLSelectElement>(id)!;
    field.value = value;
    field.dispatchEvent(new Event("change"));
  }

  function fillValid(): void {
    type("prediction-name", "Mamie");
    byTestId<HTMLInputElement>("prediction-sex-girl")!.click();
    select("prediction-birth-day", "12");
    select("prediction-birth-month", "04");
    type("prediction-height", "50");
    type("prediction-weight", "3.4");
    byTestId<HTMLInputElement>("prediction-eye-blue")!.click();
    type("prediction-first-name", "Zoé");
  }

  async function submit(): Promise<void> {
    byTestId<HTMLButtonElement>("prediction-submit")!.click();
    await fixture.whenStable();
  }

  it("n'envoie rien et signale chaque champ quand le formulaire est vide", async () => {
    await submit();
    http.expectNone("/api/predictions");
    for (const field of ["name", "sex", "birth-date", "height", "weight", "eye", "first-name"]) {
      expect(byTestId(`prediction-${field}-error`)?.textContent?.trim()).toBeTruthy();
    }
  });

  it("envoie un pronostic valide puis remercie", async () => {
    fillValid();
    await submit();
    const req = http.expectOne("/api/predictions");
    expect(req.request.body).toEqual({
      name: "Mamie",
      sex: "girl",
      birthDate: "2027-04-12",
      heightCm: 50,
      weightKg: 3.4,
      eyeColor: "blue",
      firstName: "Zoé",
    });
    expect(byTestId<HTMLButtonElement>("prediction-submit")!.disabled).toBe(true);

    req.flush({ ...req.request.body, id: "1", createdAt: "2026-11-14T10:00:00Z" });
    await fixture.whenStable();
    expect(byTestId("prediction-thanks")).not.toBeNull();
    expect(byTestId("prediction-submit")).toBeNull();
  });

  async function sendValid(): Promise<void> {
    fillValid();
    await submit();
    const req = http.expectOne("/api/predictions");
    req.flush({ ...req.request.body, id: "1", createdAt: "2026-11-14T10:00:00Z" });
    await fixture.whenStable();
  }

  it("remercie au retour d'un visiteur qui a déjà envoyé son pronostic", async () => {
    await sendValid();
    fixture = TestBed.createComponent(PredictionForm);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    expect(byTestId("prediction-thanks")).not.toBeNull();
    expect(byTestId("prediction-submit")).toBeNull();
  });

  it("laisse une autre personne du même appareil saisir son pronostic", async () => {
    await sendValid();
    byTestId<HTMLButtonElement>("prediction-another")!.click();
    await fixture.whenStable();
    expect(byTestId("prediction-thanks")).toBeNull();
    expect(byTestId<HTMLInputElement>("prediction-name")!.value).toBe("");
    expect(byTestId("prediction-name-error")?.textContent?.trim()).toBe("");

    await sendValid();
    expect(byTestId("prediction-thanks")).not.toBeNull();
  });

  it("propose uniquement les mois de janvier à juillet, sans année", () => {
    const months = [...byTestId<HTMLSelectElement>("prediction-birth-month")!.options]
      .map((o) => o.text)
      .filter((t) => t !== "Mois");
    expect(months).toEqual(["janvier", "février", "mars", "avril", "mai", "juin", "juillet"]);
    expect(byTestId<HTMLSelectElement>("prediction-birth-day")!.options).toHaveLength(32);
  });

  it("refuse une date qui n'existe pas", async () => {
    fillValid();
    select("prediction-birth-day", "30");
    select("prediction-birth-month", "02");
    await submit();
    http.expectNone("/api/predictions");
    expect(byTestId("prediction-birth-date-error")?.textContent).toContain(
      "Cette date n'existe pas.",
    );
  });

  it("affiche le message du serveur sur une erreur 400 et garde la saisie", async () => {
    fillValid();
    await submit();
    http
      .expectOne("/api/predictions")
      .flush(
        { error: "Le poids doit être compris entre 1 et 7 kg." },
        { status: 400, statusText: "Bad Request" },
      );
    await fixture.whenStable();
    expect(byTestId("prediction-error")?.textContent).toContain("Le poids doit être compris");
    expect(byTestId<HTMLInputElement>("prediction-name")!.value).toBe("Mamie");
    expect(byTestId<HTMLButtonElement>("prediction-submit")!.disabled).toBe(false);
  });

  it("affiche un message générique sur une panne serveur et garde la saisie", async () => {
    fillValid();
    await submit();
    http.expectOne("/api/predictions").flush(null, { status: 500, statusText: "Server Error" });
    await fixture.whenStable();
    expect(byTestId("prediction-error")?.textContent).toContain(
      "L'envoi a échoué, réessayez dans un instant.",
    );
    expect(byTestId<HTMLInputElement>("prediction-first-name")!.value).toBe("Zoé");
  });
});
