import { gameClock } from '../clock.ts';
import { BALANCE } from '../data/balance.ts';
import { HOUSINGS } from '../data/housings.ts';
import { isPlaceOpen, PLACES, type PlaceId } from '../data/places.ts';
import { addLog, HOUR_MS, type GameState } from '../state.ts';
import { playerPrice, recordSale } from './market.ts';

export type SalesEvent =
  | { type: 'sale_completed'; placeId: PlaceId; earned: number }
  | { type: 'police_alert'; index: number; max: number }
  | { type: 'raid'; fine: number; seizedMoney: number; seizedGrams: number };

export function policeIndexMax(state: GameState): number {
  return HOUSINGS[state.housing].policeIndexMax;
}

/** Ventes de l'heure qui vient de s'écouler ([at - 1 h, at[), si le lieu était ouvert. */
function tickSales(state: GameState, at: number, events: SalesEvent[]): void {
  const clock = gameClock(at - HOUR_MS);
  for (const sale of state.sales) {
    const place = PLACES[sale.placeId];
    if (!isPlaceOpen(place, clock)) continue;
    const grams = Math.min(place.capacityPerHour, sale.gramsLeft);
    if (grams <= 0) continue;
    // Prix saturé selon ce que le joueur a déjà vendu de cette variété (au début de l'heure).
    const price = playerPrice(state, sale.variety, at - HOUR_MS);
    recordSale(state, sale.variety, at - HOUR_MS, grams);
    sale.gramsLeft -= grams;
    sale.gramsSold += grams;
    sale.earned += Math.round((grams * price * place.rentPercent) / 100);
    state.policeIndex += grams * place.riskPercent * BALANCE.police.indexPerGramRisk;
  }
  const completed = state.sales.filter((s) => s.gramsLeft <= 0);
  for (const sale of completed) {
    state.money += sale.earned;
    events.push({ type: 'sale_completed', placeId: sale.placeId, earned: sale.earned });
    addLog(state, at, 'sale_completed', { placeId: sale.placeId, variety: sale.variety, grams: sale.gramsSold, earned: sale.earned });
  }
  state.sales = state.sales.filter((s) => s.gramsLeft > 0);
}

/** Descente des stups : amende, saisie de tout ce qui est sur les lieux de vente, perte du métier. */
function raid(state: GameState, at: number, events: SalesEvent[]): void {
  const fine = Math.round(state.policeIndex * BALANCE.police.raidFinePerIndex);
  const seizedMoney = state.sales.reduce((sum, s) => sum + s.earned, 0);
  const seizedGrams = state.sales.reduce((sum, s) => sum + s.gramsLeft, 0);
  state.money -= fine;
  state.sales = [];
  state.job = 'none';
  state.policeIndex = 0;
  state.raidPending = false;
  events.push({ type: 'raid', fine, seizedMoney, seizedGrams });
  addLog(state, at, 'raid', { fine, seizedMoney, seizedGrams });
}

function tickPolice(state: GameState, at: number, events: SalesEvent[]): void {
  const max = policeIndexMax(state);
  state.raidPending = false;
  if (state.sales.length === 0) {
    const decay = (max * BALANCE.police.decayPercentOfMaxPerHour) / 100;
    state.policeIndex = Math.max(0, state.policeIndex - decay * BALANCE.gameSpeed);
  }
  if (state.policeIndex > max) {
    state.raidPending = true;
    events.push({ type: 'police_alert', index: state.policeIndex, max });
  }
}

/** Une actualisation horaire des ventes et de la police. Modifie `state` en place. */
export function tickSalesAndPolice(state: GameState, at: number): SalesEvent[] {
  const events: SalesEvent[] = [];
  // La police vérifie d'abord l'alerte de l'heure précédente, puis les ventes de l'heure font monter l'indice.
  const max = policeIndexMax(state);
  if (state.raidPending && state.policeIndex > max) {
    raid(state, at, events);
    return events;
  }
  tickSales(state, at, events);
  tickPolice(state, at, events);
  return events;
}
