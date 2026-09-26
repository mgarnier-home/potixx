import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { PASSWORD } from '../hunt-content';
import { HuntProgressService } from '../hunt-progress.service';
import { SkipButton } from '../shared/skip-button/skip-button';

/** Durée de l'animation de succès avant l'émission de `solved` (spec : ≤ 1,5 s). */
const SUCCESS_ANIMATION_MS = 1200;

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

  /** Émis une fois le mot de passe trouvé (jamais si déjà résolu à l'ouverture de l'écran). */
  readonly solved = output<void>();

  /** Vrai si l'énigme était déjà résolue à l'ouverture : pas d'animation, pas d'émission. */
  private readonly alreadySolvedOnOpen = this.progress.progress().password.solved;

  protected readonly clues = PASSWORD.clues;
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

  protected isClueVisible(index: number): boolean {
    return index < this.cluesVisibleCount();
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

  protected onSkip(): void {
    this.progress.skip('password');
    this.errorMessage.set(null);
    this.startSuccess();
  }

  /** Lance le bref message de succès puis émet `solved`, sauf si déjà résolu à l'ouverture. */
  private startSuccess(): void {
    if (this.alreadySolvedOnOpen || this.success()) {
      return;
    }

    this.success.set(true);
    const duration = prefersReducedMotion() ? 0 : SUCCESS_ANIMATION_MS;
    setTimeout(() => {
      this.solved.emit();
    }, duration);
  }
}
