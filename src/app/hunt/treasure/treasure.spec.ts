import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TREASURE } from '../hunt-content';
import { HuntProgressService, PROGRESS_STORAGE, SEED_FACTORY } from '../hunt-progress.service';
import { Treasure } from './treasure';

describe('Treasure', () => {
  let fixture: ComponentFixture<Treasure>;
  let restartedCount: number;

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function testid(id: string): HTMLElement | null {
    return el().querySelector(`[data-testid="${id}"]`);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Treasure],
      providers: [
        { provide: PROGRESS_STORAGE, useValue: null },
        { provide: SEED_FACTORY, useValue: () => 42 },
      ],
    });
    fixture = TestBed.createComponent(Treasure);
    restartedCount = 0;
    fixture.componentInstance.restarted.subscribe(() => restartedCount++);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('affiche le coffre au trésor', () => {
    expect(testid('treasure-chest')).not.toBeNull();
  });

  it('affiche le message exact du trésor', () => {
    expect(testid('treasure-message')?.textContent?.trim()).toBe(TREASURE.message);
  });

  it('affiche la vidéo sans son, adaptée à iOS, avec contrôles et affiche', () => {
    const video = testid('treasure-video') as HTMLVideoElement;
    expect(video).not.toBeNull();
    expect(video.hasAttribute('muted')).toBe(true);
    expect(video.hasAttribute('playsinline')).toBe(true);
    expect(video.hasAttribute('controls')).toBe(true);
    expect(video.src).toContain(TREASURE.videoSrc);
    expect(video.poster).toContain(TREASURE.posterSrc);
  });

  it("« Recommencer » annulé (confirm → false) : ne réinitialise rien et n'émet rien", () => {
    const service = TestBed.inject(HuntProgressService);
    const restartSpy = vi.spyOn(service, 'restart');
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    (testid('restart') as HTMLButtonElement).click();

    expect(confirmSpy).toHaveBeenCalledWith('Recommencer la chasse depuis le début ?');
    expect(restartSpy).not.toHaveBeenCalled();
    expect(restartedCount).toBe(0);
  });

  it('« Recommencer » confirmé (confirm → true) : réinitialise la progression et émet `restarted`', () => {
    const service = TestBed.inject(HuntProgressService);
    const restartSpy = vi.spyOn(service, 'restart');
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    (testid('restart') as HTMLButtonElement).click();

    expect(restartSpy).toHaveBeenCalledTimes(1);
    expect(restartedCount).toBe(1);
  });
});
