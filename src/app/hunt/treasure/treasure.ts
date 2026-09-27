import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { TREASURE } from '../hunt-content';
import { HuntProgressService } from '../hunt-progress.service';

/**
 * Écran final : le trésor (spec §4.7). Le coffre s'ouvre à chaque ouverture de l'écran (c'est la
 * récompense), puis la vidéo et le message de l'annonce apparaissent. « Recommencer » demande une
 * confirmation avant d'effacer la progression et de revenir à la carte (géré par `App` via
 * `restarted`).
 */
@Component({
  selector: 'app-treasure',
  templateUrl: './treasure.html',
  styleUrl: './treasure.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Treasure {
  private readonly progress = inject(HuntProgressService);

  /** Émis après confirmation, une fois la progression réinitialisée. */
  readonly restarted = output<void>();

  protected readonly videoSrc = TREASURE.videoSrc;
  protected readonly posterSrc = TREASURE.posterSrc;
  protected readonly message = TREASURE.message;

  protected onRestart(): void {
    if (!window.confirm('Recommencer la chasse depuis le début ?')) {
      return;
    }

    this.progress.restart();
    this.restarted.emit();
  }
}
