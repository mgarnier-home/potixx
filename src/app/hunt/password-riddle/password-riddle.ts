import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { trebleStaffOffset } from '../core/music-staff';
import { PASSWORD } from '../hunt-content';
import { HuntProgressService } from '../hunt-progress.service';
import { SkipButton } from '../shared/skip-button/skip-button';

/** Durée de l'animation de succès avant l'émission de `solved` (spec : ≤ 1,5 s). */
const SUCCESS_ANIMATION_MS = 1200;

/**
 * Tracé de la clé de sol du rébus (spec §4.4), en coordonnées du `viewBox` `REBUS_VIEW_BOX`.
 * Adapté (mise à l'échelle et recentrage) d'un tracé libre de droits d'une clé de sol classique,
 * pour s'enrouler autour de la ligne du Sol4 (`REBUS_BOTTOM_LINE_Y - 2 * REBUS_HALF_STEP`).
 * `fill-rule: evenodd` est indispensable : le tracé comporte des sous-tracés qui creusent les
 * boucles de la clé.
 */
const REBUS_CLEF_PATH =
  'M 62.89,89.9 C 61.03,90.42 59.35,91.58 57.79,93.35 C 56.24,95.15 55.47,97.13 55.47,99.27 C 55.47,100.61 55.93,102.13 56.82,103.75 C 57.7,105.4 59.04,106.59 60.78,107.35 C 61.36,107.47 61.64,107.78 61.64,108.2 C 61.64,108.35 61.42,108.51 60.9,108.63 C 58.13,107.93 55.84,106.43 54.07,104.21 C 52.3,101.95 51.39,99.39 51.33,96.46 C 51.42,93.32 52.36,90.39 54.16,87.71 C 55.99,84.99 58.34,83.07 61.21,81.94 L 59.1,71.12 C 54.41,75.02 50.6,79.08 47.64,83.35 C 44.68,87.59 43.15,92.19 43.03,97.16 C 43.09,99.39 43.55,101.55 44.4,103.63 C 45.26,105.73 46.54,107.62 48.25,109.36 C 51.69,112.81 56.18,114.61 61.64,114.79 C 63.5,114.67 65.48,114.33 67.61,113.78 L 62.89,89.9 Z M 65.08,89.6 L 69.84,113.05 C 74.54,111.16 76.88,107.04 76.88,100.76 C 76.61,98.66 76,96.77 74.96,95.09 C 73.96,93.38 72.61,92.04 70.91,91.06 C 69.2,90.09 67.28,89.6 65.08,89.6 Z M 58.83,57.88 C 59.84,57.27 60.99,56.21 62.24,54.71 C 63.5,53.25 64.72,51.51 65.87,49.56 C 67.06,47.57 68.01,45.56 68.71,43.52 C 69.41,41.51 69.75,39.58 69.75,37.82 C 69.75,37.05 69.69,36.29 69.53,35.62 C 69.41,34.52 69.08,33.67 68.5,33.09 C 67.92,32.54 67.19,32.23 66.27,32.23 C 64.44,32.23 62.79,33.36 61.33,35.62 C 60.2,37.57 59.26,39.89 58.59,42.51 C 57.88,45.17 57.49,47.79 57.43,50.44 C 57.58,53.46 58.07,55.93 58.83,57.88 Z M 56.91,59.65 C 55.54,54.71 54.77,49.68 54.62,44.56 C 54.65,41.26 54.99,38.18 55.63,35.32 C 56.24,32.45 57.12,29.98 58.28,27.84 C 59.41,25.71 60.72,24.09 62.18,22.99 C 63.5,22.02 64.44,21.5 64.96,21.5 C 65.36,21.5 65.69,21.65 66,21.93 C 66.3,22.2 66.7,22.66 67.19,23.27 C 70.81,28.42 72.64,34.64 72.64,41.9 C 72.64,45.35 72.19,48.7 71.27,52.06 C 70.39,55.38 69.08,58.55 67.34,61.51 C 65.57,64.5 63.5,67.09 61.09,69.32 L 63.56,81.33 C 64.9,81.18 65.81,81.06 66.33,81.06 C 68.65,81.06 70.72,81.55 72.64,82.52 C 74.57,83.5 76.21,84.81 77.55,86.49 C 78.9,88.14 79.93,90.03 80.67,92.16 C 81.37,94.3 81.76,96.52 81.76,98.84 C 81.76,102.44 80.82,105.73 78.93,108.69 C 77.04,111.65 74.2,113.81 70.39,115.22 C 70.63,116.71 71.06,118.88 71.7,121.65 C 72.31,124.46 72.77,126.68 73.07,128.33 C 73.38,129.98 73.5,131.56 73.5,133.12 C 73.5,135.53 72.92,137.66 71.76,139.55 C 70.57,141.44 68.98,142.91 66.97,143.94 C 64.99,144.98 62.79,145.5 60.42,145.5 C 57.06,145.5 54.13,144.55 51.63,142.69 C 49.13,140.8 47.79,138.27 47.67,135.04 C 47.76,133.61 48.09,132.26 48.7,130.98 C 49.31,129.7 50.14,128.67 51.21,127.87 C 52.24,127.05 53.49,126.62 54.93,126.53 C 56.12,126.53 57.24,126.87 58.31,127.51 C 59.35,128.18 60.2,129.06 60.84,130.19 C 61.45,131.32 61.79,132.57 61.79,133.91 C 61.79,135.71 61.18,137.24 59.96,138.49 C 58.74,139.74 57.18,140.38 55.32,140.38 L 54.62,140.38 C 55.81,142.21 57.76,143.15 60.48,143.15 C 61.85,143.15 63.25,142.85 64.65,142.3 C 66.09,141.72 67.28,140.96 68.28,139.98 C 69.29,139 69.96,137.97 70.24,136.87 C 70.75,135.62 71,133.88 71,131.72 C 71,130.25 70.85,128.79 70.57,127.32 C 70.3,125.89 69.87,123.97 69.29,121.59 C 68.71,119.24 68.28,117.41 68.04,116.16 C 66.21,116.62 64.32,116.86 62.34,116.86 C 59.01,116.86 55.87,116.19 52.91,114.82 C 49.95,113.45 47.36,111.56 45.11,109.12 C 42.88,106.68 41.14,103.93 39.89,100.82 C 38.67,97.74 38.03,94.51 38,91.15 C 38.12,88.04 38.7,85.06 39.8,82.25 C 40.9,79.41 42.3,76.73 44.04,74.23 C 45.78,71.73 47.58,69.44 49.44,67.4 C 51.33,65.38 53.8,62.79 56.91,59.65 Z';

/** `viewBox` du SVG du rébus (spec §4.4) : portée, clé de sol et note. */
const REBUS_VIEW_BOX = '0 0 240 170';
/** Abscisses de début/fin des 5 lignes de la portée. */
const REBUS_STAFF_X = { start: 30, end: 200 } as const;
/** Ordonnées des 5 lignes de la portée, du Fa5 (haut) au Mi4 (bas). */
const REBUS_STAFF_LINES_Y: readonly number[] = [45, 63, 81, 99, 117];
/** Ordonnée de la ligne du bas (Mi4) : origine du calcul de la position d'une note. */
const REBUS_BOTTOM_LINE_Y = 117;
/** Écart vertical entre une ligne et l'interligne voisin. */
const REBUS_HALF_STEP = 9;
/** Abscisse de la tête de note, après la clé. */
const REBUS_NOTE_X = 140;

/** Met en majuscule la première lettre (réponse affichée après un « Passer l'énigme »). */
function capitalizeFirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Vrai si le visiteur a demandé de réduire les animations (faux si l'API est indisponible). */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Énigme 2 — le mot de passe (spec §4.4). Trois indices se révèlent au fil des échecs (photo,
 * puis texte, puis rébus) ; la réponse attendue est « famille ». Une fois trouvée, un bref message
 * de succès s'affiche puis `solved` est émis. Ouvert alors qu'elle est déjà résolue, l'écran
 * affiche directement tous les indices et la réponse, sans rien émettre (spec §4.2 : une énigme
 * résolue reste consultable).
 */
@Component({
  selector: 'app-password-riddle',
  imports: [SkipButton],
  templateUrl: './password-riddle.html',
  styleUrl: './password-riddle.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordRiddle {
  private readonly progress = inject(HuntProgressService);
  private readonly destroyRef = inject(DestroyRef);

  /** Minuterie du message de succès en cours, annulée si le composant est détruit avant. */
  private successTimer: ReturnType<typeof setTimeout> | undefined;

  /** Émis une fois le mot de passe trouvé (jamais si déjà résolu à l'ouverture de l'écran). */
  readonly solved = output<void>();

  /**
   * Vrai si l'énigme était déjà résolue à l'ouverture : pas d'animation, pas d'émission. Sert
   * aussi à distinguer, une fois résolue, un passage (`onSkip`, réponse affichée avec un bouton
   * « Continuer ») d'une énigme déjà résolue avant l'ouverture de l'écran (réponse affichée seule).
   */
  protected readonly alreadySolvedOnOpen = this.progress.progress().password.solved;

  /** Réponse attendue, première lettre en majuscule, pour l'afficher après un passage. */
  protected readonly answerLabel = capitalizeFirst(PASSWORD.answer);

  protected readonly clues = PASSWORD.clues;

  protected readonly rebusViewBox = REBUS_VIEW_BOX;
  protected readonly rebusStaffX = REBUS_STAFF_X;
  protected readonly rebusStaffLinesY = REBUS_STAFF_LINES_Y;
  protected readonly rebusClefPath = REBUS_CLEF_PATH;
  protected readonly rebusNoteX = REBUS_NOTE_X;

  protected readonly answer = signal('');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly success = signal(false);

  protected readonly password = computed(() => this.progress.progress().password);
  protected readonly isSolved = computed(() => this.password().solved);
  protected readonly skipVisible = computed(() => this.progress.canSkip('password'));

  /**
   * Nombre d'indices visibles : un de plus à chaque échec, jusqu'au dernier ; tous d'un coup une
   * fois l'énigme résolue (fraîchement ou déjà résolue à l'ouverture), pour permettre de tout
   * revoir.
   */
  protected readonly cluesVisibleCount = computed(() => {
    if (this.isSolved()) {
      return this.clues.length;
    }
    return Math.min(this.password().failures + 1, this.clues.length);
  });

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.successTimer));
  }

  protected isClueVisible(index: number): boolean {
    return index < this.cluesVisibleCount();
  }

  /** Ordonnée de la tête de note du rébus, d'après sa position sur la portée (spec §4.4). */
  protected rebusNoteY(note: string): number {
    const offset = trebleStaffOffset(note) ?? 1;
    return REBUS_BOTTOM_LINE_Y - offset * REBUS_HALF_STEP;
  }

  /** Vrai si la hampe doit monter (note sur la ligne médiane ou en dessous), comme en gravure. */
  protected rebusStemGoesUp(note: string): boolean {
    return (trebleStaffOffset(note) ?? 1) <= 4;
  }

  protected onAnswerInput(value: string): void {
    this.answer.set(value);
  }

  protected submit(event: Event): void {
    event.preventDefault();
    const value = this.answer();
    if (value === '') {
      return;
    }

    const correct = this.progress.answerPassword(value);
    this.answer.set('');

    if (correct) {
      this.errorMessage.set(null);
      this.startSuccess();
    } else {
      this.errorMessage.set("Ce n'est pas la bonne réponse, essaie encore !");
    }
  }

  /**
   * Passe l'énigme : contrairement à une bonne réponse, aucune félicitation ni émission
   * automatique. La réponse s'affiche avec un bouton « Continuer » (spec §4.2 et §4.4).
   */
  protected onSkip(): void {
    this.progress.skip('password');
    this.errorMessage.set(null);
  }

  /** Clic sur « Continuer » après un passage : émet `solved` (jamais de félicitation ici). */
  protected continueAfterSkip(): void {
    this.solved.emit();
  }

  /** Lance le bref message de succès puis émet `solved`, sauf si déjà résolu à l'ouverture. */
  private startSuccess(): void {
    if (this.alreadySolvedOnOpen || this.success()) {
      return;
    }

    this.success.set(true);
    const duration = prefersReducedMotion() ? 0 : SUCCESS_ANIMATION_MS;
    this.successTimer = setTimeout(() => {
      this.solved.emit();
    }, duration);
  }
}
