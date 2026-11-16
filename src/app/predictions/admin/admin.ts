import { HttpErrorResponse } from "@angular/common/http";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import type { EyeColor, Prediction, Sex } from "../core/prediction";
import { EYE_COLORS, SEXES } from "../prediction-content";
import { PredictionsApi } from "../predictions-api";

const SENT_AT = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

/** Page /admin : liste et suppression des pronostics, protégée par mot de passe. */
@Component({
  selector: "app-admin",
  templateUrl: "./admin.html",
  styleUrl: "./admin.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Admin {
  private readonly api = inject(PredictionsApi);

  /** Gardé en mémoire uniquement : jamais dans le stockage du navigateur. */
  protected readonly password = signal("");
  protected readonly predictions = signal<Prediction[] | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(false);

  protected login(event: Event): void {
    event.preventDefault();
    this.loading.set(true);
    this.error.set(null);
    this.api.list(this.password()).subscribe({
      next: (list) => {
        this.loading.set(false);
        this.predictions.set(list);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(messageOf(err));
      },
    });
  }

  protected remove(prediction: Prediction): void {
    if (!confirm(`Supprimer le pronostic de ${prediction.name} ?`)) return;
    const drop = () =>
      this.predictions.update((list) => list?.filter((p) => p.id !== prediction.id) ?? null);
    this.api.remove(prediction.id, this.password()).subscribe({
      next: drop,
      error: (err: unknown) => {
        // 404 : déjà supprimé (double clic, autre onglet) — la ligne n'a plus lieu d'être.
        if (err instanceof HttpErrorResponse && err.status === 404) drop();
        else this.error.set(messageOf(err));
      },
    });
  }

  protected sexLabel(value: Sex): string {
    return SEXES.find((s) => s.value === value)?.label ?? value;
  }

  protected eyeLabel(value: EyeColor): string {
    return EYE_COLORS.find((c) => c.value === value)?.label ?? value;
  }

  /** AAAA-MM-JJ → JJ/MM/AAAA, sans passer par `Date` (pas de décalage de fuseau). */
  protected birthDate(value: string): string {
    return value.split("-").reverse().join("/");
  }

  /** Décimale à la française : 3,4. */
  protected number(value: number): string {
    return value.toLocaleString("fr-FR");
  }

  protected sentAt(value: string): string {
    return SENT_AT.format(new Date(value));
  }
}

function messageOf(err: unknown): string {
  if (err instanceof HttpErrorResponse && err.status === 401) return "Mot de passe incorrect.";
  if (err instanceof HttpErrorResponse && err.status === 503)
    return "Administration non configurée.";
  return "Le serveur ne répond pas, réessayez dans un instant.";
}
