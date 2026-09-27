import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { WORD_SEARCH } from '../hunt-content';
import { HuntProgressService, PROGRESS_STORAGE, SEED_FACTORY } from '../hunt-progress.service';
import { WordSearch } from './word-search';

// Graine fixée à 42 : avec cette graine, la grille générée (voir `word-search.ts` /
// `core/word-search.ts`) place notamment :
//  - NAISSANCE : (9,0) → (9,8), horizontale
//  - PARENTS   : (8,2) → (8,8), horizontale
//  - DOUDOUS   : (2,8) → (8,8), verticale
// (positions relevées une fois avec `generateWordSearch(WORD_SEARCH.words, WORD_SEARCH.size, 42)`).

describe('WordSearch', () => {
  let fixture: ComponentFixture<WordSearch>;
  let solvedCount: number;

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function testid(id: string): HTMLElement | null {
    return el().querySelector(`[data-testid="${id}"]`);
  }

  function cell(row: number, col: number): HTMLElement {
    const found = testid(`ws-cell-${row}-${col}`);
    if (found === null) {
      throw new Error(`Case ${row}-${col} introuvable`);
    }
    return found;
  }

  function tap(row: number, col: number): void {
    cell(row, col).click();
    fixture.detectChanges();
  }

  function click(id: string): void {
    (testid(id) as HTMLElement).click();
    fixture.detectChanges();
  }

  function createFixture(): void {
    fixture = TestBed.createComponent(WordSearch);
    solvedCount = 0;
    fixture.componentInstance.solved.subscribe(() => solvedCount++);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [WordSearch],
      providers: [
        { provide: PROGRESS_STORAGE, useValue: null },
        { provide: SEED_FACTORY, useValue: () => 42 },
      ],
    });
  });

  it('affiche les 100 cases de la grille et les 10 mots à trouver', () => {
    createFixture();

    expect(el().querySelectorAll('[data-testid^="ws-cell-"]').length).toBe(
      WORD_SEARCH.size * WORD_SEARCH.size,
    );
    expect(el().querySelectorAll('[data-testid^="ws-word-"]').length).toBe(
      WORD_SEARCH.words.length,
    );
    for (const word of WORD_SEARCH.words) {
      expect(testid(`ws-word-${word}`)?.textContent).toContain(word);
      expect(testid(`ws-word-${word}`)?.classList).not.toContain('found');
    }
  });

  it('touche la 1ʳᵉ puis la dernière case de PARENTS : le mot est trouvé et rayé', () => {
    createFixture();
    const service = TestBed.inject(HuntProgressService);

    tap(8, 2);
    expect(cell(8, 2).classList).toContain('anchor');

    tap(8, 8);

    expect(testid('ws-word-PARENTS')?.classList).toContain('found');
    expect(service.progress().wordSearch.found).toContain('PARENTS');
    expect(cell(8, 2).classList).not.toContain('anchor');
  });

  it('touche NAISSANCE dans l’ordre inverse (dernière puis première case) : trouvé aussi', () => {
    createFixture();

    tap(9, 8);
    tap(9, 0);

    expect(testid('ws-word-NAISSANCE')?.classList).toContain('found');
  });

  it('toucher deux fois la même case annule la sélection sans compter d’échec', () => {
    createFixture();
    const service = TestBed.inject(HuntProgressService);

    tap(0, 0);
    tap(0, 0);

    expect(cell(0, 0).classList).not.toContain('anchor');
    expect(service.progress().wordSearch.failures).toBe(0);
    expect(testid('skip')).toBeNull();
  });

  it("3 sélections invalides d'affilée font apparaître « Passer l'énigme »", () => {
    createFixture();

    expect(testid('skip')).toBeNull();

    // (0,0) et (0,1) ne sont les extrémités d'aucun mot placé : chaque essai est un échec.
    tap(0, 0);
    tap(0, 1);
    tap(0, 0);
    tap(0, 1);
    tap(0, 0);
    tap(0, 1);

    expect(testid('skip')).not.toBeNull();
  });

  it("« Passer l'énigme » révèle tous les mots restants et permet de continuer", () => {
    createFixture();

    tap(0, 0);
    tap(0, 1);
    tap(0, 0);
    tap(0, 1);
    tap(0, 0);
    tap(0, 1);
    click('skip');

    for (const word of WORD_SEARCH.words) {
      expect(testid(`ws-word-${word}`)?.classList).toContain('found');
    }
    expect(testid('ws-continue')).not.toBeNull();

    click('ws-continue');
    expect(solvedCount).toBe(1);
  });

  it('une sélection qui ne correspond à aucun mot déclenche un bref retour visuel (classe failed)', () => {
    createFixture();

    tap(0, 0);
    tap(0, 1);

    expect(cell(0, 0).classList).toContain('failed');
    expect(cell(0, 1).classList).toContain('failed');
  });

  it('ouvert déjà résolu : tous les mots sont rayés, pas de bouton continuer, rien émis', () => {
    const service = TestBed.inject(HuntProgressService);
    // `skip` exige 3 échecs au préalable ; (99,99)-(98,98) ne correspond à aucun mot placé.
    for (let i = 0; i < 3; i++) {
      service.selectWordSearch({ row: 99, col: 99 }, { row: 98, col: 98 });
    }
    service.skip('wordSearch');

    createFixture();

    for (const word of WORD_SEARCH.words) {
      expect(testid(`ws-word-${word}`)?.classList).toContain('found');
    }
    expect(testid('ws-continue')).toBeNull();
    expect(testid('skip')).toBeNull();
    expect(solvedCount).toBe(0);
  });
});
