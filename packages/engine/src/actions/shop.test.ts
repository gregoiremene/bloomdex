import { describe, expect, it } from 'vitest';
import { BALANCE } from '../data/balance.ts';
import { GameError } from '../errors.ts';
import { newGame, T0 } from '../test-utils.ts';
import { buy, type ShopItem } from './shop.ts';

describe('boutique', () => {
  it('démarre avec 2 000 Wl, la Chambre et le stock offert', () => {
    const state = newGame();
    expect(state.money).toBe(2_000);
    expect(state.housing).toBe('chambre');
    expect(state.stock[BALANCE.start.stock.variety]).toBe(BALANCE.start.stock.grams);
  });

  it('vend les graines par paquets de 15', () => {
    const state = buy(newGame(), { kind: 'seeds', variety: 'shiva_shanti' }, 2, T0);
    expect(state.inventory.seeds.shiva_shanti).toBe(30);
    expect(state.money).toBe(2_000 - 2 * 33);
    expect(state.log[0]).toMatchObject({ type: 'purchase', data: { quantity: 2, cost: 66 } });
  });

  it('crédite les consommables selon leur contenance', () => {
    let state = newGame();
    state = buy(state, { kind: 'consumable', id: 'soil' }, 2, T0);
    state = buy(state, { kind: 'consumable', id: 'fertVeg' }, 1, T0);
    state = buy(state, { kind: 'consumable', id: 'germKit' }, 1, T0);
    expect(state.inventory.soilL).toBe(30);
    expect(state.inventory.fertVegMl).toBe(250);
    expect(state.inventory.germKits).toBe(1);
  });

  it('refuse un achat trop cher sans toucher à la partie', () => {
    const state = newGame();
    expect(() => buy(state, { kind: 'equipment', id: 'lamp_1000' }, 3, T0)).toThrow(GameError);
    expect(state.money).toBe(2_000);
    expect(state.inventory.equipment.lamp_1000).toBe(0);
  });

  it('refuse les quantités invalides', () => {
    expect(() => buy(newGame(), { kind: 'pot', size: 40 }, 0, T0)).toThrow('INVALID_QUANTITY');
    expect(() => buy(newGame(), { kind: 'pot', size: 40 }, 1.5, T0)).toThrow('INVALID_QUANTITY');
  });

  it('permet de démarrer une Chambre (3 plants) avec le budget de départ', () => {
    const kit: [ShopItem, number][] = [
      [{ kind: 'equipment', id: 'lamp_250' }, 1],
      [{ kind: 'equipment', id: 'heater_3' }, 1],
      [{ kind: 'equipment', id: 'fan_3' }, 1],
      [{ kind: 'consumable', id: 'germKit' }, 1],
      [{ kind: 'seeds', variety: 'shiva_shanti' }, 1],
      [{ kind: 'pot', size: 40 }, 3],
      [{ kind: 'consumable', id: 'soil' }, 2],
      [{ kind: 'consumable', id: 'fertVeg' }, 1],
      [{ kind: 'consumable', id: 'fertFlo' }, 1],
      [{ kind: 'consumable', id: 'insecticide' }, 1],
    ];
    const state = kit.reduce((s, [item, qty]) => buy(s, item, qty, T0), newGame());
    expect(state.money).toBeGreaterThan(0);
  });
});
