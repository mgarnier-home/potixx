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
});
