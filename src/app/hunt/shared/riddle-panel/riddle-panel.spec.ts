import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RiddlePanel } from './riddle-panel';

@Component({
  imports: [RiddlePanel],
  template: `<app-riddle-panel title="Le cadenas" (closed)="closedCount = closedCount + 1">
    <p class="projected">Contenu de l'énigme</p>
  </app-riddle-panel>`,
})
class Host {
  closedCount = 0;
}

describe('RiddlePanel', () => {
  it('affiche le titre et le contenu projeté, et émet `closed` via « Retour à la carte »', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('h2')?.textContent).toContain('Le cadenas');
    expect(element.querySelector('.projected')?.textContent).toContain("Contenu de l'énigme");

    const back = element.querySelector<HTMLButtonElement>('[data-testid="back-to-map"]');
    expect(back?.textContent).toContain('Retour à la carte');
    back?.click();
    expect(fixture.componentInstance.closedCount).toBe(1);
  });
});
