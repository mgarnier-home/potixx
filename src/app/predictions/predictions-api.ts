import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import type { Observable } from "rxjs";
import { basicAuthHeader } from "./core/prediction";
import type { Prediction, PredictionInput } from "./core/prediction";

/** Appels au backend Go (`backend/predictions/handlers.go`). */
@Injectable({ providedIn: "root" })
export class PredictionsApi {
  private readonly http = inject(HttpClient);

  create(input: PredictionInput): Observable<Prediction> {
    return this.http.post<Prediction>("/api/predictions", input);
  }

  list(password: string): Observable<Prediction[]> {
    return this.http.get<Prediction[]>("/api/admin/predictions", { headers: auth(password) });
  }

  remove(id: string, password: string): Observable<void> {
    return this.http.delete<void>(`/api/admin/predictions/${encodeURIComponent(id)}`, {
      headers: auth(password),
    });
  }
}

function auth(password: string): HttpHeaders {
  return new HttpHeaders({ Authorization: basicAuthHeader(password) });
}
