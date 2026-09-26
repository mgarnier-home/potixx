import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import type { Cell } from '../core/cell';
import { cellKey } from '../core/cell';
import { WORD_SEARCH } from '../hunt-content';
import { HuntProgressService } from '../hunt-progress.service';
import { SkipButton } from '../shared/skip-button/skip-button';

/**
 * Une couleur par mot, réutilisée pour la case et pour la puce de la liste (spec §4.6 : les mots
 * trouvés restent surlignés). Des teintes claires (proches du parchemin) pour que le texte encre
 * reste lisible dessus sans variante de couleur de texte par mot. Ordre stable, indexé sur
 * `WORD_SEARCH.words` : la couleur d'un mot ne change jamais, quel que soit l'ordre où il est
 * trouvé.
 */
const WORD_COLORS: readonly string[] = [
  '#f1d993', // or
  '#cfe3da', // sauge
  '#f4c9bd', // corail
  '#d3dfbd', // mousse
  '#c9d9e8', // marine
  '#ddc7e8', // améthyste
  '#f2cfa8', // cuivre
  '#e8c3d3', // bourgogne
  '#d9c46b', // moutarde (plus soutenue que l'or pour rester distincte)
  '#c7d3c9', // ardoise
];

const WORD_COLOR_BY_WORD = new Map<string, string>(
  WORD_SEARCH.words.map((word, index) => [word, WORD_COLORS[index % WORD_COLORS.length]]),
);

/** Case affichée, avec sa lettre et une clé stable pour le suivi Angular. */
interface GridCell extends Cell {
  key: string;
  letter: string;
}

function sameCell(a: Cell | null, b: Cell | null): boolean {
  return a !== null && b !== null && a.row === b.row && a.col === b.col;
}

/**
 * Ligne droite (8 directions, y compris à l'envers) entre deux cases, ou `null` si elles ne sont
 * pas alignées. Sert uniquement à l'aperçu au survol (ordinateur) : une vraie sélection est
 * validée par `HuntProgressService.selectWordSearch`, qui n'accepte que les extrémités d'un mot
 * réellement placé.
 */
function straightLine(from: Cell, to: Cell): Cell[] | null {
  const rowStep = Math.sign(to.row - from.row);
  const colStep = Math.sign(to.col - from.col);
  if (rowStep === 0 && colStep === 0) {
    return null;
  }

  const rowDiff = Math.abs(to.row - from.row);
  const colDiff = Math.abs(to.col - from.col);
  if (rowStep !== 0 && colStep !== 0 && rowDiff !== colDiff) {
    return null;
  }

  const length = Math.max(rowDiff, colDiff) + 1;
  return Array.from({ length }, (_, index) => ({
    row: from.row + rowStep * index,
    col: from.col + colStep * index,
  }));
}

/**
 * Énigme 4 — les mots mêlés (spec §4.6). Toucher la première puis la dernière lettre d'un mot le
 * marque comme trouvé (dans les deux sens) ; toute autre sélection compte comme un échec, avec un
 * bref retour visuel sur les deux cases. Résolu → « Continuer » émet `solved`. Ouvert déjà résolu,
 * tout est affiché d'emblée, sans bouton ni émission (spec §4.2).
 */
@Component({
  selector: 'app-word-search',
  imports: [SkipButton],
  templateUrl: './word-search.html',
  styleUrl: './word-search.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WordSearch {
  private readonly progress = inject(HuntProgressService);

  /** Émis au clic sur « Continuer » (jamais si déjà résolu à l'ouverture). */
  readonly solved = output<void>();

  /** Vrai si la grille était déjà résolue à l'ouverture : pas de bouton, pas d'émission. */
  protected readonly alreadySolvedOnOpen = this.progress.progress().wordSearch.solved;

  protected readonly words = WORD_SEARCH.words;

  private readonly grid = computed(() => this.progress.wordSearchGrid());
  protected readonly cells = computed<GridCell[]>(() => {
    const grid = this.grid();
    const list: GridCell[] = [];
    for (let row = 0; row < grid.size; row++) {
      for (let col = 0; col < grid.size; col++) {
        list.push({ row, col, key: cellKey({ row, col }), letter: grid.letters[row][col] });
      }
    }
    return list;
  });

  /** Table cellule → mots qui la traversent, pour retrouver la couleur d'une case trouvée. */
  private readonly wordsByCellKey = computed(() => {
    const map = new Map<string, string[]>();
    for (const placed of this.grid().words) {
      for (const cell of placed.cells) {
        const key = cellKey(cell);
        const owners = map.get(key) ?? [];
        owners.push(placed.word);
        map.set(key, owners);
      }
    }
    return map;
  });

  private readonly wordSearch = computed(() => this.progress.progress().wordSearch);
  protected readonly isSolved = computed(() => this.wordSearch().solved);
  protected readonly skipVisible = computed(() => this.progress.canSkip('wordSearch'));
  protected readonly continueVisible = computed(() => !this.alreadySolvedOnOpen && this.isSolved());
  private readonly foundWords = computed(() => new Set(this.wordSearch().found));

  /** Première case touchée, en attente d'une seconde pour former une sélection. */
  protected readonly anchor = signal<Cell | null>(null);
  private readonly hoverCellSignal = signal<Cell | null>(null);
  /** Les deux cases d'une sélection invalide, le temps du bref retour visuel. */
  protected readonly failedKeys = signal<ReadonlySet<string>>(new Set());

  private readonly previewKeys = computed(() => {
    const from = this.anchor();
    const to = this.hoverCellSignal();
    if (from === null || to === null || sameCell(from, to) || this.isSolved()) {
      return new Set<string>();
    }
    const line = straightLine(from, to);
    return line === null ? new Set<string>() : new Set(line.map(cellKey));
  });

  protected isAnchor(cell: GridCell): boolean {
    return sameCell(this.anchor(), cell);
  }

  protected isPreview(key: string): boolean {
    return this.previewKeys().has(key);
  }

  protected isFailed(key: string): boolean {
    return this.failedKeys().has(key);
  }

  protected cellColor(key: string): string | null {
    const owners = this.wordsByCellKey().get(key) ?? [];
    const found = owners.find((word) => this.foundWords().has(word));
    return found === undefined ? null : (WORD_COLOR_BY_WORD.get(found) ?? null);
  }

  protected isFound(key: string): boolean {
    return this.cellColor(key) !== null;
  }

  protected colorOf(word: string): string {
    return WORD_COLOR_BY_WORD.get(word) ?? WORD_COLORS[0];
  }

  protected isWordFound(word: string): boolean {
    return this.foundWords().has(word);
  }

  protected cellLabel(cell: GridCell): string {
    return `Ligne ${cell.row + 1}, colonne ${cell.col + 1} : ${cell.letter}`;
  }

  protected hoverCell(cell: Cell | null): void {
    this.hoverCellSignal.set(cell);
  }

  /** Efface le retour visuel d'échec une fois son animation terminée (instantanée si l'utilisateur préfère). */
  protected onFailedAnimationEnd(key: string): void {
    if (this.failedKeys().has(key)) {
      this.failedKeys.set(new Set());
    }
  }

  /**
   * Toucher une case : la première fois pose l'ancre ; retoucher l'ancre l'annule sans échec ;
   * toucher une autre case valide ou compte la sélection auprès du service.
   */
  protected selectCell(cell: GridCell): void {
    if (this.isSolved()) {
      return;
    }

    const current = this.anchor();
    if (current === null) {
      this.anchor.set({ row: cell.row, col: cell.col });
      return;
    }

    if (sameCell(current, cell)) {
      this.anchor.set(null);
      return;
    }

    const target = { row: cell.row, col: cell.col };
    const found = this.progress.selectWordSearch(current, target);
    if (!found) {
      this.failedKeys.set(new Set([cellKey(current), cellKey(target)]));
    }

    this.anchor.set(null);
    this.hoverCellSignal.set(null);
  }

  protected onSkip(): void {
    this.progress.skip('wordSearch');
  }

  protected continue(): void {
    this.solved.emit();
  }
}
