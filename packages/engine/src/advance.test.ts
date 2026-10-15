import { describe, expect, it } from 'vitest';
import { advance, migrateState, rewindClock } from './advance.ts';
import { random } from './rng.ts';
import { HOUR_MS } from './state.ts';
import { sowSeeds } from './actions/culture.ts';
import { addPlant, equippedGame, newGame, T0 } from './test-utils.ts';

describe('rng', () => {
  it('est déterministe pour une même graine', () => {
    const a = { rng: 7 };
    const b = { rng: 7 };
    const seqA = Array.from({ length: 5 }, () => random(a));
    const seqB = Array.from({ length: 5 }, () => random(b));
    expect(seqA).toEqual(seqB);
    expect(seqA.every((n) => n >= 0 && n < 1)).toBe(true);
  });
});

describe('advance', () => {
  it("ne fait rien avant l'heure pleine suivante", () => {
    const state = newGame();
    const result = advance(state, T0 + 59 * 60_000);
    expect(result.ticks).toBe(0);
    expect(result.state.lastTickAt).toBe(T0);
  });

  it('rejoue une actualisation par heure pleine franchie', () => {
    const state = newGame();
    const result = advance(state, T0 + 5 * HOUR_MS + 30 * 60_000);
    expect(result.ticks).toBe(5);
    expect(result.state.lastTickAt).toBe(T0 + 5 * HOUR_MS);
  });

  it("aligne l'état initial sur l'heure pleine", () => {
    const state = equippedGame();
    expect(state.lastTickAt % HOUR_MS).toBe(0);
  });

  it("ne modifie pas l'état reçu et donne le même résultat à chaque fois", () => {
    const state = equippedGame();
    addPlant(state, { waterCl: 5, fertMl: 5 });
    const snapshot = JSON.stringify(state);
    const a = advance(state, T0 + 30 * HOUR_MS);
    const b = advance(state, T0 + 30 * HOUR_MS);
    expect(JSON.stringify(state)).toBe(snapshot);
    expect(a).toEqual(b);
  });

  it('découper le temps en plusieurs appels donne le même résultat', () => {
    const state = equippedGame();
    addPlant(state, { waterCl: 5, fertMl: 5, protectedVeg: false });
    const once = advance(state, T0 + 10 * HOUR_MS).state;
    const split = advance(advance(state, T0 + 4 * HOUR_MS).state, T0 + 10 * HOUR_MS).state;
    expect(split).toEqual(once);
  });
});

describe('migrateState', () => {
  it('convertit l’ancienne protection flo (booléen) en heures de protection', () => {
    const state = equippedGame();
    const flo = addPlant(state, { stage: 'flo', height: 70 });
    const veg = addPlant(state);
    for (const plant of [flo, veg]) {
      const legacy = plant as Partial<typeof plant> & { protectedFlo?: boolean };
      delete legacy.floProtectionHours;
      legacy.protectedFlo = true;
    }
    migrateState(state);
    expect(flo.floProtectionHours).toBeGreaterThanOrEqual(36);
    expect(flo.floProtectionHours).toBeLessThanOrEqual(60);
    expect(veg.floProtectionHours).toBe(0);
    expect('protectedFlo' in flo).toBe(false);
  });

  it('complète les germes et la salle des plants morts d’avant', () => {
    const state = equippedGame();
    state.germs.push({ id: 999, variety: 'super_skunk', height: 12, devIndex: 1, sownAt: T0, hoursAtMax: 3 } as unknown as (typeof state.germs)[number]);
    const deadVeg = addPlant(state, { stage: 'dead', height: 30 });
    const deadFlo = addPlant(state, { stage: 'dead', height: 120 });
    migrateState(state);
    expect(state.germs[0]).toMatchObject({ dead: false });
    expect('hoursAtMax' in state.germs[0]!).toBe(false);
    expect(deadVeg.diedIn).toBe('veg');
    expect(deadFlo.diedIn).toBe('flo');
  });
});

describe('rewindClock', () => {
  it('fait rejouer N actualisations au prochain advance', () => {
    const state = equippedGame();
    const now = state.lastTickAt;
    const { ticks, state: after } = advance(rewindClock(state, 6), now);
    expect(ticks).toBe(6);
    expect(after.lastTickAt).toBe(now);
  });

  it('fait vieillir les germes pendant la simulation', () => {
    const state = sowSeeds(equippedGame(), 'super_skunk', 1, T0);
    const { state: after } = advance(rewindClock(state, 48), T0);
    expect(after.germs[0]!.dead).toBe(true);
  });

  it('refuse les durées invalides', () => {
    expect(() => rewindClock(newGame(), 0)).toThrow('INVALID_QUANTITY');
    expect(() => rewindClock(newGame(), 49)).toThrow('INVALID_QUANTITY');
    expect(() => rewindClock(newGame(), 1.5)).toThrow('INVALID_QUANTITY');
  });
});
