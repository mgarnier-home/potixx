import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

/**
 * Bouton « Passer l'énigme », affiché par chaque énigme après trop d'échecs (spec §4.2). Il ne
 * fait qu'émettre `skipped` : l'énigme appelle ensuite `HuntProgressService.skip`.
 */
@Component({
  selector: "app-skip-button",
  template: `
    @if (visible()) {
      <button type="button" class="skip" data-testid="skip" (click)="skipped.emit()">
        Passer l'énigme
      </button>
    }
  `,
  styleUrl: "./skip-button.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkipButton {
  readonly visible = input.required<boolean>();
  readonly skipped = output();
}
