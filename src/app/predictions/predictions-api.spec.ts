import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
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

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
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
