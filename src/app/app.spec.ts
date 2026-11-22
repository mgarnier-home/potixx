import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import type { ComponentFixture } from "@angular/core/testing";
import { TestBed } from "@angular/core/testing";
import { Router, provideRouter } from "@angular/router";
import { App } from "./app";
import { routes } from "./app.routes";
import { PROGRESS_STORAGE, SEED_FACTORY } from "./hunt/hunt-progress.service";

describe("App (onglets)", () => {
  let fixture: ComponentFixture<App>;
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PROGRESS_STORAGE, useValue: null },
        { provide: SEED_FACTORY, useValue: () => 42 },
      ],
    });
    fixture = TestBed.createComponent(App);
    element = fixture.nativeElement as HTMLElement;
  });

  async function navigate(url: string): Promise<void> {
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
  }

  const tab = (id: string) => element.querySelector<HTMLAnchorElement>(`[data-testid="${id}"]`);

  it("affiche la chasse sur / avec l'onglet correspondant actif", async () => {
    await navigate("/");
    expect(element.querySelector("app-hunt")).not.toBeNull();
    expect(tab("tab-hunt")?.getAttribute("aria-current")).toBe("page");
    expect(tab("tab-predictions")?.getAttribute("aria-current")).toBeNull();
  });

  it("passe à l'onglet Pronostics au clic", async () => {
    await navigate("/");
    tab("tab-predictions")?.click();
    await fixture.whenStable();
    expect(element.querySelector("app-prediction-form")).not.toBeNull();
    expect(element.querySelector("app-hunt")).toBeNull();
    expect(tab("tab-predictions")?.getAttribute("aria-current")).toBe("page");
    expect(tab("tab-hunt")?.getAttribute("aria-current")).toBeNull();
  });

  it("affiche l'admin sur /admin sans onglet actif", async () => {
    await navigate("/admin");
    expect(element.querySelector("app-admin")).not.toBeNull();
    expect(element.querySelector('[aria-current="page"]')).toBeNull();
  });

  it("écrit la version publiée dans la console au chargement", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    TestBed.inject(HttpTestingController).expectOne("/version").flush({
      version: "0.2.0",
      commit: "ee741c4461ec40454f2826f82a1efad846addc6e",
      date: "2026-11-22T19:57:38Z",
    });
    expect(info).toHaveBeenCalledExactlyOnceWith("Potixx v0.2.0 (ee741c4, 2026-11-22T19:57:38Z)");
    info.mockRestore();
  });

  it("n'écrit rien et garde le site utilisable si la version est indisponible", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    TestBed.inject(HttpTestingController)
      .expectOne("/version")
      .flush(null, { status: 502, statusText: "Bad Gateway" });
    await navigate("/");
    expect(info).not.toHaveBeenCalled();
    expect(element.querySelector("app-hunt")).not.toBeNull();
    info.mockRestore();
  });

  it("ramène une route inconnue vers la chasse", async () => {
    await navigate("/nimporte");
    expect(element.querySelector("app-hunt")).not.toBeNull();
  });
});
