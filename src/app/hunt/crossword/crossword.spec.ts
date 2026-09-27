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

  /** Événement `input` tel qu'envoyé par un clavier de téléphone, avec la valeur complète du champ. */
  function inputEvent(value: string, init: InputEventInit): void {
    const input = testid('cw-input') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, ...init }));
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

  it('définition 8 (TATA) : « Ta tante, comme l’appellent les petits »', () => {
    createFixture();

    expect(testid('cw-clue-8')?.textContent).toContain("Ta tante, comme l'appellent les petits");
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

  it('effacement façon Android (input deleteContentBackward, champ vidé) sur case vide : recule et vide', () => {
    createFixture();

    click('cw-clue-1');
    type('co');

    inputEvent('', { inputType: 'deleteContentBackward' });

    expect(cell(1, 1).classList).toContain('active');
    expect(letterAt(1, 1)).toBe('');
    expect(letterAt(0, 1)).toBe('C');
  });

  it('effacement façon Android sur case remplie : la vide sans reculer', () => {
    createFixture();

    click('cw-clue-1');
    type('co');
    cell(1, 1).click();
    fixture.detectChanges();

    inputEvent('', { inputType: 'deleteContentBackward' });

    expect(letterAt(1, 1)).toBe('');
    expect(letterAt(0, 1)).toBe('C');
    expect(cell(1, 1).classList).toContain('active');
  });

  it('keydown Backspace suivi d’un input delete* (preventDefault ignoré) : un seul effacement', () => {
    createFixture();

    click('cw-clue-1');
    type('cou');

    pressKey('Backspace');
    inputEvent('', { inputType: 'deleteContentBackward' });

    // Un seul effacement : le curseur recule de 3-1 à 2-1 et ne vide que « U ».
    expect(letterAt(2, 1)).toBe('');
    expect(letterAt(1, 1)).toBe('O');
    expect(cell(2, 1).classList).toContain('active');
  });

  it('composition (texte prédictif) : chaque mise à jour du mot composé n’ajoute que la nouvelle lettre', () => {
    createFixture();

    click('cw-clue-1');
    // Le clavier recompose le mot entier à chaque touche et ignore la remise à zéro du champ.
    inputEvent(' c', { inputType: 'insertCompositionText', data: 'c', isComposing: true });
    inputEvent(' co', { inputType: 'insertCompositionText', data: 'co', isComposing: true });
    inputEvent(' cou', { inputType: 'insertCompositionText', data: 'cou', isComposing: true });

    expect(letterAt(0, 1)).toBe('C');
    expect(letterAt(1, 1)).toBe('O');
    expect(letterAt(2, 1)).toBe('U');
    expect(letterAt(3, 1)).toBe('');
  });

  it('composition : raccourcir le mot composé efface la dernière lettre', () => {
    createFixture();

    click('cw-clue-1');
    inputEvent(' c', { inputType: 'insertCompositionText', data: 'c', isComposing: true });
    inputEvent(' co', { inputType: 'insertCompositionText', data: 'co', isComposing: true });
    inputEvent(' c', { inputType: 'insertCompositionText', data: 'c', isComposing: true });

    expect(letterAt(0, 1)).toBe('C');
    expect(letterAt(1, 1)).toBe('');
    expect(cell(1, 1).classList).toContain('active');
  });

  it('fin de composition : la saisie suivante repart de zéro sans rien répéter', () => {
    createFixture();

    click('cw-clue-1');
    const input = testid('cw-input') as HTMLInputElement;
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    inputEvent(' c', { inputType: 'insertCompositionText', data: 'c', isComposing: true });
    inputEvent(' co', { inputType: 'insertCompositionText', data: 'co', isComposing: true });
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'co' }));
    fixture.detectChanges();
    // Certains navigateurs envoient encore un `input` non composé après compositionend.
    inputEvent(input.value, { inputType: 'insertText', data: 'co' });
    inputEvent(input.value + 'u', { inputType: 'insertText', data: 'u' });

    expect(letterAt(0, 1)).toBe('C');
    expect(letterAt(1, 1)).toBe('O');
    expect(letterAt(2, 1)).toBe('U');
    expect(letterAt(3, 1)).toBe('');
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

  /** Tape le mot depuis sa définition puis « Vérifier » : le mot juste est verrouillé. */
  function lockWord(clue: number, word: string): void {
    click(`cw-clue-${clue}`);
    type(word);
    click('cw-check');
  }

  function tapCell(row: number, col: number): void {
    cell(row, col).click();
    fixture.detectChanges();
  }

  function activeClueNumber(): string | null {
    return (
      el().querySelector('.clue.active')?.getAttribute('data-testid')?.replace('cw-clue-', '') ??
      null
    );
  }

  describe('sélection (spec §4.5)', () => {
    it('toucher une définition place le curseur sur la première case, même déjà remplie', () => {
      createFixture();

      click('cw-clue-1');
      type('cousin');
      click('cw-clue-3');

      expect(activeClueNumber()).toBe('3');
      expect(cell(3, 1).classList).toContain('active');
    });

    it('toucher une définition dont la première case est verrouillée : curseur sur cette case', () => {
      createFixture();
      lockWord(1, 'cousin');

      click('cw-clue-3');

      expect(cell(3, 1).classList).toContain('active');
    });

    it('case partagée sans mot actif : choisit le mot qui commence sur la case (SOEUR en 3-1)', () => {
      createFixture();

      tapCell(3, 1);

      expect(activeClueNumber()).toBe('3');
      expect(cell(3, 1).classList).toContain('active');
    });

    it('case partagée sans mot actif : choisit AMIS (qui commence) plutôt que TATA en 11-0', () => {
      createFixture();

      tapCell(11, 0);

      expect(activeClueNumber()).toBe('9');
    });

    it('case partagée où aucun mot ne commence : choisit le mot non verrouillé', () => {
      createFixture();
      lockWord(2, 'grandpere');

      tapCell(3, 5);

      expect(activeClueNumber()).toBe('3');
    });

    it('case partagée où aucun mot ne commence, horizontal verrouillé : choisit le vertical', () => {
      createFixture();
      lockWord(3, 'soeur');

      tapCell(3, 5);

      expect(activeClueNumber()).toBe('2');
    });

    it('case partagée : le mot qui commence sur la case l’emporte même s’il est verrouillé', () => {
      createFixture();
      lockWord(3, 'soeur');

      tapCell(3, 1);

      expect(activeClueNumber()).toBe('3');
    });

    it('case partagée, aucun mot ne commence ni verrouillé : choisit le mot horizontal', () => {
      createFixture();

      tapCell(9, 2);

      expect(activeClueNumber()).toBe('7');
    });

    it('case partagée contenue dans le mot actif : le mot actif reste, le curseur se déplace', () => {
      createFixture();

      click('cw-clue-5');
      tapCell(9, 2);

      expect(activeClueNumber()).toBe('5');
      expect(cell(9, 2).classList).toContain('active');
    });

    it('toucher de nouveau la même case partagée bascule vers l’autre mot, puis revient', () => {
      createFixture();

      tapCell(9, 2);
      expect(activeClueNumber()).toBe('7');

      tapCell(9, 2);
      expect(activeClueNumber()).toBe('5');
      expect(cell(9, 2).classList).toContain('active');

      tapCell(9, 2);
      expect(activeClueNumber()).toBe('7');
    });

    it('case d’un seul mot : sélectionne ce mot', () => {
      createFixture();

      click('cw-clue-3');
      tapCell(1, 1);

      expect(activeClueNumber()).toBe('1');
      expect(cell(1, 1).classList).toContain('active');
    });
  });

  describe('bouton « Changer de sens »', () => {
    it('absent sans sélection et sur une case d’un seul mot', () => {
      createFixture();
      expect(testid('cw-toggle')).toBeNull();

      click('cw-clue-1');
      expect(testid('cw-toggle')).toBeNull();
    });

    it('visible sur une case partagée ; le toucher bascule vers l’autre mot sans bouger le curseur', () => {
      createFixture();

      tapCell(3, 1);
      expect(testid('cw-toggle')).not.toBeNull();
      expect(testid('cw-toggle')?.textContent).toContain('Changer de sens');

      click('cw-toggle');
      expect(activeClueNumber()).toBe('1');
      expect(cell(3, 1).classList).toContain('active');

      click('cw-toggle');
      expect(activeClueNumber()).toBe('3');
      expect(cell(3, 1).classList).toContain('active');
    });

    it('après bascule, la saisie suit le nouveau sens', () => {
      createFixture();

      tapCell(3, 1);
      click('cw-toggle');
      type('si');

      expect(letterAt(3, 1)).toBe('S');
      expect(letterAt(4, 1)).toBe('I');
    });
  });

  describe('saisie sans décalage', () => {
    it('taper « SOEUR » après avoir verrouillé COUSIN remplit chaque lettre à sa place', () => {
      createFixture();
      lockWord(1, 'cousin');

      click('cw-clue-3');
      type('soeur');

      expect(['S', 'O', 'E', 'U', 'R']).toEqual([1, 2, 3, 4, 5].map((col) => letterAt(3, col)));
      expect(cell(3, 1).classList).toContain('locked');
    });

    it('une lettre tapée sur une case verrouillée est ignorée et le curseur avance d’une case', () => {
      createFixture();
      lockWord(1, 'cousin');

      click('cw-clue-3');
      type('x');

      expect(letterAt(3, 1)).toBe('S');
      expect(cell(3, 2).classList).toContain('active');
    });

    it('taper « GRANDPERE » depuis la définition 2 saute le « - » et remplit tout à sa place', () => {
      createFixture();

      click('cw-clue-2');
      type('grandpere');

      const column = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((row) => letterAt(row, 5)).join('');
      expect(column).toBe('GRAND-PERE');
    });

    it('taper « GRANDPERE » en croisant SOEUR et ONCLE verrouillés : tout reste aligné', () => {
      createFixture();
      lockWord(3, 'soeur');
      lockWord(4, 'oncle');

      click('cw-clue-2');
      type('grandpere');

      const column = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((row) => letterAt(row, 5)).join('');
      expect(column).toBe('GRAND-PERE');
    });

    it('une lettre tapée sur la case « - » est ignorée et le curseur avance', () => {
      createFixture();

      tapCell(7, 5);
      expect(activeClueNumber()).toBe('6');
      type('a');

      expect(letterAt(7, 5)).toBe('-');
      expect(letterAt(7, 6)).toBe('');
      expect(cell(7, 6).classList).toContain('active');
    });

    it('effacement sur une case verrouillée : recule d’une case sans rien vider', () => {
      createFixture();
      lockWord(3, 'soeur');

      click('cw-clue-1');
      type('cou');
      expect(cell(3, 1).classList).toContain('active');

      pressKey('Backspace');

      expect(letterAt(3, 1)).toBe('S');
      expect(letterAt(2, 1)).toBe('U');
      expect(cell(2, 1).classList).toContain('active');
    });

    it('« SOEUR » avec le R final verrouillé : un effacement recule sans vider le U', () => {
      createFixture();
      lockWord(2, 'grandpere');

      click('cw-clue-3');
      type('soeur');
      expect(cell(3, 5).classList).toContain('active');

      pressKey('Backspace');

      expect(letterAt(3, 5)).toBe('R');
      expect(letterAt(3, 4)).toBe('U');
      expect(cell(3, 4).classList).toContain('active');
    });

    it('effacement façon Android sur une case verrouillée : recule sans rien vider', () => {
      createFixture();
      lockWord(2, 'grandpere');

      click('cw-clue-3');
      type('soeur');

      inputEvent('', { inputType: 'deleteContentBackward' });

      expect(letterAt(3, 5)).toBe('R');
      expect(letterAt(3, 4)).toBe('U');
      expect(cell(3, 4).classList).toContain('active');
    });

    it('composition qui grandit puis raccourcit après une case verrouillée : vide O, garde S', () => {
      createFixture();
      lockWord(1, 'cousin');

      click('cw-clue-3');
      inputEvent(' s', { inputType: 'insertCompositionText', data: 's', isComposing: true });
      inputEvent(' so', { inputType: 'insertCompositionText', data: 'so', isComposing: true });
      inputEvent(' s', { inputType: 'insertCompositionText', data: 's', isComposing: true });

      expect(letterAt(3, 1)).toBe('S');
      expect(letterAt(3, 2)).toBe('');
      expect(cell(3, 2).classList).toContain('active');
    });

    it('effacement sur une case vide après une case verrouillée : recule sur elle sans la vider', () => {
      createFixture();
      lockWord(1, 'cousin');

      click('cw-clue-3');
      type('x');
      expect(cell(3, 2).classList).toContain('active');

      pressKey('Backspace');

      expect(letterAt(3, 1)).toBe('S');
      expect(cell(3, 1).classList).toContain('active');
    });

    it('effacement juste après le « - » : le saute et vide la case d’avant', () => {
      createFixture();

      click('cw-clue-2');
      type('grandp');
      expect(cell(9, 5).classList).toContain('active');

      pressKey('Backspace');
      pressKey('Backspace');

      expect(letterAt(8, 5)).toBe('');
      expect(letterAt(7, 5)).toBe('-');
      expect(letterAt(6, 5)).toBe('');
      expect(cell(6, 5).classList).toContain('active');
    });
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
