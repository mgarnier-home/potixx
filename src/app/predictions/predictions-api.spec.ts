import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { PROGRESS_STORAGE } from "../hunt/hunt-progress.service";
import type { PredictionInput } from "./core/prediction";
import { PredictionsApi } from "./predictions-api";

const input: PredictionInput = {
  name: "Mamie",
  sex: "girl",
  birthDate: "2027-04-12",
  heightCm: 50,
  weightKg: 3.4,
  eyeColor: "blue",
  firstName: "Zoé",
};

describe("PredictionsApi", () => {
  let api: PredictionsApi;
  let http: HttpTestingController;
  let storage: Storage;

  beforeEach(() => {
    const items = new Map<string, string>();
    storage = {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
    } as unknown as Storage;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PROGRESS_STORAGE, useValue: storage },
      ],
    });
    api = TestBed.inject(PredictionsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it("envoie un pronostic", () => {
    api.create(input).subscribe();
    const req = http.expectOne("/api/predictions");
    expect(req.request.method).toBe("POST");
    expect(req.request.body).toEqual(input);
    req.flush({ ...input, id: "1", createdAt: "2026-11-14T10:00:00Z" });
  });

  it("retient l'envoi seulement quand le serveur l'a accepté", () => {
    expect(api.hasSent()).toBe(false);
    api.create(input).subscribe({ error: () => undefined });
    http.expectOne("/api/predictions").flush(null, { status: 500, statusText: "Server Error" });
    expect(api.hasSent()).toBe(false);

    api.create(input).subscribe();
    http.expectOne("/api/predictions").flush({ ...input, id: "1", createdAt: "" });
    expect(api.hasSent()).toBe(true);
  });

  it("ne transforme pas un envoi réussi en erreur si le stockage local échoue", () => {
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const next = vi.fn();
    const error = vi.fn();
    api.create(input).subscribe({ next, error });
    http.expectOne("/api/predictions").flush({ ...input, id: "1", createdAt: "" });
    expect(next).toHaveBeenCalledOnce();
    expect(error).not.toHaveBeenCalled();
  });

  it("répond non si le stockage local est illisible", () => {
    vi.spyOn(storage, "getItem").mockImplementation(() => {
      throw new Error("refusé");
    });
    expect(api.hasSent()).toBe(false);
  });

  it("liste les pronostics avec le mot de passe", () => {
    api.list("x").subscribe();
    const req = http.expectOne("/api/admin/predictions");
    expect(req.request.method).toBe("GET");
    expect(req.request.headers.get("Authorization")).toBe("Basic Ong=");
    req.flush([]);
  });

  it("supprime un pronostic avec le mot de passe", () => {
    api.remove("abc", "x").subscribe();
    const req = http.expectOne("/api/admin/predictions/abc");
    expect(req.request.method).toBe("DELETE");
    expect(req.request.headers.get("Authorization")).toBe("Basic Ong=");
    req.flush(null, { status: 204, statusText: "No Content" });
  });
});
