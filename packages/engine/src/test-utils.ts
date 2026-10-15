import { advance } from './advance.ts';
import { createInitialState, HOUR_MS, type GameState, type Plant } from './state.ts';

/** Lundi 5 octobre 2026, 08:00 UTC (heure pleine). */
export const T0 = Date.UTC(2026, 9, 5, 8, 0, 0);

export function newGame(seed = 42): GameState {
  return createInitialState(T0, seed);
}

/** Partie avec de quoi cultiver `plants` plants dans de bonnes conditions. */
export function equippedGame(plants = 3, seed = 42): GameState {
  const state = newGame(seed);
  state.housing = 'maison';
  const inv = state.inventory;
  inv.equipment.lamp_1000 = Math.ceil(plants / 15);
  inv.equipment.heater_15 = Math.ceil(plants / 15);
  inv.equipment.fan_15 = Math.ceil(plants / 15);
  inv.germKits = Math.ceil(plants / 15) + 1;
  inv.seeds.super_skunk = 100;
  inv.pots[40] = 100;
  inv.soilL = 1_000;
  inv.fertVegMl = 10_000;
  inv.fertFloMl = 10_000;
  inv.insecticideMl = 1_000;
  return state;
}

export function hoursLater(state: GameState, hours: number): GameState {
  return advance(state, state.lastTickAt + hours * HOUR_MS).state;
}

/** Ajoute directement un plant en pousse (sans passer par la germination). */
export function addPlant(state: GameState, overrides: Partial<Plant> = {}): Plant {
  const plant: Plant = {
    id: state.nextId++,
    variety: 'super_skunk',
    stage: 'veg',
    height: 10,
    devIndex: 1,
    sex: 'female',
    potSize: 40,
    waterCl: 0,
    fertMl: 0,
    frozen: false,
    overdosed: false,
    overdoseHours: 0,
    infested: false,
    protectedVeg: true,
    floProtectionHours: 1_000,
    pollinationHours: 0,
    conditionSum: 0,
    growthHours: 0,
    dryingHoursLeft: 0,
    harvestGrams: 0,
    harvestSeeds: 0,
    ...overrides,
  };
  state.plants.push(plant);
  return plant;
}

export function plantById(state: GameState, id: number): Plant {
  const plant = state.plants.find((p) => p.id === id);
  if (!plant) throw new Error(`plant ${id} introuvable`);
  return plant;
}
