import { describe, expect, it } from 'vitest';
import { advance } from '../advance.ts';
import { bribePolice, startSale, stopSale } from '../actions/economy.ts';
import { gameClock } from '../clock.ts';
import { isPlaceOpen, PLACES } from '../data/places.ts';
import { HOUR_MS } from '../state.ts';
import { hoursLater, newGame, T0 } from '../test-utils.ts';
import { marketPeriod, marketPrice, marketPrices, nextRepriceAt, playerPrice, saturationFactor } from './market.ts';
import { BALANCE } from '../data/balance.ts';
import { VARIETY_IDS } from '../data/varieties.ts';

describe('horloge et horaires', () => {
  it("donne le jour et l'heure de Paris", () => {
    // T0 = lundi 08:00 UTC = 10:00 à Paris (heure d'été).
    expect(gameClock(T0)).toEqual({ weekday: 1, hour: 10, dayKey: '2026-10-05' });
  });

  it('respecte les horaires des lieux', () => {
    const monday10 = gameClock(T0);
    expect(isPlaceOpen(PLACES.parc, monday10)).toBe(true);
    expect(isPlaceOpen(PLACES.rave_party, monday10)).toBe(false);
    expect(isPlaceOpen(PLACES.rave_party, { weekday: 6, hour: 3 })).toBe(true);
    expect(isPlaceOpen(PLACES.place_du_village, { weekday: 3, hour: 7 })).toBe(false);
  });
});

/** Variété offerte au départ (150 g) : les ventes des tests partent de ce stock. */
const START = BALANCE.start.stock.variety;

describe('marché', () => {
  it('donne le même prix à tout le monde pendant une période, entier et borné', () => {
    for (const variety of ['super_skunk', 'jack_herer', 'crystal'] as const) {
      const price = marketPrice(variety, T0);
      expect(Number.isInteger(price)).toBe(true);
      expect(price).toBeGreaterThanOrEqual(1);
      expect(marketPrice(variety, T0 + 2 * HOUR_MS)).toBe(price);
    }
  });

  it('redistribue toute l’échelle de prix chaque semaine : toujours deux variétés à 7', () => {
    expect(BALANCE.market.priceLadder).toHaveLength(VARIETY_IDS.length);
    const sorted = (prices: Record<string, number>) => Object.values(prices).sort((a, b) => a - b);
    const ladder = [...BALANCE.market.priceLadder].sort((a, b) => a - b);
    let at = T0;
    const topVarieties = new Set<string>();
    for (let week = 0; week < 10; week++) {
      const prices = marketPrices(at);
      expect(sorted(prices)).toEqual(ladder);
      expect(Object.values(prices).filter((p) => p === 7)).toHaveLength(2);
      for (const [v, p] of Object.entries(prices)) if (p === 7) topVarieties.add(v);
      at = nextRepriceAt(at);
    }
    // Les variétés les mieux payées changent d'une semaine à l'autre.
    expect(topVarieties.size).toBeGreaterThan(2);
  });

  it('réévalue les prix à chaque période', () => {
    const now = marketPrices(T0);
    const later = marketPrices(nextRepriceAt(T0));
    expect(later).not.toEqual(now);
    expect(nextRepriceAt(T0)).toBeGreaterThan(T0);
  });
});

describe('saturation du marché (par joueur)', () => {
  it('−10 % tous les 3 000 g vendus d’une variété, jusqu’à −50 %', () => {
    expect(saturationFactor(0)).toBe(1);
    expect(saturationFactor(3_000)).toBeCloseTo(0.9);
    expect(saturationFactor(7_500)).toBeCloseTo(0.75);
    expect(saturationFactor(100_000)).toBe(0.5);
  });

  it('compte les grammes vendus et baisse le prix payé, variété par variété', () => {
    const game = newGame();
    game.stock[START] = 1_000;
    const after = hoursLater(startSale(game, 'parc', START, 1_000, T0), 3);
    expect(after.marketSold).toEqual({ period: marketPeriod(T0), grams: { [START]: 3 * 136 } });
    expect(playerPrice(after, START, T0)).toBeCloseTo(marketPrice(START, T0) * saturationFactor(3 * 136));
    const other = START === 'crystal' ? 'afghane' : 'crystal';
    expect(playerPrice(after, other, T0)).toBe(marketPrice(other, T0));
  });

  it('paie la vente au prix saturé', () => {
    const game = newGame();
    game.marketSold = { period: marketPeriod(T0), grams: { [START]: 15_000 } };
    const after = hoursLater(startSale(game, 'parc', START, 150, T0), 1);
    expect(after.sales[0]!.earned).toBe(Math.round((136 * marketPrice(START, T0) * 0.5 * 115) / 100));
  });

  it('repart à zéro à la période de prix suivante', () => {
    const game = newGame();
    game.marketSold = { period: marketPeriod(T0), grams: { [START]: 15_000 } };
    const next = nextRepriceAt(T0);
    expect(playerPrice(game, START, next)).toBe(marketPrice(START, next));
  });
});

describe('ventes dans les lieux', () => {
  it('vend la capacité horaire au prix du marché × rente et fait monter l’indice', () => {
    const state = startSale(newGame(), 'parc', START, 150, T0);
    expect(state.stock[START]).toBe(0);
    const after = hoursLater(state, 1);
    const sale = after.sales[0]!;
    const price = marketPrice(START, T0);
    expect(sale.gramsSold).toBe(136);
    expect(sale.earned).toBe(Math.round((136 * price * 115) / 100));
    expect(after.policeIndex).toBeCloseTo(136 * 0.6 * 0.1);
  });

  it("termine la vente et verse l'argent dans la bourse", () => {
    const state = startSale(newGame(), 'parc', START, 150, T0);
    const result = advance(state, T0 + 2 * HOUR_MS);
    expect(result.state.sales).toHaveLength(0);
    const completed = result.events.find((e) => e.type === 'sale_completed');
    expect(completed).toBeDefined();
    expect(result.state.money).toBe(2_000 + (completed as { earned: number }).earned);
  });

  it('ne vend rien pendant les heures de fermeture', () => {
    // Parc ouvert 8h-22h (Paris). Mise en vente à 21h30, actualisations de 22h puis 23h.
    const at2130 = T0 + 11.5 * HOUR_MS;
    const game = newGame();
    game.lastTickAt = T0 + 11 * HOUR_MS;
    game.stock[START] = 1_000;
    const state = startSale(game, 'parc', START, 1_000, at2130);
    const after22 = hoursLater(state, 1);
    expect(after22.sales[0]!.gramsSold).toBe(136);
    expect(hoursLater(after22, 1).sales[0]!.gramsSold).toBe(136);
  });

  it('refuse un lieu fermé, une vente en double ou un stock insuffisant', () => {
    const state = newGame();
    expect(() => startSale(state, 'rave_party', START, 10, T0)).toThrow('PLACE_CLOSED');
    const selling = startSale(state, 'parc', START, 10, T0);
    expect(() => startSale(selling, 'parc', START, 10, T0)).toThrow('SALE_ALREADY_RUNNING');
    expect(() => startSale(state, 'gare', START, 151, T0)).toThrow('INSUFFICIENT_STOCK');
  });

  it("retirer une vente rend les invendus et l'argent ramassé", () => {
    const game = newGame();
    game.stock[START] = 500;
    const after = hoursLater(startSale(game, 'parc', START, 500, T0), 1);
    const earned = after.sales[0]!.earned;
    const stopped = stopSale(after, 'parc', after.lastTickAt);
    expect(stopped.stock[START]).toBe(500 - 136);
    expect(stopped.money).toBe(2_000 + earned);
    expect(stopped.sales).toHaveLength(0);
  });
});

describe('police', () => {
  it("l'indice redescend chaque heure sans vente (2,5 % du max)", () => {
    const state = newGame();
    state.policeIndex = 50;
    expect(hoursLater(state, 2).policeIndex).toBeCloseTo(40);
  });

  it("au-dessus du max, alerte puis descente des stups à l'heure suivante", () => {
    const game = newGame();
    game.stock[START] = 2_000;
    game.policeIndex = 195;
    game.job = 'bus_driver';
    const selling = startSale(game, 'parc', START, 2_000, T0);
    const alerted = advance(selling, T0 + HOUR_MS);
    expect(alerted.state.raidPending).toBe(true);
    expect(alerted.events.some((e) => e.type === 'police_alert')).toBe(true);

    const raided = advance(alerted.state, T0 + 2 * HOUR_MS);
    const raid = raided.events.find((e) => e.type === 'raid') as { fine: number; seizedGrams: number };
    expect(raid.fine).toBe(Math.round(alerted.state.policeIndex * 30));
    expect(raid.seizedGrams).toBe(2_000 - 136);
    expect(raided.state).toMatchObject({ sales: [], policeIndex: 0, raidPending: false, job: 'none' });
    expect(raided.state.money).toBe(2_000 - raid.fine);
  });

  it('le commissaire corrompu annule la descente pour indice × 20', () => {
    const game = newGame();
    game.money = 10_000;
    game.policeIndex = 210;
    game.raidPending = true;
    const bribed = bribePolice(game, T0);
    expect(bribed).toMatchObject({ policeIndex: 0, raidPending: false, money: 10_000 - 4_200 });
    expect(advance(bribed, T0 + HOUR_MS).events.some((e) => e.type === 'raid')).toBe(false);
  });
});
