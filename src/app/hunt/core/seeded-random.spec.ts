import { createSeededRandom, randomSeed } from './seeded-random';

describe('createSeededRandom', () => {
  it('donne la même suite pour la même graine', () => {
    const a = createSeededRandom(42);
    const b = createSeededRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('donne des suites différentes pour des graines différentes', () => {
    const a = createSeededRandom(1);
    const b = createSeededRandom(2);
    expect([a(), a(), a()]).not.toEqual([b(), b(), b()]);
  });

  it('produit des valeurs dans [0, 1)', () => {
    const random = createSeededRandom(1);
    for (let i = 0; i < 1000; i++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('randomSeed', () => {
  it('renvoie un entier 32 bits non signé', () => {
    const seed = randomSeed();
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(0xffffffff);
  });
});
