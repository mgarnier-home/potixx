import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MAP } from './hunt/hunt-content';
import type { StepId } from './hunt/hunt-content';
import { PadlockRiddle } from './hunt/padlock-riddle/padlock-riddle';
import { RiddlePanel } from './hunt/shared/riddle-panel/riddle-panel';
import { TreasureMap } from './hunt/treasure-map/treasure-map';

/**
 * Coquille de l'application : la carte au trésor, ou l'écran de l'étape ouverte dans un
 * `RiddlePanel`. Chaque composant d'énigme émet `solved`, ce qui ramène à la carte.
 */
@Component({
  selector: 'app-root',
  imports: [RiddlePanel, TreasureMap, PadlockRiddle],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  /** Étape ouverte, ou `null` quand la carte est affichée. */
  readonly openStep = signal<StepId | null>(null);

  protected stepLabel(step: StepId): string {
    return MAP.steps[step].label;
  }

  protected openMapStep(step: StepId): void {
    this.openStep.set(step);
  }

  /** Retour à la carte (bouton « Retour à la carte » ou énigme résolue). */
  protected backToMap(): void {
    this.openStep.set(null);
  }
}
