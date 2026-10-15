import { BALANCE } from './data/balance.ts';
import { GameError } from './errors.ts';
import { randomInt } from './rng.ts';
import { cloneState, HOUR_MS, type GameState } from './state.ts';
import { tickEconomy, type EconomyEvent } from './systems/economy.ts';
import { tickGrowth, type GrowthEvent } from './systems/growth.ts';
import { tickSalesAndPolice, type SalesEvent } from './systems/sales.ts';

export type GameEvent = (GrowthEvent | SalesEvent | EconomyEvent) & { at: number };

export interface AdvanceResult {
  state: GameState;
  events: GameEvent[];
  ticks: number;
}

/** Une actualisation horaire complète, à l'heure pleine `at`. Modifie `state` en place. */
export function tick(state: GameState, at: number): GameEvent[] {
  const events = [...tickGrowth(state, at), ...tickSalesAndPolice(state, at), ...tickEconomy(state, at)];
  state.lastTickAt = at;
  return events.map((event) => ({ ...event, at }));
}

/**
 * Met à niveau un état enregistré par une version précédente du moteur. Modifie `state` en place.
 * - 2026-10-13 : `protectedFlo` (booléen) → `floProtectionHours` (protection en flo qui s'use).
 * - 2026-10-13 : germes `dead` (mort faute de place) ; plants morts `diedIn`.
 * - 2026-10-15 : la mort des germes dépend de leur âge (`sownAt`) : `hoursAtMax` supprimé.
 * - 2026-10-15 : `marketSold` (saturation du marché par joueur).
 */
export function migrateState(state: GameState): void {
  state.marketSold ??= { period: -1, grams: {} };
  for (const germ of state.germs) {
    const legacy = germ as typeof germ & { hoursAtMax?: number };
    legacy.dead ??= false;
    delete legacy.hoursAtMax;
  }
  for (const plant of state.plants) {
    const legacy = plant as typeof plant & { protectedFlo?: boolean };
    if (legacy.floProtectionHours === undefined) {
      const { min, max } = BALANCE.aphids.floProtectionHours;
      legacy.floProtectionHours = legacy.protectedFlo && plant.stage === 'flo' ? randomInt(state, min, max) : 0;
      delete legacy.protectedFlo;
    }
    // Salle inconnue pour les morts d'avant : déduite de la taille.
    if (plant.stage === 'dead' && !plant.diedIn) plant.diedIn = plant.height >= BALANCE.stages.veg.endHeight ? 'flo' : 'veg';
  }
}

/**
 * Outil admin : recule l'horloge du joueur de `hours` heures, pour que le prochain `advance`
 * rejoue autant d'actualisations (avec les heures réelles passées : horaires des lieux, impôts du lundi…).
 * Les dates de semis reculent d'autant, sinon les germes ne vieilliraient pas pendant la simulation.
 */
export function rewindClock(state: GameState, hours: number): GameState {
  if (!Number.isInteger(hours) || hours < 1 || hours > BALANCE.admin.maxRewindHours) throw new GameError('INVALID_QUANTITY');
  const next = cloneState(state);
  next.lastTickAt -= hours * HOUR_MS;
  for (const germ of next.germs) germ.sownAt -= hours * HOUR_MS;
  return next;
}

/**
 * Rejoue toutes les actualisations horaires (à chaque heure pleine) survenues entre
 * `state.lastTickAt` et `now`. Déterministe : même état + même `now` = même résultat.
 * À appeler avant toute action sur le joueur (évaluation paresseuse côté serveur).
 */
export function advance(state: GameState, now: number): AdvanceResult {
  const next = cloneState(state);
  migrateState(next);
  const events: GameEvent[] = [];
  let ticks = 0;
  for (let at = next.lastTickAt + HOUR_MS; at <= now; at += HOUR_MS) {
    events.push(...tick(next, at));
    ticks++;
  }
  return { state: next, events, ticks };
}
