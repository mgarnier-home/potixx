import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { Crossword } from "./crossword/crossword";
import { MAP } from "./hunt-content";
import type { StepId } from "./hunt-content";
import { PadlockRiddle } from "./padlock-riddle/padlock-riddle";
import { PasswordRiddle } from "./password-riddle/password-riddle";
import { RiddlePanel } from "./shared/riddle-panel/riddle-panel";
import { Treasure } from "./treasure/treasure";
import { TreasureMap } from "./treasure-map/treasure-map";
import { WordSearch } from "./word-search/word-search";

/**
 * Onglet « Chasse au trésor » : la carte au trésor, ou l'écran de l'étape ouverte dans un
 * `RiddlePanel`. Chaque composant d'énigme émet `solved`, ce qui ramène à la carte.
 */
@Component({
  selector: "app-hunt",
  imports: [
    RiddlePanel,
    TreasureMap,
    PadlockRiddle,
    PasswordRiddle,
    Crossword,
    WordSearch,
    Treasure,
  ],
  templateUrl: "./hunt.html",
  styleUrl: "./hunt.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Hunt {
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
