import { describe, expect, it } from 'vitest';
import { HOUR_MS, type GameState } from '../state.ts';
import { newGame, T0 } from '../test-utils.ts';
import { attemptTheft, investigate, theftSuccessChance } from './pvp.ts';

const refs = { attacker: { id: 'a', pseudo: 'Alice' }, victim: { id: 'b', pseudo: 'Bob' } };

function players(): { attacker: GameState; victim: GameState } {
  const attacker = newGame(1);
  attacker.money = 50_000;
  const victim = newGame(2);
  victim.housing = 'maison';
  victim.money = 100_000;
  victim.stock.super_skunk = 1_000;
  return { attacker, victim };
}

describe('vols', () => {
  it('sans garde du corps, le vol réussit et prend 5 à 10 % de la bourse', () => {
    const { attacker, victim } = players();
    const result = attemptTheft(attacker, victim, refs, 2, T0);
    expect(result.success).toBe(true);
    expect(result.money).toBeGreaterThanOrEqual(5_000);
    expect(result.money).toBeLessThanOrEqual(10_000);
    expect(result.attacker.money).toBe(50_000 - 6_000 + result.money);
    expect(result.victim.money).toBe(100_000 - result.money);
    expect(result.victim.stock.super_skunk + result.attacker.stock.super_skunk).toBe(victim.stock.super_skunk + attacker.stock.super_skunk);
    expect(result.victim.log[0]).toMatchObject({ type: 'robbed', data: { attacker: 'Alice' } });
    expect(result.attacker.log[0]).toMatchObject({ type: 'theft_success', data: { target: 'Bob' } });
  });

  it('les gardes du corps font baisser les chances', () => {
    expect(theftSuccessChance(1, 0)).toBe(1);
    expect(theftSuccessChance(1, 3)).toBe(0.25);
    const { attacker, victim } = players();
    victim.guards = 1_000;
    const result = attemptTheft(attacker, victim, refs, 1, T0);
    expect(result.success).toBe(false);
    expect(result.victim.money).toBe(100_000);
    expect(result.victim.log[0]!.type).toBe('theft_repelled');
  });

  it('protège les habitations sous la Maison et les plus petites que celle de l’attaquant', () => {
    const { attacker, victim } = players();
    victim.housing = 'maisonnette';
    expect(() => attemptTheft(attacker, victim, refs, 1, T0)).toThrow('TARGET_PROTECTED');
    victim.housing = 'maison';
    attacker.housing = 'villa';
    expect(() => attemptTheft(attacker, victim, refs, 1, T0)).toThrow('TARGET_TOO_SMALL');
  });

  it('limite à 3 attaques par jour', () => {
    let { attacker, victim } = players();
    for (let i = 0; i < 3; i++) ({ attacker, victim } = attemptTheft(attacker, victim, refs, 1, T0 + i * HOUR_MS));
    expect(() => attemptTheft(attacker, victim, refs, 1, T0 + 4 * HOUR_MS)).toThrow('DAILY_THEFT_LIMIT');
    // Le lendemain, le compteur repart.
    expect(() => attemptTheft(attacker, victim, refs, 1, T0 + 24 * HOUR_MS)).not.toThrow();
  });

  it('refuse de se voler soi-même ou sans argent pour payer les voleurs', () => {
    const { attacker, victim } = players();
    expect(() => attemptTheft(attacker, victim, { attacker: refs.attacker, victim: refs.attacker }, 1, T0)).toThrow('CANNOT_TARGET_SELF');
    expect(() => attemptTheft(attacker, victim, refs, 20, T0)).toThrow('INSUFFICIENT_FUNDS');
  });
});

describe('détective', () => {
  it('révèle les gardes et le matériel, pas l’argent, pour 250 Wl', () => {
    const { attacker, victim } = players();
    victim.guards = 4;
    const { state, report } = investigate(attacker, victim, refs.victim, T0);
    expect(state.money).toBe(50_000 - 250);
    expect(report).toMatchObject({ pseudo: 'Bob', housing: 'maison', guards: 4, growingPlants: 0 });
    expect(report).not.toHaveProperty('money');
  });
});
