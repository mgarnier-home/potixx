import { TestBed } from '@angular/core/testing';
import type { Cell } from './core/cell';
import { cellKey } from './core/cell';
import { buildSolution, entryCells } from './core/crossword';
import { CROSSWORD, WORD_SEARCH } from './hunt-content';
import {
  HuntProgressService,
  PROGRESS_STORAGE,
  SEED_FACTORY,
  STORAGE_KEY,
} from './hunt-progress.service';

/** Faux `Storage` en mémoire, pour ne pas dépendre du `localStorage` du navigateur de test. */
class FakeStorage implements Storage {
  private readonly data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

/** Faux `Storage` dont l'écriture échoue toujours (ex. navigation privée pleine). */
class ThrowingStorage extends FakeStorage {
  override setItem(): void {
    throw new Error('Stockage indisponible.');
  }
}

/** Configure un `TestBed` avec un stockage et une graine déterministes, puis fournit le service. */
function setup(options: { seed?: () => number; storage?: Storage | null } = {}): {
  service: HuntProgressService;
  storage: Storage | null;
} {
  const storage = options.storage === undefined ? new FakeStorage() : options.storage;
  TestBed.configureTestingModule({
    providers: [
      { provide: PROGRESS_STORAGE, useValue: storage },
      { provide: SEED_FACTORY, useValue: options.seed ?? (() => 1) },
    ],
  });
  return { service: TestBed.inject(HuntProgressService), storage };
}

describe('HuntProgressService', () => {
  it('starts at padlock', () => {
    const { service } = setup();

    expect(service.currentStep()).toBe('padlock');
    expect(service.isUnlocked('padlock')).toBe(true);
    expect(service.isUnlocked('password')).toBe(false);
    expect(service.isUnlocked('crossword')).toBe(false);
    expect(service.isUnlocked('wordSearch')).toBe(false);
    expect(service.isUnlocked('treasure')).toBe(false);
  });

  it('padlock: 4 bonnes réponses résolvent le cadenas et débloquent le mot de passe', () => {
    const { service } = setup();

    expect(service.answerPadlockDigit('0')).toBe(true);
    expect(service.answerPadlockDigit(' 4')).toBe(true);
    expect(service.answerPadlockDigit('2')).toBe(true);
    expect(service.answerPadlockDigit('7')).toBe(true);

    expect(service.progress().padlock.solved).toBe(true);
    expect(service.currentStep()).toBe('password');

    // Une fois résolu, on n'accepte plus de nouvelle réponse.
    expect(service.answerPadlockDigit('0')).toBe(false);
  });

  it('padlock: le bouton passer apparaît après 3 échecs, puis skip avance au chiffre suivant', () => {
    const { service } = setup();

    service.answerPadlockDigit('9');
    service.answerPadlockDigit('9');
    expect(service.canSkip('padlock')).toBe(false);

    service.answerPadlockDigit('9');
    expect(service.canSkip('padlock')).toBe(true);

    service.skip('padlock');
    expect(service.progress().padlock.digitIndex).toBe(1);
    expect(service.progress().padlock.failures).toBe(0);
  });

  it('padlock: skip ne fait rien si canSkip est faux (2 échecs seulement)', () => {
    const { service } = setup();

    service.answerPadlockDigit('9');
    service.answerPadlockDigit('9');
    expect(service.canSkip('padlock')).toBe(false);

    service.skip('padlock');

    expect(service.progress().padlock.digitIndex).toBe(0);
  });

  it('password: accepte "Famille"', () => {
    const { service } = setup();

    expect(service.answerPassword('Famille')).toBe(true);
    expect(service.progress().password.solved).toBe(true);

    // Une fois résolu, on n'accepte plus de nouvelle réponse.
    expect(service.answerPassword('Famille')).toBe(false);
  });

  it('password: le bouton passer apparaît après 3 échecs', () => {
    const { service } = setup();

    service.answerPassword('faux');
    service.answerPassword('faux');
    expect(service.canSkip('password')).toBe(false);
    service.answerPassword('faux');
    expect(service.canSkip('password')).toBe(true);
  });

  it('password: canSkip redevient faux une fois résolu, même après 3 échecs', () => {
    const { service } = setup();

    service.answerPassword('faux');
    service.answerPassword('faux');
    service.answerPassword('faux');
    expect(service.canSkip('password')).toBe(true);

    service.answerPassword('Famille');
    expect(service.progress().password.solved).toBe(true);
    expect(service.canSkip('password')).toBe(false);
  });

  it('crossword: les échecs comptent, les mots verrouillés sont protégés, solved global à la fin', () => {
    const { service } = setup();

    // Grille vide : échec.
    const emptyCheck = service.checkCrossword();
    expect(emptyCheck.solved).toBe(false);
    expect(service.progress().crossword.failures).toBe(1);

    // La case pré-remplie ('-' de GRAND-MERE) ne peut jamais être modifiée.
    service.setCrosswordLetter('7,5', 'X');
    expect(service.progress().crossword.letters['7,5']).toBeUndefined();

    // Remplit correctement le mot 1 (COUSIN) puis vérifie : il se verrouille.
    const solution = buildSolution(CROSSWORD);
    const cousinEntry = CROSSWORD.entries.find((entry) => entry.number === 1);
    if (!cousinEntry) {
      throw new Error("L'entrée n°1 (COUSIN) est introuvable dans CROSSWORD.");
    }
    entryCells(cousinEntry).forEach((cell) => {
      const key = cellKey(cell);
      service.setCrosswordLetter(key, solution.get(key) ?? '');
    });
    service.checkCrossword();
    expect(service.progress().crossword.locked).toContain(1);

    // Une case d'un mot verrouillé ne peut plus être modifiée.
    service.setCrosswordLetter('0,1', 'X');
    expect(service.progress().crossword.letters['0,1']).toBe(solution.get('0,1'));

    // Remplit tout le reste de la grille avec la solution : tout devient juste.
    solution.forEach((letter, key) => {
      if (letter !== '-') {
        service.setCrosswordLetter(key, letter);
      }
    });
    const finalCheck = service.checkCrossword();
    expect(finalCheck.solved).toBe(true);
    expect(service.progress().crossword.solved).toBe(true);
  });

  it('crossword: canSkip redevient faux une fois résolu, même après 3 échecs', () => {
    const { service } = setup();

    service.checkCrossword();
    service.checkCrossword();
    service.checkCrossword();
    expect(service.canSkip('crossword')).toBe(true);

    const solution = buildSolution(CROSSWORD);
    solution.forEach((letter, key) => {
      if (letter !== '-') {
        service.setCrosswordLetter(key, letter);
      }
    });
    service.checkCrossword();

    expect(service.progress().crossword.solved).toBe(true);
    expect(service.canSkip('crossword')).toBe(false);
  });

  it('setCrosswordLetter: normalise la lettre saisie (casse, accents) et rejette les saisies invalides', () => {
    const { service } = setup();
    const key = '0,1'; // première case de COUSIN, modifiable

    service.setCrosswordLetter(key, 'c');
    expect(service.progress().crossword.letters[key]).toBe('C');

    service.setCrosswordLetter(key, 'é');
    expect(service.progress().crossword.letters[key]).toBe('E');

    // Saisies invalides : ignorées, la case garde sa dernière valeur valide.
    service.setCrosswordLetter(key, 'ab');
    expect(service.progress().crossword.letters[key]).toBe('E');

    service.setCrosswordLetter(key, '1');
    expect(service.progress().crossword.letters[key]).toBe('E');

    service.setCrosswordLetter(key, ' ');
    expect(service.progress().crossword.letters[key]).toBe('E');

    // '' efface toujours la case.
    service.setCrosswordLetter(key, '');
    expect(service.progress().crossword.letters[key]).toBeUndefined();
  });

  it('setCrosswordLetter: ignore une clé hors grille (case noire, absente de la solution)', () => {
    const { service } = setup();

    service.setCrosswordLetter('0,0', 'C');

    expect(service.progress().crossword.letters['0,0']).toBeUndefined();
  });

  it('wordSearch: sélectionner un mot placé le marque trouvé ; resélection = échec', () => {
    const { service } = setup();

    const grid = service.wordSearchGrid();
    const target = grid.words[0];
    const from = target.cells[0];
    const to = target.cells[target.cells.length - 1];

    expect(service.selectWordSearch(from, to)).toBe(true);
    expect(service.progress().wordSearch.found).toContain(target.word);

    expect(service.selectWordSearch(from, to)).toBe(false);
    expect(service.progress().wordSearch.failures).toBe(1);
  });

  it('wordSearch: une sélection qui ne correspond à aucun mot compte un échec', () => {
    const { service } = setup();

    const invalidCell: Cell = { row: 0, col: 0 };
    expect(service.selectWordSearch(invalidCell, invalidCell)).toBe(false);
    expect(service.progress().wordSearch.failures).toBe(1);
  });

  it('wordSearch: solved quand les 10 mots sont trouvés', () => {
    const { service } = setup();

    const grid = service.wordSearchGrid();
    grid.words.forEach((placed) => {
      service.selectWordSearch(placed.cells[0], placed.cells[placed.cells.length - 1]);
    });

    expect(service.progress().wordSearch.solved).toBe(true);
    expect(service.progress().wordSearch.found.length).toBe(WORD_SEARCH.words.length);
  });

  it('persists and restores : même progression et même grille après rechargement', () => {
    const storage = new FakeStorage();
    const { service: firstService } = setup({ seed: () => 123, storage });

    firstService.answerPadlockDigit('0');
    firstService.setCrosswordLetter('0,1', 'C');
    const grid = firstService.wordSearchGrid();
    const word = grid.words[0];
    firstService.selectWordSearch(word.cells[0], word.cells[word.cells.length - 1]);

    TestBed.tick();

    const snapshot = firstService.progress();
    const gridLetters = firstService.wordSearchGrid().letters;

    TestBed.resetTestingModule();
    const { service: secondService } = setup({ seed: () => 123, storage });

    expect(secondService.progress()).toEqual(snapshot);
    expect(secondService.wordSearchGrid().letters).toEqual(gridLetters);
  });

  it('ignores corrupted storage : aucune exception, état neuf à chaque fois', () => {
    const corruptedValues = ['{oops', '{"version":0}', '{"version":1}'];

    for (const raw of corruptedValues) {
      TestBed.resetTestingModule();
      const storage = new FakeStorage();
      storage.setItem(STORAGE_KEY, raw);

      let service: HuntProgressService | undefined;
      expect(() => {
        service = setup({ storage }).service;
      }).not.toThrow();

      expect(service?.currentStep()).toBe('padlock');
      expect(service?.progress().padlock.solved).toBe(false);
    }
  });

  it('ignore une sauvegarde de forme imbriquée invalide : état neuf, aucune exception ensuite', () => {
    const validPadlock = { digitIndex: 0, failures: 0, solved: false };
    const validPassword = { failures: 0, solved: false };
    const validCrossword = { letters: {}, locked: [], failures: 0, solved: false };
    const validWordSearch = { seed: 1, found: [], failures: 0, solved: false };

    const invalidPayloads = [
      // crossword.locked absent.
      {
        version: 1,
        padlock: validPadlock,
        password: validPassword,
        crossword: { letters: {}, failures: 0, solved: false },
        wordSearch: validWordSearch,
      },
      // padlock.digitIndex hors bornes.
      {
        version: 1,
        padlock: { digitIndex: 99, failures: 0, solved: false },
        password: validPassword,
        crossword: validCrossword,
        wordSearch: validWordSearch,
      },
      // wordSearch.found n'est pas un tableau.
      {
        version: 1,
        padlock: validPadlock,
        password: validPassword,
        crossword: validCrossword,
        wordSearch: { seed: 1, found: 'oops', failures: 0, solved: false },
      },
    ];

    for (const payload of invalidPayloads) {
      TestBed.resetTestingModule();
      const storage = new FakeStorage();
      storage.setItem(STORAGE_KEY, JSON.stringify(payload));

      let service: HuntProgressService | undefined;
      expect(() => {
        service = setup({ storage }).service;
      }).not.toThrow();

      expect(service?.currentStep()).toBe('padlock');
      expect(service?.progress().padlock.solved).toBe(false);

      // Une réponse ensuite ne doit lever aucune exception.
      expect(() => service?.answerPadlockDigit('0')).not.toThrow();
    }
  });

  it('works without storage : token null, aucune exception', () => {
    expect(() => {
      const { service } = setup({ storage: null });
      service.answerPadlockDigit('0');
      TestBed.tick();
    }).not.toThrow();
  });

  it('works without storage : setItem qui lève, aucune exception', () => {
    TestBed.resetTestingModule();

    expect(() => {
      const { service } = setup({ storage: new ThrowingStorage() });
      service.answerPadlockDigit('0');
      TestBed.tick();
    }).not.toThrow();
  });

  it('restart : nouvel état, nouvelle graine', () => {
    let nextSeed = 1000;
    const { service } = setup({ seed: () => nextSeed++ });

    service.answerPadlockDigit('0');
    const seedBefore = service.progress().wordSearch.seed;

    service.restart();

    expect(service.progress().padlock.solved).toBe(false);
    expect(service.progress().padlock.digitIndex).toBe(0);
    expect(service.currentStep()).toBe('padlock');
    expect(service.progress().wordSearch.seed).not.toBe(seedBefore);
  });
});
