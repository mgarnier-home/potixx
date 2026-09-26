import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { PASSWORD } from '../hunt-content';
import { HuntProgressService, PROGRESS_STORAGE, SEED_FACTORY } from '../hunt-progress.service';
import { PasswordRiddle } from './password-riddle';

describe('PasswordRiddle', () => {
  let fixture: ComponentFixture<PasswordRiddle>;
  let solvedCount: number;

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function testid(id: string): HTMLElement | null {
    return el().querySelector(`[data-testid="${id}"]`);
  }

  async function answer(value: string): Promise<void> {
    const input = testid('password-input') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (testid('password-submit') as HTMLButtonElement | null)?.click();
    fixture.detectChanges();
  }

  function createFixture(): void {
    fixture = TestBed.createComponent(PasswordRiddle);
    solvedCount = 0;
    fixture.componentInstance.solved.subscribe(() => solvedCount++);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PasswordRiddle],
      providers: [
        { provide: PROGRESS_STORAGE, useValue: null },
        { provide: SEED_FACTORY, useValue: () => 42 },
      ],
    });
  });

  it("n'affiche que le premier indice (l'image) à l'ouverture", async () => {
    createFixture();
    fixture.detectChanges();

    expect(testid('password-clue-0')).not.toBeNull();
    expect(testid('password-clue-1')).toBeNull();
    expect(testid('password-clue-2')).toBeNull();
  });

  it('mauvaise réponse : affiche un message d’erreur et révèle le deuxième indice', async () => {
    createFixture();
    fixture.detectChanges();

    await answer('pirate');

    expect(testid('password-error')?.textContent?.trim()).toBeTruthy();
    expect(testid('password-clue-1')).not.toBeNull();
    expect(testid('password-clue-2')).toBeNull();
  });

  it('deux mauvaises réponses : révèle le troisième indice (le rébus)', async () => {
    createFixture();
    fixture.detectChanges();

    await answer('pirate');
    await answer('pirate');

    const rebus = testid('password-clue-2');
    expect(rebus).not.toBeNull();
    expect(rebus?.textContent).toContain('Fa');
    expect(rebus?.textContent).toContain('+');
    expect(rebus?.textContent).toContain('1000');
  });

  it("fait apparaître « Passer l'énigme » après 3 mauvaises réponses", async () => {
    createFixture();
    fixture.detectChanges();

    expect(testid('skip')).toBeNull();

    await answer('pirate');
    await answer('pirate');
    await answer('pirate');

    expect(testid('skip')).not.toBeNull();
  });

  it('« FAMILLE » émet `solved` après la brève animation de succès', async () => {
    vi.useFakeTimers();
    try {
      createFixture();
      fixture.detectChanges();

      await answer('FAMILLE');

      expect(solvedCount).toBe(0);

      await vi.advanceTimersByTimeAsync(1500);

      expect(solvedCount).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('accepte les variantes de casse, accents et espaces (« FAMILLE », « Famille » avec espaces)', async () => {
    vi.useFakeTimers();
    try {
      createFixture();
      fixture.detectChanges();

      await answer(' Famille ');

      expect(testid('password-error')).toBeNull();

      await vi.advanceTimersByTimeAsync(1500);

      expect(solvedCount).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ouvert alors que le mot de passe est déjà résolu : affiche tous les indices et la réponse, sans rien émettre', async () => {
    const service = TestBed.inject(HuntProgressService);
    service.answerPassword(PASSWORD.answer);

    createFixture();
    fixture.detectChanges();

    expect(testid('password-clue-0')).not.toBeNull();
    expect(testid('password-clue-1')).not.toBeNull();
    expect(testid('password-clue-2')).not.toBeNull();
    expect(testid('password-input')).toBeNull();
    expect(el().textContent?.toLowerCase()).toContain('famille');
    expect(solvedCount).toBe(0);
  });
});
