import { BALANCE } from '../data/balance.ts';
import { VARIETY_IDS, type VarietyId } from '../data/varieties.ts';
import { HOUR_MS, type GameState } from '../state.ts';
import { random } from '../rng.ts';

/** Lundi 5 janvier 1970 00:00 UTC : origine des périodes de prix (alignées sur un lundi). */
const MARKET_EPOCH = 4 * 24 * HOUR_MS;

export function marketPeriod(at: number): number {
  return Math.floor((at - MARKET_EPOCH) / (BALANCE.market.repricePeriodHours * HOUR_MS));
}

/** Début de la période de prix suivante (pour afficher « prochaine réévaluation »). */
export function nextRepriceAt(at: number): number {
  return MARKET_EPOCH + (marketPeriod(at) + 1) * BALANCE.market.repricePeriodHours * HOUR_MS;
}

/** Dernière période calculée (les prix sont demandés très souvent, pour la même semaine). */
let cached: { period: number; prices: Record<VarietyId, number> } | null = null;

/** Échelle de prix mélangée (Fisher-Yates) avec une graine propre à la période. */
function periodPrices(period: number): Record<VarietyId, number> {
  if (cached?.period === period) return cached.prices;
  const holder = { rng: (BALANCE.market.seed ^ Math.imul(period + 1, 0x9e3779b1)) | 0 };
  // Quelques tirages pour bien mélanger la graine.
  random(holder);
  random(holder);
  const ladder = [...BALANCE.market.priceLadder];
  for (let i = ladder.length - 1; i > 0; i--) {
    const j = Math.floor(random(holder) * (i + 1));
    [ladder[i], ladder[j]] = [ladder[j]!, ladder[i]!];
  }
  const prices = Object.fromEntries(VARIETY_IDS.map((id, i) => [id, ladder[i]!])) as Record<VarietyId, number>;
  cached = { period, prices };
  return prices;
}

/**
 * Prix de revente (Wl/g) d'une variété à un instant donné. Déterministe et identique pour
 * tous les joueurs : il ne dépend que de la période et de la graine du marché.
 */
export function marketPrice(variety: VarietyId, at: number): number {
  return periodPrices(marketPeriod(at))[variety];
}

/** Grammes de `variety` déjà vendus par le joueur pendant la période de prix en cours à `at`. */
export function soldThisPeriod(state: GameState, variety: VarietyId, at: number): number {
  return state.marketSold.period === marketPeriod(at) ? (state.marketSold.grams[variety] ?? 0) : 0;
}

/** Facteur de saturation (1 → `floor`) selon les grammes déjà vendus d'une variété cette période. */
export function saturationFactor(soldGrams: number): number {
  const { gramsPerTenPercent, floor } = BALANCE.market.saturation;
  return Math.max(floor, 1 - (0.1 * soldGrams) / gramsPerTenPercent);
}

/** Prix réellement payé au joueur (Wl/g) : prix du marché × sa saturation sur cette variété. */
export function playerPrice(state: GameState, variety: VarietyId, at: number): number {
  return marketPrice(variety, at) * saturationFactor(soldThisPeriod(state, variety, at));
}

/** Compte des grammes vendus (remis à zéro au changement de période). Modifie `state` en place. */
export function recordSale(state: GameState, variety: VarietyId, at: number, grams: number): void {
  const period = marketPeriod(at);
  if (state.marketSold.period !== period) state.marketSold = { period, grams: {} };
  state.marketSold.grams[variety] = (state.marketSold.grams[variety] ?? 0) + grams;
}

export function marketPrices(at: number): Record<VarietyId, number> {
  return Object.fromEntries(VARIETY_IDS.map((id) => [id, marketPrice(id, at)])) as Record<VarietyId, number>;
}
