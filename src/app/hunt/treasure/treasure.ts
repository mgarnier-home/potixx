import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  InjectionToken,
  inject,
  output,
  signal,
} from "@angular/core";
import { pickTreasureAnimation } from "../core/treasure-animation";
import { TREASURE } from "../hunt-content";
import { HuntProgressService } from "../hunt-progress.service";
import { BabyGull } from "./baby-gull/baby-gull";

/**
 * Durée de l'ouverture du coffre ou de l'arrivée de la mouette (ms), avant la révélation du message. Transmise
 * aux styles (`--opening-duration`) : les étapes de l'animation sont en pourcentage de cette durée.
 */
export const CHEST_OPENING_MS = 1800;

/**
 * Source de hasard pour le choix de la scène (coffre ou mouette), injectable pour permettre des tests
 * déterministes (voir `treasure.spec.ts`).
 */
export const TREASURE_RANDOM = new InjectionToken<() => number>("TREASURE_RANDOM", {
  providedIn: "root",
  factory: () => Math.random,
});

/** Vrai si le visiteur a demandé de réduire les animations (faux si l'API est indisponible). */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Écran final : le trésor (spec §4.7). Une scène est tirée au sort à chaque ouverture de l'écran :
 * soit le coffre s'ouvre et le bébé pirate en sort, soit la mouette-cigogne arrive avec le bébé
 * dans son baluchon. Le message de l'annonce apparaît ensuite (tout de suite si « mouvements
 * réduits »). « Recommencer » demande une confirmation avant d'effacer la progression et de
 * revenir à la carte (géré par `App` via `restarted`).
 */
@Component({
  selector: "app-treasure",
  imports: [BabyGull],
  templateUrl: "./treasure.html",
  styleUrl: "./treasure.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Treasure {
  private readonly progress = inject(HuntProgressService);

  /** Émis après confirmation, une fois la progression réinitialisée. */
  readonly restarted = output<void>();

  protected readonly message = TREASURE.message;
  protected readonly animation = pickTreasureAnimation(inject(TREASURE_RANDOM));
  protected readonly openingDuration = `${CHEST_OPENING_MS}ms`;

  /** Vrai une fois la scène installée : le message et « Recommencer » sont montrés. */
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
