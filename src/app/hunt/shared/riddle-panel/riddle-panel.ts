import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

/**
 * Panneau commun des écrans d'étape : un feuillet de parchemin avec le titre de l'étape et un
 * bouton « Retour à la carte ». Le contenu de l'énigme est projeté à l'intérieur.
 */
@Component({
  selector: "app-riddle-panel",
  templateUrl: "./riddle-panel.html",
  styleUrl: "./riddle-panel.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiddlePanel {
  readonly title = input.required<string>();
  readonly closed = output();
}
