import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { PADLOCK_RIDDLES } from '../hunt-content';
import { HuntProgressService } from '../hunt-progress.service';
import { SkipButton } from '../shared/skip-button/skip-button';

/** Durée de l'animation d'ouverture du cadenas (spec : ≤ 1,5 s). */
const OPENING_ANIMATION_MS = 1400;

/** Index des quatre molettes du cadenas, pour l'itération dans le gabarit. */
const DIGIT_INDEXES = [0, 1, 2, 3] as const;

/** Vrai si le visiteur a demandé de réduire les animations (faux si l'API est indisponible). */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Énigme 1 — le cadenas (spec §4.3). Quatre mini-énigmes s'affichent l'une après l'autre ; chaque
 * bonne réponse révèle un chiffre. Une fois les quatre chiffres trouvés, le cadenas s'ouvre
 * (animation) puis `solved` est émis. Ouvert alors qu'il est déjà résolu, il affiche directement
 * le cadenas ouvert 0-4-2-7 sans rien émettre (spec §4.2 : une énigme résolue reste consultable).
 */
@Component({
  selector: 'app-padlock-riddle',
  imports: [SkipButton],
  templateUrl: './padlock-riddle.html',
  styleUrl: './padlock-riddle.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PadlockRiddle {
  private readonly progress = inject(HuntProgressService);
  private readonly destroyRef = inject(DestroyRef);

  /** Minuterie de l'animation d'ouverture en cours, annulée si le composant est détruit avant. */
  private openingTimer: ReturnType<typeof setTimeout> | undefined;

  /** Émis une fois le cadenas ouvert (jamais si déjà résolu à l'ouverture de l'écran). */
  readonly solved = output<void>();

  /** Vrai si le cadenas était déjà résolu quand l'écran s'est ouvert : pas d'animation, pas d'émission. */
  private readonly alreadySolvedOnOpen = this.progress.progress().padlock.solved;

  protected readonly digitIndexes = DIGIT_INDEXES;
  protected readonly answer = signal('');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly opening = signal(false);

  protected readonly padlock = computed(() => this.progress.progress().padlock);
  protected readonly isSolved = computed(() => this.padlock().solved);
  protected readonly currentQuestion = computed(() => {
    const state = this.padlock();
    return state.solved ? null : PADLOCK_RIDDLES[state.digitIndex].question;
  });
  protected readonly skipVisible = computed(() => this.progress.canSkip('padlock'));

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.openingTimer));
  }

  /** Chiffre affiché sur une molette : révélé si déjà trouvé (ou cadenas résolu), sinon « ? ». */
  protected digitValue(index: number): string {
    const state = this.padlock();
    return state.solved || index < state.digitIndex ? PADLOCK_RIDDLES[index].answer : '?';
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

    const correct = this.progress.answerPadlockDigit(value);
    this.answer.set('');

    if (correct) {
      this.errorMessage.set(null);
      this.maybeStartOpening();
    } else {
      this.errorMessage.set("Ce n'est pas la bonne réponse, essaie encore !");
    }
  }

  protected onSkip(): void {
    this.progress.skip('padlock');
    this.errorMessage.set(null);
    this.maybeStartOpening();
  }

  /** Lance l'animation d'ouverture si ce chiffre vient de résoudre le cadenas (pas au chargement). */
  private maybeStartOpening(): void {
    if (this.alreadySolvedOnOpen || this.opening() || !this.padlock().solved) {
      return;
    }

    this.opening.set(true);
    const duration = prefersReducedMotion() ? 0 : OPENING_ANIMATION_MS;
    this.openingTimer = setTimeout(() => {
      this.opening.set(false);
      this.solved.emit();
    }, duration);
  }
}
