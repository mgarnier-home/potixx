import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import type { ComponentFixture } from "@angular/core/testing";
import { TestBed } from "@angular/core/testing";
import type { Prediction } from "../core/prediction";
import { Admin } from "./admin";

const prediction = (id: string, name: string): Prediction => ({
  id,
  name,
  sex: "girl",
  birthDate: "2027-04-12",
  heightCm: 50,
  weightKg: 3.4,
  eyeColor: "blue",
  firstName: "Zoé",
  createdAt: "2026-11-14T10:00:00Z",
});

describe("Admin", () => {
  let fixture: ComponentFixture<Admin>;
  let element: HTMLElement;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [Admin],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(Admin);
    element = fixture.nativeElement as HTMLElement;
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  const byTestId = <T extends HTMLElement>(id: string) =>
    element.querySelector<T>(`[data-testid="${id}"]`);
  const rows = () => element.querySelectorAll('[data-testid="admin-row"]');

  async function login(password: string): Promise<void> {
    const input = byTestId<HTMLInputElement>("admin-password")!;
    input.value = password;
    input.dispatchEvent(new Event("input"));
    byTestId<HTMLButtonElement>("admin-login")!.click();
    await fixture.whenStable();
  }

  async function loginWith(list: Prediction[]): Promise<void> {
    await login("secret");
    const req = http.expectOne("/api/admin/predictions");
    expect(req.request.headers.get("Authorization")).toBe("Basic OnNlY3JldA==");
    req.flush(list);
    await fixture.whenStable();
  }

  it("affiche le tableau après connexion, avec les libellés français", async () => {
    await loginWith([prediction("1", "Mamie")]);
    expect(rows()).toHaveLength(1);
    const text = byTestId("admin-table")!.textContent!;
    expect(text).toContain("Mamie");
    expect(text).toContain("Fille");
    expect(text).toContain("Bleus");
    expect(text).toContain("3,4 kg");
    expect(text).toContain("12/04/2027");
    expect(text).toContain("14/11/2026");
    expect(byTestId("admin-password")).toBeNull();
  });

  it("signale un mauvais mot de passe et garde le champ", async () => {
    await login("faux");
    http
      .expectOne("/api/admin/predictions")
      .flush({ error: "Mot de passe incorrect." }, { status: 401, statusText: "Unauthorized" });
    await fixture.whenStable();
    expect(byTestId("admin-error")?.textContent).toContain("Mot de passe incorrect.");
    expect(byTestId("admin-password")).not.toBeNull();
  });

  it("signale une administration non configurée", async () => {
    await login("x");
    http
      .expectOne("/api/admin/predictions")
      .flush({ error: "" }, { status: 503, statusText: "Service Unavailable" });
    await fixture.whenStable();
    expect(byTestId("admin-error")?.textContent).toContain("Administration non configurée.");
  });

  it("supprime une ligne après confirmation", async () => {
    await loginWith([prediction("1", "Mamie"), prediction("2", "Papi")]);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    element.querySelector<HTMLButtonElement>('[data-testid="admin-delete"]')!.click();
    const req = http.expectOne("/api/admin/predictions/1");
    expect(req.request.method).toBe("DELETE");
    req.flush(null, { status: 204, statusText: "No Content" });
    await fixture.whenStable();
    expect(rows()).toHaveLength(1);
    expect(byTestId("admin-table")!.textContent).not.toContain("Mamie");
  });

  it("retire aussi la ligne quand le pronostic a déjà disparu (404)", async () => {
    await loginWith([prediction("1", "Mamie")]);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    element.querySelector<HTMLButtonElement>('[data-testid="admin-delete"]')!.click();
    http
      .expectOne("/api/admin/predictions/1")
      .flush({ error: "Pronostic introuvable." }, { status: 404, statusText: "Not Found" });
    await fixture.whenStable();
    expect(rows()).toHaveLength(0);
  });

  it("n'envoie rien si la suppression n'est pas confirmée", async () => {
    await loginWith([prediction("1", "Mamie")]);
    vi.spyOn(window, "confirm").mockReturnValue(false);
    element.querySelector<HTMLButtonElement>('[data-testid="admin-delete"]')!.click();
    http.expectNone("/api/admin/predictions/1");
    expect(rows()).toHaveLength(1);
  });
});
