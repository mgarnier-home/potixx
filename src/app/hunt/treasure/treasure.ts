import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  output,
  signal,
} from "@angular/core";
import { TREASURE } from "../hunt-content";
import { HuntProgressService } from "../hunt-progress.service";

/**
 * Durée de l'ouverture du coffre (ms), avant la révélation de la vidéo et du message. Transmise
 * aux styles (`--opening-duration`) : les étapes de l'animation sont en pourcentage de cette durée.
 */
export const CHEST_OPENING_MS = 1800;

/** Vrai si le visiteur a demandé de réduire les animations (faux si l'API est indisponible). */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Écran final : le trésor (spec §4.7). Le coffre s'ouvre à chaque ouverture de l'écran (c'est la
 * récompense), puis, une fois le couvercle ouvert, la vidéo et le message de l'annonce
 * apparaissent (tout de suite si « mouvements réduits »). « Recommencer » demande une confirmation
 * avant d'effacer la progression et de revenir à la carte (géré par `App` via `restarted`).
 */
@Component({
  selector: "app-treasure",
  templateUrl: "./treasure.html",
  styleUrl: "./treasure.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Treasure {
  private readonly progress = inject(HuntProgressService);

  /** Émis après confirmation, une fois la progression réinitialisée. */
  readonly restarted = output<void>();

  protected readonly videoSrc = TREASURE.videoSrc;
  protected readonly posterSrc = TREASURE.posterSrc;
  protected readonly message = TREASURE.message;
  protected readonly openingDuration = `${CHEST_OPENING_MS}ms`;

  /** Vrai une fois le coffre ouvert : la vidéo, le message et « Recommencer » sont montrés. */
  protected readonly revealed = signal(prefersReducedMotion());

  constructor() {
    if (!this.revealed()) {
      // Minuterie de la même durée que l'animation CSS (plus fiable qu'`animationend`, qui ne se
      // déclenche pas si l'animation est interrompue ou désactivée).
      const timer = setTimeout(() => this.revealed.set(true), CHEST_OPENING_MS);
      inject(DestroyRef).onDestroy(() => clearTimeout(timer));
    }
  }

  protected onRestart(): void {
    if (!window.confirm("Recommencer la chasse depuis le début ?")) {
      return;
    }

    this.progress.restart();
    this.restarted.emit();
  }
}
