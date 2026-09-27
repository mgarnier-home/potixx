import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { Cell } from '../core/cell';
import { cellKey } from '../core/cell';
import type { CrosswordEntry, Orientation } from '../core/crossword';
import { entryCells, prefilledCells } from '../core/crossword';
import { normalizeAnswer } from '../core/normalize-answer';
import { CROSSWORD } from '../hunt-content';
import { HuntProgressService } from '../hunt-progress.service';
import { SkipButton } from '../shared/skip-button/skip-button';

/** Intervalle entre l'illumination de deux cases du mot caché (spec : ≈ 250 ms). */
const LIGHT_INTERVAL_MS = 250;

/**
 * Valeur « sentinelle » laissée en permanence dans le champ caché. Sur les claviers de téléphone
 * (Android surtout), la touche d'effacement sur un champ vide n'émet souvent aucun événement
 * exploitable : garder un caractère à effacer garantit un événement `input` à chaque appui.
 */
const SENTINEL = ' ';

/** Une seule lettre A-Z, après normalisation. */
const SINGLE_LETTER = /^[A-Z]$/;

/** Vrai si le visiteur a demandé de réduire les animations (faux si l'API est indisponible). */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Case blanche de la grille, telle qu'affichée. */
interface GridCell extends Cell {
  key: string;
  /** Numéro de l'entrée qui commence ici, ou `null`. */
  number: number | null;
  prefilled: boolean;
  /** Numéros des entrées (une ou deux) qui passent par cette case. */
  entries: readonly number[];
}

// Données dérivées du contenu, calculées une seule fois (contenu éditorial statique).
const PREFILLED = prefilledCells(CROSSWORD);
const ENTRIES = new Map<number, CrosswordEntry>(
  CROSSWORD.entries.map((entry) => [entry.number, entry]),
);
const ENTRY_KEYS = new Map<number, readonly string[]>(
  CROSSWORD.entries.map((entry) => [entry.number, entryCells(entry).map(cellKey)]),
);

function buildGridCells(): GridCell[] {
  const byKey = new Map<string, GridCell>();
  for (const entry of CROSSWORD.entries) {
    entryCells(entry).forEach((cell, index) => {
      const key = cellKey(cell);
      const existing = byKey.get(key);
      const number = index === 0 ? entry.number : null;
      if (existing === undefined) {
        byKey.set(key, {
          ...cell,
          key,
          number,
          prefilled: PREFILLED.has(key),
          entries: [entry.number],
        });
      } else {
        byKey.set(key, {
          ...existing,
          number: existing.number ?? number,
          entries: [...existing.entries, entry.number],
        });
      }
    });
  }
  return [...byKey.values()].sort((a, b) => a.row - b.row || a.col - b.col);
}

const GRID_CELLS = buildGridCells();
const GRID_CELLS_BY_KEY = new Map(GRID_CELLS.map((cell) => [cell.key, cell]));
const HIGHLIGHT_KEYS = CROSSWORD.highlight.map(cellKey);

/**
 * Énigme 3 — les mots croisés (spec §4.5). La grille reproduit `activity.png` ; toucher une case
 * ou une définition sélectionne un mot, et un champ caché capte la saisie (il ouvre le clavier
 * du téléphone). « Vérifier » verrouille les mots justes et passe les mots faux en rouge. Une fois
 * la grille juste (ou l'énigme passée), les cases du mot caché s'illuminent une à une, AGRANDIRA
 * s'affiche et « Continuer » émet `solved`. Ouvert déjà résolu : tout est affiché d'emblée, sans
 * bouton ni émission (spec §4.2 : une énigme résolue reste consultable).
 */
@Component({
  selector: 'app-crossword',
  imports: [SkipButton],
  templateUrl: './crossword.html',
  styleUrl: './crossword.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Crossword {
  private readonly progress = inject(HuntProgressService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly hiddenInput = viewChild<ElementRef<HTMLInputElement>>('hiddenInput');
  private readonly timers: ReturnType<typeof setTimeout>[] = [];
  /** Texte de la composition en cours (clavier prédictif) déjà écrit dans la grille. */
  private composedText = '';
  /** Vrai juste après un keydown Backspace/Delete, pour ignorer un input delete* en doublon. */
  private eraseHandledByKeydown = false;

  /** Émis au clic sur « Continuer », après l'illumination (jamais si déjà résolu à l'ouverture). */
  readonly solved = output<void>();

  /** Vrai si la grille était déjà résolue à l'ouverture : pas d'animation, pas de « Continuer ». */
  protected readonly alreadySolvedOnOpen = this.progress.progress().crossword.solved;

  protected readonly cells = GRID_CELLS;
  protected readonly sentinel = SENTINEL;
  protected readonly hiddenWord = CROSSWORD.hiddenWord.split('');
  /** Définitions en deux groupes, comme sur la grille d'origine. */
  protected readonly clueGroups = [
    { title: 'Horizontal', entries: CROSSWORD.entries.filter((e) => e.orientation === 'across') },
    { title: 'Vertical', entries: CROSSWORD.entries.filter((e) => e.orientation === 'down') },
  ];

  protected readonly activeEntry = signal<number | null>(null);
  protected readonly activeKey = signal<string | null>(null);
  /** Mots signalés faux au dernier « Vérifier », jusqu'à la modification d'une de leurs cases. */
  protected readonly wrongEntries = signal<ReadonlySet<number>>(new Set());
  /** Nombre de cases du mot caché déjà illuminées. */
  protected readonly litCount = signal(this.alreadySolvedOnOpen ? HIGHLIGHT_KEYS.length : 0);
  /** Hauteur du clavier virtuel, pour garder la barre de définition juste au-dessus. */
  protected readonly keyboardOffset = signal(0);

  private readonly crossword = computed(() => this.progress.progress().crossword);
  protected readonly isSolved = computed(() => this.crossword().solved);
  protected readonly skipVisible = computed(() => this.progress.canSkip('crossword'));

  private readonly lockedEntries = computed(() => new Set(this.crossword().locked));
  private readonly lockedKeys = computed(() => this.keysOf(this.lockedEntries()));
  private readonly activeEntryKeys = computed(() => {
    const entry = this.activeEntry();
    return new Set(entry === null ? [] : (ENTRY_KEYS.get(entry) ?? []));
  });
  /** Cases des mots faux, hors cases déjà verrouillées par un mot croisé juste. */
  private readonly wrongKeys = computed(() => {
    const locked = this.lockedKeys();
    return new Set([...this.keysOf(this.wrongEntries())].filter((key) => !locked.has(key)));
  });
  private readonly litKeys = computed(() => new Set(HIGHLIGHT_KEYS.slice(0, this.litCount())));

  /** Case active partagée par deux mots : le bouton « Changer de sens » est alors proposé. */
  protected readonly toggleTarget = computed(() => {
    const key = this.activeKey();
    const entry = this.activeEntry();
    const cell = key === null ? undefined : GRID_CELLS_BY_KEY.get(key);
    if (cell === undefined || cell.entries.length < 2 || this.isSolved()) {
      return null;
    }
    const other = cell.entries.find((number) => number !== entry);
    return other === undefined ? null : (ENTRIES.get(other) ?? null);
  });

  protected readonly activeClue = computed(() => {
    const number = this.activeEntry();
    return number === null ? null : (ENTRIES.get(number) ?? null);
  });
  protected readonly revealComplete = computed(() => this.litCount() >= HIGHLIGHT_KEYS.length);
  protected readonly continueVisible = computed(
    () => !this.alreadySolvedOnOpen && this.isSolved() && this.revealComplete(),
  );
  protected readonly feedback = computed(() => {
    const count = this.wrongEntries().size;
    if (count === 0) {
      return null;
    }
    return count === 1
      ? "Un mot n'est pas encore juste : il est en rouge."
      : `${count} mots ne sont pas encore justes : ils sont en rouge.`;
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.timers.forEach((timer) => clearTimeout(timer)));
    this.trackVirtualKeyboard();
  }

  protected letterOf(key: string): string {
    return PREFILLED.get(key) ?? this.crossword().letters[key] ?? '';
  }

  protected isActive(key: string): boolean {
    return this.activeKey() === key && !this.isSolved();
  }

  protected isInActiveEntry(key: string): boolean {
    return this.activeEntryKeys().has(key) && !this.isSolved();
  }

  protected isLocked(key: string): boolean {
    return this.lockedKeys().has(key);
  }

  protected isWrong(key: string): boolean {
    return this.wrongKeys().has(key);
  }

  protected isLit(key: string): boolean {
    return this.litKeys().has(key);
  }

  protected isEntryLocked(number: number): boolean {
    return this.lockedEntries().has(number);
  }

  protected isEntryWrong(number: number): boolean {
    return this.wrongEntries().has(number);
  }

  protected orientationLabel(orientation: Orientation): string {
    return orientation === 'across' ? 'Horizontal' : 'Vertical';
  }

  protected cellLabel(cell: GridCell): string {
    const letter = this.letterOf(cell.key);
    return `Ligne ${cell.row + 1}, colonne ${cell.col + 1} : ${letter === '' ? 'vide' : letter}`;
  }

  /**
   * Toucher une case (spec §4.5). Case d'un seul mot : ce mot. Case partagée : retoucher la case
   * active bascule vers l'autre mot ; sinon le mot actif est gardé s'il passe par la case ; sinon
   * on prend le mot qui commence sur la case, à défaut le mot non verrouillé, à défaut l'horizontal.
   */
  protected selectCell(cell: GridCell): void {
    if (this.isSolved()) {
      return;
    }

    const current = this.activeEntry();
    let entry: number;
    if (this.activeKey() === cell.key && cell.entries.length > 1) {
      entry = cell.entries.find((number) => number !== current) ?? cell.entries[0];
    } else if (current !== null && cell.entries.includes(current)) {
      entry = current;
    } else {
      entry = this.preferredEntry(cell);
    }

    this.activeEntry.set(entry);
    this.activeKey.set(cell.key);
    this.focusInput();
  }

  /** Bouton « Changer de sens » : passe à l'autre mot de la case active, curseur inchangé. */
  protected toggleDirection(): void {
    const other = this.toggleTarget();
    if (other !== null) {
      this.activeEntry.set(other.number);
    }
    this.focusInput();
  }

  /** Toucher une définition : sélectionne toujours ce mot, curseur sur sa première case. */
  protected selectEntry(number: number): void {
    if (this.isSolved()) {
      return;
    }

    const target = ENTRY_KEYS.get(number)?.[0] ?? null;
    this.activeEntry.set(number);
    this.activeKey.set(target);
    this.focusInput();
    this.scrollCellIntoView(target);
  }

  /**
   * Saisie dans le champ caché. Les claviers de téléphone envoient souvent la valeur entière au
   * lieu d'événements clavier : on compare la valeur à la sentinelle pour en déduire les lettres
   * tapées (ou un effacement), puis on remet la sentinelle.
   *
   * Composition (texte prédictif de Gboard, clavier Samsung…) : le clavier réécrit tout le mot en
   * cours à chaque touche (« c », puis « co », puis « cou ») et peut ignorer la remise à zéro du
   * champ. Pendant une composition, on ne remet donc pas la sentinelle : on compare le mot composé
   * à ce qui a déjà été consommé et on n'écrit que les lettres nouvelles (ou on efface si le mot a
   * raccourci). La sentinelle est remise à la fin de la composition.
   */
  protected onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    const inputType = (event as Partial<InputEvent>).inputType ?? '';
    const composing =
      (event as Partial<InputEvent>).isComposing === true || inputType === 'insertCompositionText';

    if (composing && value !== '') {
      this.consumeComposition(value.startsWith(SENTINEL) ? value.slice(SENTINEL.length) : value);
      return;
    }

    if (value === '' || inputType.startsWith('delete')) {
      // Un clavier peut envoyer un vrai keydown Backspace ET un input delete* malgré
      // preventDefault : l'effacement déjà fait par le keydown ne doit pas être répété.
      if (!this.eraseHandledByKeydown) {
        this.erase();
      }
      this.eraseHandledByKeydown = false;
    } else {
      const typed = value.startsWith(SENTINEL) ? value.slice(SENTINEL.length) : value;
      for (const char of typed) {
        this.typeLetter(char);
      }
    }

    this.resetInput(input);
  }

  /** Fin de composition : on repart d'un champ ne contenant que la sentinelle. */
  protected onCompositionEnd(event: CompositionEvent): void {
    this.resetInput(event.target as HTMLInputElement);
  }

  /** Touches physiques (ordinateur) : effacement et flèches. Les lettres passent par `input`. */
  protected onKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'Backspace':
      case 'Delete':
        event.preventDefault();
        this.erase();
        // Garde contre un input delete* envoyé en plus dans la foulée (voir `onInput`).
        this.eraseHandledByKeydown = true;
        setTimeout(() => (this.eraseHandledByKeydown = false));
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.move(0, -1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.move(0, 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.move(-1, 0);
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.move(1, 0);
        break;
    }
  }

  protected check(): void {
    const result = this.progress.checkCrossword();
    this.wrongEntries.set(new Set(result.wrongEntries));
    const active = this.activeEntry();
    if (active !== null && this.lockedEntries().has(active)) {
      // Le mot en cours vient d'être verrouillé : on le désélectionne pour qu'il apparaisse en vert.
      this.activeEntry.set(null);
      this.activeKey.set(null);
    }
    if (result.solved) {
      this.startReveal();
    }
  }

  protected onSkip(): void {
    this.progress.skip('crossword');
    this.wrongEntries.set(new Set());
    this.startReveal();
  }

  protected continue(): void {
    this.solved.emit();
  }

  /** Compare le mot en cours de composition à ce qui a déjà été consommé. */
  private consumeComposition(current: string): void {
    const consumed = this.composedText;
    if (current.startsWith(consumed)) {
      for (const char of current.slice(consumed.length)) {
        this.typeLetter(char);
      }
    } else if (consumed.startsWith(current)) {
      for (let index = current.length; index < consumed.length; index++) {
        this.erase();
      }
    } else {
      // Le clavier a repris une composition neuve (après notre remise à zéro) : tout est nouveau.
      for (const char of current) {
        this.typeLetter(char);
      }
    }
    this.composedText = current;
  }

  /**
   * Écrit une lettre dans la case active puis avance d'une case (spec §4.5). Une case verrouillée
   * ou préremplie n'est jamais sautée d'avance : la lettre tapée dessus est ignorée et le curseur
   * avance, pour que taper le mot entier remplisse chaque lettre à sa place. Seul le « - » est
   * sauté en avançant, puisque le joueur tape GRANDPERE sans tiret.
   */
  private typeLetter(char: string): void {
    const letter = normalizeAnswer(char).toUpperCase();
    const entry = this.activeEntry();
    const active = this.activeKey();
    if (!SINGLE_LETTER.test(letter) || entry === null || active === null || this.isSolved()) {
      return;
    }

    if (this.isEditable(active)) {
      this.writeLetter(active, letter);
    }
    const keys = ENTRY_KEYS.get(entry) ?? [];
    const next = keys.slice(keys.indexOf(active) + 1).find((key) => !PREFILLED.has(key));
    this.activeKey.set(next ?? active);
  }

  /**
   * Efface la case active si elle est modifiable et remplie. Sur une case verrouillée, recule
   * seulement d'une case (en sautant le « - ») sans rien vider, symétrique de « taper
   * par-dessus ». Sur une case vide, recule d'une case et la vide si elle est modifiable.
   */
  private erase(): void {
    const entry = this.activeEntry();
    const active = this.activeKey();
    if (entry === null || active === null || this.isSolved()) {
      return;
    }

    if (this.isEditable(active) && this.letterOf(active) !== '') {
      this.writeLetter(active, '');
      return;
    }

    const keys = ENTRY_KEYS.get(entry) ?? [];
    const previous = keys
      .slice(0, keys.indexOf(active))
      .reverse()
      .find((key) => !PREFILLED.has(key));
    if (previous !== undefined) {
      this.activeKey.set(previous);
      if (!this.lockedKeys().has(active) && this.isEditable(previous)) {
        this.writeLetter(previous, '');
      }
    }
  }

  /** Écrit dans le service ; si la case a changé, ses mots perdent leur marque « faux ». */
  private writeLetter(key: string, letter: string): void {
    const before = this.letterOf(key);
    this.progress.setCrosswordLetter(key, letter);
    if (this.letterOf(key) === before) {
      return;
    }

    const owners = GRID_CELLS_BY_KEY.get(key)?.entries ?? [];
    if (owners.some((number) => this.wrongEntries().has(number))) {
      this.wrongEntries.update(
        (wrong) => new Set([...wrong].filter((number) => !owners.includes(number))),
      );
    }
  }

  /** Flèches du clavier : case blanche voisine, en privilégiant le mot dans le sens du mouvement. */
  private move(rowStep: number, colStep: number): void {
    const active = this.activeKey();
    const cell = active === null ? undefined : GRID_CELLS_BY_KEY.get(active);
    if (cell === undefined || this.isSolved()) {
      return;
    }

    const next = GRID_CELLS_BY_KEY.get(
      cellKey({ row: cell.row + rowStep, col: cell.col + colStep }),
    );
    if (next === undefined) {
      return;
    }

    const orientation: Orientation = colStep !== 0 ? 'across' : 'down';
    const entry =
      next.entries.find((number) => ENTRIES.get(number)?.orientation === orientation) ??
      next.entries[0];
    this.activeEntry.set(entry);
    this.activeKey.set(next.key);
  }

  /** Mot choisi sur une case partagée hors mot actif : qui commence ici, non verrouillé, horizontal. */
  private preferredEntry(cell: GridCell): number {
    const [first, ...others] = cell.entries;
    if (others.length === 0) {
      return first;
    }

    // Départage seulement si un seul des deux mots commence ici (aucun cas de la grille actuelle
    // n'a deux départs sur une même case, mais on retombe alors sur les règles suivantes).
    const startsHere = cell.entries.filter((number) => ENTRY_KEYS.get(number)?.[0] === cell.key);
    if (startsHere.length === 1) {
      return startsHere[0];
    }
    const unlocked = cell.entries.filter((number) => !this.lockedEntries().has(number));
    if (unlocked.length === 1) {
      return unlocked[0];
    }
    return cell.entries.find((number) => ENTRIES.get(number)?.orientation === 'across') ?? first;
  }

  private isEditable(key: string): boolean {
    return !PREFILLED.has(key) && !this.lockedKeys().has(key);
  }

  private keysOf(entries: ReadonlySet<number>): Set<string> {
    return new Set([...entries].flatMap((number) => ENTRY_KEYS.get(number) ?? []));
  }

  /** Illumine les cases du mot caché une à une (tout de suite si les animations sont réduites). */
  private startReveal(): void {
    if (this.alreadySolvedOnOpen || this.litCount() > 0) {
      return;
    }

    this.activeEntry.set(null);
    this.activeKey.set(null);
    this.hiddenInput()?.nativeElement.blur();

    if (prefersReducedMotion()) {
      this.litCount.set(HIGHLIGHT_KEYS.length);
      return;
    }

    HIGHLIGHT_KEYS.forEach((_, index) => {
      this.timers.push(setTimeout(() => this.litCount.set(index + 1), index * LIGHT_INTERVAL_MS));
    });
  }

  /**
   * Après un toucher sur une définition (souvent sous la grille sur téléphone), ramène la case
   * active à l'écran si elle n'y est pas (elle arrive alors en haut, le mot reste visible
   * au-dessus du clavier) ; ne bouge rien si elle est déjà visible (ordinateur).
   */
  private scrollCellIntoView(key: string | null): void {
    const cell = GRID_CELLS_BY_KEY.get(key ?? '');
    const element =
      cell === undefined
        ? null
        : this.host.nativeElement.querySelector(`[data-testid="cw-cell-${cell.row}-${cell.col}"]`);
    if (element instanceof HTMLElement && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({
        block: 'nearest',
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      });
    }
  }

  /** Donne le focus au champ caché pour ouvrir le clavier du téléphone. */
  private focusInput(): void {
    const input = this.hiddenInput()?.nativeElement;
    if (input !== undefined) {
      input.focus({ preventScroll: true });
      this.resetInput(input);
    }
  }

  /** Remet la sentinelle seule dans le champ ; toute composition en cours est oubliée. */
  private resetInput(input: HTMLInputElement): void {
    this.composedText = '';
    input.value = SENTINEL;
    try {
      input.setSelectionRange(SENTINEL.length, SENTINEL.length);
    } catch {
      // Certains navigateurs refusent la sélection sur un champ non focalisé : sans importance.
    }
  }

  /**
   * Suit la hauteur du clavier virtuel (API `visualViewport`) : sur iOS notamment, le clavier
   * recouvre le bas de la page sans la redimensionner, et la barre de définition collée en bas
   * serait cachée dessous.
   */
  private trackVirtualKeyboard(): void {
    const viewport = typeof window === 'undefined' ? null : window.visualViewport;
    if (viewport === null || viewport === undefined) {
      return;
    }

    const update = (): void => {
      const offset = window.innerHeight - viewport.height - viewport.offsetTop;
      this.keyboardOffset.set(Math.max(0, Math.round(offset)));
    };
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    this.destroyRef.onDestroy(() => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    });
  }
}
