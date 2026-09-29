import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { SkipButton } from './skip-button';

describe('SkipButton', () => {
  let fixture: ComponentFixture<SkipButton>;

  beforeEach(() => {
    fixture = TestBed.createComponent(SkipButton);
  });

  function button(): HTMLButtonElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('[data-testid="skip"]');
  }

  it('est invisible si `visible` est faux', async () => {
    fixture.componentRef.setInput('visible', false);
    await fixture.whenStable();
    expect(button()).toBeNull();
  });

  it("affiche « Passer l'énigme » et émet `skipped` au clic si `visible` est vrai", async () => {
    let skipped = 0;
    fixture.componentInstance.skipped.subscribe(() => skipped++);
    fixture.componentRef.setInput('visible', true);
    await fixture.whenStable();

    expect(button()?.textContent?.trim()).toBe("Passer l'énigme");
    button()?.click();
    expect(skipped).toBe(1);
  });
});
