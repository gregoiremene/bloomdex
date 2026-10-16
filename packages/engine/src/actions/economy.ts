import { gameClock } from '../clock.ts';
import { BALANCE } from '../data/balance.ts';
import { HOUSINGS, nextHousing } from '../data/housings.ts';
import { JOBS, type JobId } from '../data/jobs.ts';
import { isPlaceOpen, PLACES, type PlaceId } from '../data/places.ts';
import type { VarietyId } from '../data/varieties.ts';
import { GameError } from '../errors.ts';
import { addLog, cloneState, type GameState } from '../state.ts';

function assertPositiveInt(value: number): void {
  if (!Number.isInteger(value) || value <= 0) throw new GameError('INVALID_QUANTITY');
}

function spend(state: GameState, cost: number): void {
  if (state.money < cost) throw new GameError('INSUFFICIENT_FUNDS', { cost, money: state.money });
  state.money -= cost;
}

// ---------------------------------------------------------------- Quiz du squatte

/**
 * Verse les gains du quiz (montants décidés côté serveur, table quiz_config) dans la bourse.
 * Appelé par la fonction game avant l'action du joueur ; pas une action que le joueur peut envoyer.
 */
export function creditQuizRewards(state: GameState, amount: number, wins: number, now: number): GameState {
  assertPositiveInt(amount);
  assertPositiveInt(wins);
  const next = cloneState(state);
  next.money += amount;
  addLog(next, now, 'quiz_reward', { amount, wins });
  return next;
}

// ---------------------------------------------------------------- Ventes

/** Dépose des grammes dans un lieu ouvert. Une seule vente par lieu à la fois. */
export function startSale(state: GameState, placeId: PlaceId, variety: VarietyId, grams: number, now: number): GameState {
  assertPositiveInt(grams);
  const place = PLACES[placeId];
  if (!place) throw new GameError('UNKNOWN_PLACE');
  if (!isPlaceOpen(place, gameClock(now))) throw new GameError('PLACE_CLOSED');
  if (state.sales.some((s) => s.placeId === placeId)) throw new GameError('SALE_ALREADY_RUNNING');
  if (state.stock[variety] < grams) throw new GameError('INSUFFICIENT_STOCK');

  const next = cloneState(state);
  next.stock[variety] -= grams;
  next.sales.push({ placeId, variety, gramsLeft: grams, gramsSold: 0, earned: 0, startedAt: now });
  addLog(next, now, 'sale_started', { placeId, variety, grams });
  return next;
}

/** Retire une vente : les invendus reviennent dans la bourse avec l'argent ramassé. */
export function stopSale(state: GameState, placeId: PlaceId, now: number): GameState {
  const next = cloneState(state);
  const sale = next.sales.find((s) => s.placeId === placeId);
  if (!sale) throw new GameError('SALE_NOT_FOUND');
  next.stock[sale.variety] += sale.gramsLeft;
  next.money += sale.earned;
  next.sales = next.sales.filter((s) => s !== sale);
  addLog(next, now, 'sale_stopped', { placeId, variety: sale.variety, grams: sale.gramsSold, earned: sale.earned });
  return next;
}

export function bribeCost(state: GameState): number {
  return Math.ceil(state.policeIndex * BALANCE.police.bribePerIndex);
}

/** Le commissaire corrompu remet l'indice police à zéro (et annule une descente imminente). */
export function bribePolice(state: GameState, now: number): GameState {
  if (state.policeIndex <= 0) throw new GameError('NOTHING_TO_BRIBE');
  const next = cloneState(state);
  const cost = bribeCost(next);
  spend(next, cost);
  next.policeIndex = 0;
  next.raidPending = false;
  addLog(next, now, 'bribe', { cost });
  return next;
}

// ---------------------------------------------------------------- Banque

export function deposit(state: GameState, amount: number, now: number): GameState {
  assertPositiveInt(amount);
  if (state.bankBalance + amount > BALANCE.bank.cap) throw new GameError('BANK_CAP_REACHED', { cap: BALANCE.bank.cap });
  const next = cloneState(state);
  spend(next, amount);
  next.bankBalance += amount;
  addLog(next, now, 'bank_deposit', { amount });
  return next;
}

export function withdrawalFee(amount: number): number {
  return Math.ceil(amount * BALANCE.bank.withdrawalFeeRate);
}

/** Retire `amount` du livret ; les frais sont déduits de la somme reçue. */
export function withdraw(state: GameState, amount: number, now: number): GameState {
  assertPositiveInt(amount);
  if (state.bankBalance < amount) throw new GameError('INSUFFICIENT_BANK_BALANCE');
  const next = cloneState(state);
  const fee = withdrawalFee(amount);
  next.bankBalance -= amount;
  next.money += amount - fee;
  addLog(next, now, 'bank_withdrawal', { amount, fee });
  return next;
}

// ---------------------------------------------------------------- Carrière & habitation

/** Change de métier en payant ses frais d'études. */
export function chooseJob(state: GameState, jobId: JobId, now: number): GameState {
  const job = JOBS[jobId];
  if (!job) throw new GameError('UNKNOWN_JOB');
  if (state.job === jobId) throw new GameError('ALREADY_IN_JOB');
  if (HOUSINGS[state.housing].level < HOUSINGS[job.minHousing].level) throw new GameError('HOUSING_TOO_SMALL', { required: job.minHousing });
  const next = cloneState(state);
  spend(next, job.studyCost);
  next.job = jobId;
  addLog(next, now, 'job_changed', { job: jobId, cost: job.studyCost });
  return next;
}

/** Achète l'habitation de niveau supérieur (l'ancienne est perdue, plants et matériel suivent). */
export function buyNextHousing(state: GameState, now: number): GameState {
  const target = nextHousing(state.housing);
  if (!target) throw new GameError('MAX_HOUSING_REACHED');
  const next = cloneState(state);
  spend(next, target.price);
  next.housing = target.id;
  addLog(next, now, 'housing_bought', { housing: target.id, cost: target.price });
  return next;
}

// ---------------------------------------------------------------- Gardes du corps

export function hireGuards(state: GameState, count: number, now: number): GameState {
  assertPositiveInt(count);
  const next = cloneState(state);
  spend(next, count * BALANCE.security.guardHireCost);
  next.guards += count;
  addLog(next, now, 'guards_hired', { count });
  return next;
}

export function fireGuards(state: GameState, count: number, now: number): GameState {
  assertPositiveInt(count);
  if (state.guards < count) throw new GameError('NOT_ENOUGH_GUARDS');
  const next = cloneState(state);
  spend(next, count * BALANCE.security.guardFireCost);
  next.guards -= count;
  addLog(next, now, 'guards_fired', { count });
  return next;
}
