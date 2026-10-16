import { describe, expect, it } from 'vitest';
import { newGame, T0 } from '../test-utils.ts';
import { buyNextHousing, chooseJob, creditQuizRewards, deposit, fireGuards, hireGuards, withdraw } from './economy.ts';

describe('banque (livret unique)', () => {
  it('dépôt puis retrait avec 2,5 % de frais déduits de la somme reçue', () => {
    let state = deposit(newGame(), 1_000, T0);
    expect(state).toMatchObject({ money: 1_000, bankBalance: 1_000 });
    state = withdraw(state, 400, T0);
    expect(state).toMatchObject({ money: 1_000 + 390, bankBalance: 600 });
  });

  it("refuse un dépôt au-delà de la bourse ou du plafond, un retrait au-delà du solde", () => {
    expect(() => deposit(newGame(), 2_001, T0)).toThrow('INSUFFICIENT_FUNDS');
    const rich = newGame();
    rich.money = 1_000_000;
    rich.bankBalance = 24_999_999;
    expect(() => deposit(rich, 2, T0)).toThrow('BANK_CAP_REACHED');
    expect(() => withdraw(newGame(), 1, T0)).toThrow('INSUFFICIENT_BANK_BALANCE');
  });
});

describe('carrière et habitation', () => {
  it('un métier coûte ses frais d’études et dépend de l’habitation', () => {
    const state = newGame();
    state.money = 100_000;
    expect(chooseJob(state, 'fisher', T0)).toMatchObject({ job: 'fisher', money: 86_000 });
    expect(() => chooseJob(state, 'ceo', T0)).toThrow('HOUSING_TOO_SMALL');
    expect(() => chooseJob(chooseJob(state, 'fisher', T0), 'fisher', T0)).toThrow('ALREADY_IN_JOB');
  });

  it("s'achète niveau par niveau jusqu'au Laboratoire", () => {
    const state = newGame();
    state.money = 20_000;
    const cabane = buyNextHousing(state, T0);
    expect(cabane).toMatchObject({ housing: 'cabane', money: 6_500 });
    expect(() => buyNextHousing(cabane, T0)).toThrow('INSUFFICIENT_FUNDS');
    const labo = newGame();
    labo.housing = 'laboratoire';
    expect(() => buyNextHousing(labo, T0)).toThrow('MAX_HOUSING_REACHED');
  });
});

describe('gardes du corps', () => {
  it('embauche à 500 Wl, licenciement à 1 250 Wl', () => {
    const hired = hireGuards(newGame(), 3, T0);
    expect(hired).toMatchObject({ guards: 3, money: 500 });
    expect(() => fireGuards(hired, 4, T0)).toThrow('NOT_ENOUGH_GUARDS');
    expect(() => fireGuards(hired, 1, T0)).toThrow('INSUFFICIENT_FUNDS');
  });
});

describe('quiz du squatte', () => {
  it('verse les gains dans la bourse et le note au journal', () => {
    const state = newGame();
    const next = creditQuizRewards(state, 400, 2, T0);
    expect(next.money).toBe(state.money + 400);
    expect(next.log[0]).toMatchObject({ type: 'quiz_reward', data: { amount: 400, wins: 2 } });
    expect(state.money).toBe(2_000);
    expect(() => creditQuizRewards(state, 0, 1, T0)).toThrow('INVALID_QUANTITY');
  });
});
