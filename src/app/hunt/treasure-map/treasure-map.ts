import { ChangeDetectionStrategy, Component, computed, inject, output } from "@angular/core";
import { MAP, STEP_ORDER } from "../hunt-content";
import type { StepId } from "../hunt-content";
import { HuntProgressService } from "../hunt-progress.service";

/** État d'affichage d'une étape sur la carte (spec §4.1). */
export type StepStatus = "locked" | "current" | "solved";

/** Une étape telle que la carte l'affiche. */
interface MapStep {
  id: StepId;
  label: string;
  /** Numéro d'ordre (1 à 4) des énigmes ; le trésor n'en a pas, il est marqué d'une croix. */
  number: number | null;
  x: number;
  y: number;
  status: StepStatus;
}

/**
 * Carte au trésor : affiche les cinq étapes sur le chemin et émet l'étape choisie. Une étape
 * verrouillée ne réagit pas (spec §4.1) : elle reste focalisable pour être annoncée, mais n'émet
 * rien.
 */
@Component({
  selector: "app-treasure-map",
  templateUrl: "./treasure-map.html",
  styleUrl: "./treasure-map.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TreasureMap {
  private readonly progress = inject(HuntProgressService);

  /** Émis au toucher d'une étape débloquée (en cours ou résolue). */
  readonly stepSelected = output<StepId>();

  protected readonly imageSrc = MAP.imageSrc;

  protected readonly steps = computed<MapStep[]>(() => {
    const currentIndex = STEP_ORDER.indexOf(this.progress.currentStep());
    return STEP_ORDER.map((id, index) => ({
      id,
      label: MAP.steps[id].label,
      number: id === "treasure" ? null : index + 1,
      x: MAP.steps[id].x,
      y: MAP.steps[id].y,
      status: index < currentIndex ? "solved" : index === currentIndex ? "current" : "locked",
    }));
  });

  protected select(step: MapStep): void {
    if (step.status !== "locked") {
      this.stepSelected.emit(step.id);
    }
  }
}
