import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { PROGRESS_STORAGE, SEED_FACTORY } from './hunt/hunt-progress.service';

describe('App', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: PROGRESS_STORAGE, useValue: null },
        { provide: SEED_FACTORY, useValue: () => 42 },
      ],
    });
  });

  it('affiche la carte au démarrage, ouvre une étape puis revient à la carte', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('app-treasure-map')).not.toBeNull();
    expect(element.querySelector('app-riddle-panel')).toBeNull();

    element.querySelector<HTMLButtonElement>('[data-testid="step-padlock"]')?.click();
    await fixture.whenStable();
    expect(element.querySelector('app-treasure-map')).toBeNull();
    expect(element.querySelector('app-riddle-panel h2')?.textContent).toContain('Le cadenas');

    element.querySelector<HTMLButtonElement>('[data-testid="back-to-map"]')?.click();
    await fixture.whenStable();
    expect(element.querySelector('app-treasure-map')).not.toBeNull();
    expect(element.querySelector('app-riddle-panel')).toBeNull();
  });

  it('trésor : « Recommencer » confirmé réinitialise la progression et revient à la carte', async () => {
    // Les quatre énigmes déjà résolues : le trésor est l'étape courante à l'ouverture.
    const solvedProgress = JSON.stringify({
      version: 1,
      padlock: { digitIndex: 4, failures: 0, solved: true },
      password: { failures: 0, solved: true },
      crossword: { letters: {}, locked: [], failures: 0, solved: true },
      wordSearch: { seed: 42, found: [], failures: 0, solved: true },
    });
    const storage = {
      getItem: () => solvedProgress,
      setItem: () => undefined,
    } as unknown as Storage;

    TestBed.overrideProvider(PROGRESS_STORAGE, { useValue: storage });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>('[data-testid="step-treasure"]')?.click();
    await fixture.whenStable();
    expect(element.querySelector('app-riddle-panel h2')?.textContent).toContain('Le trésor');

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    element.querySelector<HTMLButtonElement>('[data-testid="restart"]')?.click();
    await fixture.whenStable();

    expect(element.querySelector('app-treasure-map')).not.toBeNull();
    expect(
      element.querySelector('[data-testid="step-padlock"]')?.classList.contains('current'),
    ).toBe(true);
    vi.restoreAllMocks();
  });
});
