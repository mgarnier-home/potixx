import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { buildSolution } from '../core/crossword';
import { CROSSWORD } from '../hunt-content';
import { HuntProgressService, PROGRESS_STORAGE, SEED_FACTORY } from '../hunt-progress.service';
import { Crossword } from './crossword';

describe('Crossword', () => {
  let fixture: ComponentFixture<Crossword>;
  let solvedCount: number;

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function testid(id: string): HTMLElement | null {
    return el().querySelector(`[data-testid="${id}"]`);
  }

  function cell(row: number, col: number): HTMLElement {
    const found = testid(`cw-cell-${row}-${col}`);
    if (found === null) {
      throw new Error(`Case ${row}-${col} introuvable`);
    }
    return found;
  }

  function letterAt(row: number, col: number): string {
    return cell(row, col).querySelector('.letter')?.textContent?.trim() ?? '';
  }

  function click(id: string): void {
    (testid(id) as HTMLElement).click();
    fixture.detectChanges();
  }

  /** Simule un clavier de téléphone : la valeur du champ caché change puis `input` est émis. */
  function type(text: string): void {
    const input = testid('cw-input') as HTMLInputElement;
    for (const char of text) {
      input.value = input.value + char;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    }
  }

  function pressKey(key: string): void {
    const input = testid('cw-input') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  function createFixture(): void {
    fixture = TestBed.createComponent(Crossword);
    solvedCount = 0;
    fixture.componentInstance.solved.subscribe(() => solvedCount++);
    fixture.detectChanges();
  }

  /** Remplit toute la grille avec la solution, via le service. */
  function fillWholeSolution(service: HuntProgressService): void {
    buildSolution(CROSSWORD).forEach((letter, key) => {
      if (letter !== '-') {
        service.setCrosswordLetter(key, letter);
      }
    });
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Crossword],
      providers: [
        { provide: PROGRESS_STORAGE, useValue: null },
        { provide: SEED_FACTORY, useValue: () => 42 },
      ],
    });
  });

  it('affiche les 9 définitions', () => {
    createFixture();

    for (let number = 1; number <= 9; number++) {
      expect(testid(`cw-clue-${number}`)?.textContent).toContain(
        CROSSWORD.entries[number - 1].clue,
      );
    }
    expect(el().querySelectorAll('[data-testid^="cw-clue-"]').length).toBe(9);
  });

  it("ne rend que les cases blanches, avec le numéro dans la première case d'un mot", () => {
    createFixture();

    expect(el().querySelectorAll('[data-testid^="cw-cell-"]').length).toBe(
      buildSolution(CROSSWORD).size,
    );
    expect(testid('cw-cell-0-0')).toBeNull();
    expect(cell(0, 1).querySelector('.number')?.textContent?.trim()).toBe('1');
    expect(cell(7, 0).querySelector('.number')?.textContent?.trim()).toBe('6');
  });

  it("la case 7-5 affiche « - » et n'est pas modifiable", () => {
    createFixture();

    expect(letterAt(7, 5)).toBe('-');

    cell(7, 5).click();
    fixture.detectChanges();
    type('a');

    expect(letterAt(7, 5)).toBe('-');
  });

  it('clic sur la définition 1 puis saisie « c », « o » : remplit 0-1 et 1-1 en majuscules', () => {
    createFixture();

    click('cw-clue-1');
    type('c');
    type('o');

    expect(letterAt(0, 1)).toBe('C');
    expect(letterAt(1, 1)).toBe('O');
    expect(cell(2, 1).classList).toContain('active');
  });

  it('une lettre accentuée « é » est enregistrée sans accent (« E »)', () => {
    createFixture();

    click('cw-clue-3');
    type('é');

    expect(letterAt(3, 1)).toBe('E');
  });

  it('ignore les caractères qui ne sont pas des lettres', () => {
    createFixture();

    click('cw-clue-3');
    type('7');

    expect(letterAt(3, 1)).toBe('');
    expect(cell(3, 1).classList).toContain('active');
  });

  it('effacement sur une case vide : recule à la case précédente et la vide', () => {
    createFixture();

    click('cw-clue-1');
    type('co');
    expect(cell(2, 1).classList).toContain('active');

    pressKey('Backspace');

    expect(cell(1, 1).classList).toContain('active');
    expect(letterAt(1, 1)).toBe('');
    expect(letterAt(0, 1)).toBe('C');
  });

  it('effacement sur une case remplie : la vide sans reculer', () => {
    createFixture();

    click('cw-clue-1');
    type('co');
    cell(1, 1).click();
    fixture.detectChanges();

    pressKey('Backspace');

    expect(letterAt(1, 1)).toBe('');
    expect(cell(1, 1).classList).toContain('active');
  });

  it("toucher à nouveau une case partagée bascule entre l'horizontal et le vertical", () => {
    createFixture();

    click('cw-clue-3');
    expect(testid('cw-clue-3')?.classList).toContain('active');

    cell(3, 1).click();
    fixture.detectChanges();
    expect(testid('cw-clue-1')?.classList).toContain('active');

    cell(3, 1).click();
    fixture.detectChanges();
    expect(testid('cw-clue-3')?.classList).toContain('active');
  });

  it('la saisie saute la case pré-remplie « - »', () => {
    createFixture();

    click('cw-clue-6');
    type('grand');
    expect(cell(7, 6).classList).toContain('active');

    type('m');
    expect(letterAt(7, 6)).toBe('M');
  });

  it('« Vérifier » sur une grille incomplète : marque des cases en rouge et compte un échec', () => {
    createFixture();
    const service = TestBed.inject(HuntProgressService);

    click('cw-check');

    expect(el().querySelectorAll('.wrong').length).toBeGreaterThan(0);
    expect(service.progress().crossword.failures).toBe(1);
  });

  it("un mot faux reste rouge jusqu'à la modification d'une de ses cases", () => {
    createFixture();

    click('cw-check');
    expect(cell(11, 1).classList).toContain('wrong');

    click('cw-clue-9');
    type('a');

    expect(cell(11, 1).classList).not.toContain('wrong');
    expect(cell(3, 2).classList).toContain('wrong');
  });

  it("un mot juste vérifié est verrouillé et n'est plus modifiable", () => {
    createFixture();

    click('cw-clue-1');
    type('cousin');
    click('cw-check');

    expect(cell(0, 1).classList).toContain('locked');

    click('cw-clue-1');
    type('x');
    pressKey('Backspace');

    expect(letterAt(0, 1)).toBe('C');
    expect(letterAt(1, 1)).toBe('O');
  });

  it('après « Vérifier », le mot sélectionné devenu juste est désélectionné', () => {
    createFixture();

    click('cw-clue-1');
    type('cousin');
    click('cw-check');

    expect(testid('cw-clue-1')?.classList).not.toContain('active');
    expect(el().querySelectorAll('.cell.active').length).toBe(0);
  });

  it('la saisie saute les cases verrouillées par un mot croisé', () => {
    createFixture();

    click('cw-clue-1');
    type('cousin');
    click('cw-check');

    click('cw-clue-3');
    expect(cell(3, 2).classList).toContain('active');
  });

  it('grille complète et juste : illumine les cases puis affiche AGRANDIRA et « Continuer »', async () => {
    vi.useFakeTimers();
    try {
      createFixture();
      fillWholeSolution(TestBed.inject(HuntProgressService));
      fixture.detectChanges();

      click('cw-check');

      expect(testid('cw-continue')).toBeNull();

      await vi.advanceTimersByTimeAsync(3000);
      fixture.detectChanges();

      expect(testid('cw-hidden-word')?.textContent?.replace(/\s/g, '')).toContain('AGRANDIRA');
      expect(el().querySelectorAll('.lit').length).toBe(CROSSWORD.highlight.length);
      expect(solvedCount).toBe(0);

      click('cw-continue');
      expect(solvedCount).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("« Passer l'énigme » après 3 échecs : révèle la grille et AGRANDIRA", async () => {
    vi.useFakeTimers();
    try {
      createFixture();

      expect(testid('skip')).toBeNull();
      click('cw-check');
      click('cw-check');
      click('cw-check');

      click('skip');
      await vi.advanceTimersByTimeAsync(3000);
      fixture.detectChanges();

      expect(letterAt(0, 1)).toBe('C');
      expect(testid('cw-hidden-word')?.textContent?.replace(/\s/g, '')).toContain('AGRANDIRA');
      expect(testid('cw-continue')).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('ouvert déjà résolu : grille, cases illuminées et AGRANDIRA tout de suite, sans « Continuer »', () => {
    const service = TestBed.inject(HuntProgressService);
    fillWholeSolution(service);
    service.checkCrossword();

    createFixture();

    expect(letterAt(13, 0)).toBe('A');
    expect(el().querySelectorAll('.lit').length).toBe(CROSSWORD.highlight.length);
    expect(testid('cw-hidden-word')?.textContent?.replace(/\s/g, '')).toContain('AGRANDIRA');
    expect(testid('cw-continue')).toBeNull();
    expect(testid('cw-check')).toBeNull();
    expect(solvedCount).toBe(0);
  });
});
