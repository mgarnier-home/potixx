import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { tap } from "rxjs";
import type { Observable } from "rxjs";
import { PROGRESS_STORAGE } from "../hunt/hunt-progress.service";
import { basicAuthHeader } from "./core/prediction";
import type { Prediction, PredictionInput } from "./core/prediction";

const SENT_KEY = "potixx.prediction.sent";

/** Appels au backend Go (`backend/predictions/handlers.go`). */
@Injectable({ providedIn: "root" })
export class PredictionsApi {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(PROGRESS_STORAGE);

  create(input: PredictionInput): Observable<Prediction> {
    return this.http
      .post<Prediction>("/api/predictions", input)
      .pipe(tap(() => this.rememberSent()));
  }

  /** Ce navigateur a-t-il déjà envoyé un pronostic ? */
  hasSent(): boolean {
    try {
      return this.storage?.getItem(SENT_KEY) === "1";
    } catch {
      return false;
    }
  }

  private rememberSent(): void {
    try {
      this.storage?.setItem(SENT_KEY, "1");
    } catch {
      // Le pronostic est enregistré : un stockage local plein ne doit pas afficher d'erreur.
    }
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
