import { HttpErrorResponse } from "@angular/common/http";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { map } from "rxjs";
import { validatePrediction } from "../core/prediction";
import type { PredictionErrors, PredictionFormValue, PredictionInput } from "../core/prediction";
import { EYE_COLORS, PREDICTION_LIMITS, SEXES } from "../prediction-content";
import { PredictionsApi } from "../predictions-api";

/** Onglet « Pronostics » : formulaire d'envoi d'un pronostic sur le bébé. */
@Component({
  selector: "app-prediction-form",
  imports: [ReactiveFormsModule],
  templateUrl: "./prediction-form.html",
  styleUrl: "./prediction-form.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PredictionForm {
  private readonly api = inject(PredictionsApi);

  protected readonly limits = PREDICTION_LIMITS;
  protected readonly sexes = SEXES;
  protected readonly eyeColors = EYE_COLORS;

  protected readonly form = new FormGroup({
    name: new FormControl("", { nonNullable: true }),
    sex: new FormControl("", { nonNullable: true }),
    birthDate: new FormControl("", { nonNullable: true }),
    heightCm: new FormControl<number | null>(null),
    weightKg: new FormControl<number | null>(null),
    eyeColor: new FormControl("", { nonNullable: true }),
    firstName: new FormControl("", { nonNullable: true }),
  });

  private readonly value = toSignal(
    this.form.valueChanges.pipe(map((): PredictionFormValue => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  /** Les erreurs ne s'affichent qu'après la première tentative d'envoi, puis suivent la saisie. */
  private readonly attempted = signal(false);
  protected readonly errors = computed<PredictionErrors>(() =>
    this.attempted() ? validatePrediction(this.value()) : {},
  );

  protected readonly status = signal<"editing" | "sending" | "sent">("editing");
  protected readonly serverError = signal<string | null>(null);

  protected submit(): void {
    this.attempted.set(true);
    const value = this.form.getRawValue();
    if (Object.keys(validatePrediction(value)).length > 0 || this.status() !== "editing") {
      return;
    }
    this.status.set("sending");
    this.serverError.set(null);
    // La validation garantit les types : sexe et couleur connus, nombres renseignés.
    this.api.create(value as PredictionInput).subscribe({
      next: () => this.status.set("sent"),
      error: (err: unknown) => {
        this.status.set("editing");
        this.serverError.set(messageOf(err));
      },
    });
  }
}

function messageOf(err: unknown): string {
  const body: unknown = err instanceof HttpErrorResponse ? err.error : null;
  if (err instanceof HttpErrorResponse && err.status === 400 && isErrorBody(body)) {
    return body.error;
  }
  return "L'envoi a échoué, réessayez dans un instant.";
}

function isErrorBody(body: unknown): body is { error: string } {
  return (
    typeof body === "object" &&
    body !== null &&
    typeof (body as { error?: unknown }).error === "string"
  );
}
