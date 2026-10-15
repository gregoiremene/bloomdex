import { BALANCE } from '../data/balance.ts';
import { HOUSINGS } from '../data/housings.ts';
import { POTS, type PotSize } from '../data/equipment.ts';
import type { VarietyId } from '../data/varieties.ts';
import { GameError } from '../errors.ts';
import { randomBetween, randomInt, chance } from '../rng.ts';
import { addLog, cloneState, growingPlants, isProtected, type GameState, type Germ, type Plant, type Room } from '../state.ts';

/** Plants ciblés : liste d'ids, une salle entière, ou tous les plants en pousse. */
export type PlantSelector = number[] | { room: Room } | 'all';

function assertCount(count: number): void {
  if (!Number.isInteger(count) || count <= 0) throw new GameError('INVALID_QUANTITY');
}

function selectGrowing(state: GameState, selector: PlantSelector): Plant[] {
  if (selector === 'all') return growingPlants(state);
  if (!Array.isArray(selector)) return state.plants.filter((p) => p.stage === selector.room);
  return selector.map((id) => {
    const plant = state.plants.find((p) => p.id === id);
    if (!plant) throw new GameError('PLANT_NOT_FOUND', { plantId: id });
    if (plant.stage !== 'veg' && plant.stage !== 'flo') throw new GameError('PLANT_NOT_GROWING', { plantId: id });
    return plant;
  });
}

function fertStockKey(room: Room): 'fertVegMl' | 'fertFloMl' {
  return room === 'veg' ? 'fertVegMl' : 'fertFloMl';
}

// ---------------------------------------------------------------- Germination

export function germinationCapacity(state: GameState): number {
  return state.inventory.germKits * BALANCE.germination.seedsPerKit;
}

/** Place des graines dans les kits de germination. */
export function sowSeeds(state: GameState, variety: VarietyId, count: number, now: number): GameState {
  assertCount(count);
  if (state.inventory.seeds[variety] < count) throw new GameError('INSUFFICIENT_SEEDS');
  const free = germinationCapacity(state) - state.germs.length;
  if (count > free) throw new GameError('GERMINATION_FULL', { free });

  const next = cloneState(state);
  const g = BALANCE.germination;
  next.inventory.seeds[variety] -= count;
  for (let i = 0; i < count; i++) {
    next.germs.push({
      id: next.nextId++,
      variety,
      height: 0,
      devIndex: randomBetween(next, g.devIndexMin, g.devIndexMax),
      sownAt: now,
      dead: false,
    });
  }
  addLog(next, now, 'seeds_sown', { variety, count });
  return next;
}

export function discardGerms(state: GameState, germIds: number[]): GameState {
  const next = cloneState(state);
  const ids = new Set(germIds);
  next.germs = next.germs.filter((g) => !ids.has(g.id));
  return next;
}

function transplant(state: GameState, germs: Germ[], potSize: PotSize): void {
  const count = germs.length;
  const housing = HOUSINGS[state.housing];
  const free = housing.plantCapacity - growingPlants(state).length;
  if (count > free) throw new GameError('HOUSING_FULL', { free });
  if (state.inventory.pots[potSize] < count) throw new GameError('INSUFFICIENT_POTS');
  const soil = POTS[potSize].soilLiters * count;
  if (state.inventory.soilL < soil) throw new GameError('INSUFFICIENT_SOIL', { needed: soil });

  state.inventory.pots[potSize] -= count;
  state.inventory.soilL -= soil;
  const planted = new Set(germs.map((g) => g.id));
  state.germs = state.germs.filter((g) => !planted.has(g.id));
  for (const germ of germs) {
    state.plants.push({
      id: germ.id,
      variety: germ.variety,
      stage: 'veg',
      height: germ.height,
      devIndex: germ.devIndex,
      sex: chance(state, BALANCE.sex.maleChance) ? 'male' : 'female',
      potSize,
      waterCl: 0,
      fertMl: 0,
      frozen: false,
      overdosed: false,
      overdoseHours: 0,
      infested: false,
      protectedVeg: false,
      floProtectionHours: 0,
      pollinationHours: 0,
      conditionSum: 0,
      growthHours: 0,
      dryingHoursLeft: 0,
      harvestGrams: 0,
      harvestSeeds: 0,
    });
  }
}

/** Plante des germes précis (≥ 10 cm) en végétation. À arroser avant la prochaine actualisation ! */
export function plantGerms(state: GameState, germIds: number[], potSize: PotSize, now: number): GameState {
  if (germIds.length === 0) throw new GameError('INVALID_QUANTITY');
  const next = cloneState(state);
  const germs = germIds.map((id) => {
    const germ = next.germs.find((g) => g.id === id);
    if (!germ) throw new GameError('GERM_NOT_FOUND', { germId: id });
    if (germ.dead) throw new GameError('GERM_DEAD', { germId: id });
    if (germ.height < BALANCE.germination.plantableHeight) throw new GameError('GERM_NOT_READY', { germId: id });
    return germ;
  });
  transplant(next, germs, potSize);
  addLog(next, now, 'germs_planted', { count: germs.length, potSize });
  return next;
}

/** Plante les `count` germes prêts les plus grands (donc les plus rapides). */
export function plantFastestGerms(state: GameState, count: number, potSize: PotSize, now: number): GameState {
  assertCount(count);
  const ready = state.germs
    .filter((g) => !g.dead && g.height >= BALANCE.germination.plantableHeight)
    .sort((a, b) => b.height - a.height || b.devIndex - a.devIndex);
  if (ready.length < count) throw new GameError('NOT_ENOUGH_READY_GERMS', { ready: ready.length });
  return plantGerms(state, ready.slice(0, count).map((g) => g.id), potSize, now);
}

// ---------------------------------------------------------------- Soins

/**
 * Ajoute de l'eau et de l'engrais à chaque plant ciblé. Dépasser le maximum de la salle
 * (5 en végétation, 15 en floraison) le surdose : il faudra le rempoter.
 */
export function waterPlants(
  state: GameState,
  selector: PlantSelector,
  dose: { waterCl: number; fertMl: number },
): GameState {
  if (dose.waterCl < 0 || dose.fertMl < 0) throw new GameError('INVALID_QUANTITY');
  const next = cloneState(state);
  const plants = selectGrowing(next, selector);
  for (const room of ['veg', 'flo'] as const) {
    const needed = plants.filter((p) => p.stage === room).length * dose.fertMl;
    if (next.inventory[fertStockKey(room)] < needed) throw new GameError('INSUFFICIENT_FERTILIZER', { room, needed });
  }
  for (const plant of plants) {
    const room = plant.stage as Room;
    const stage = BALANCE.stages[room];
    plant.waterCl += dose.waterCl;
    plant.fertMl += dose.fertMl;
    next.inventory[fertStockKey(room)] -= dose.fertMl;
    next.meters.waterCl += dose.waterCl;
    if (plant.waterCl > stage.waterMaxCl || plant.fertMl > stage.fertMaxMl) plant.overdosed = true;
  }
  return next;
}

/** Complète l'eau et l'engrais de chaque plant ciblé jusqu'au maximum, sans jamais surdoser. */
export function fillToMax(state: GameState, selector: PlantSelector): GameState {
  const next = cloneState(state);
  const plants = selectGrowing(next, selector).filter((p) => !p.overdosed);
  for (const room of ['veg', 'flo'] as const) {
    const max = BALANCE.stages[room].fertMaxMl;
    const needed = plants.filter((p) => p.stage === room).reduce((sum, p) => sum + Math.max(0, max - p.fertMl), 0);
    if (next.inventory[fertStockKey(room)] < needed) throw new GameError('INSUFFICIENT_FERTILIZER', { room, needed });
  }
  for (const plant of plants) {
    const room = plant.stage as Room;
    const stage = BALANCE.stages[room];
    const water = Math.max(0, stage.waterMaxCl - plant.waterCl);
    const fert = Math.max(0, stage.fertMaxMl - plant.fertMl);
    plant.waterCl += water;
    plant.fertMl += fert;
    next.inventory[fertStockKey(room)] -= fert;
    next.meters.waterCl += water;
  }
  return next;
}

/** Traite contre les pucerons : protège le plant pour son stade actuel et le guérit. */
export function treatPlants(state: GameState, selector: PlantSelector): GameState {
  const next = cloneState(state);
  const plants = selectGrowing(next, selector).filter((p) => !isProtected(p));
  const needed = plants.length * BALANCE.aphids.insecticidePerTreatmentMl;
  if (next.inventory.insecticideMl < needed) throw new GameError('INSUFFICIENT_INSECTICIDE', { needed });
  next.inventory.insecticideMl -= needed;
  for (const plant of plants) {
    if (plant.stage === 'veg') plant.protectedVeg = true;
    else plant.floProtectionHours = randomInt(next, BALANCE.aphids.floProtectionHours.min, BALANCE.aphids.floProtectionHours.max);
    plant.infested = false;
  }
  return next;
}

/** Geler : le plant ne pousse plus et ne consomme plus (les mâles gelés pollinisent toujours). */
export function setFrozen(state: GameState, selector: PlantSelector, frozen: boolean): GameState {
  const next = cloneState(state);
  for (const plant of selectGrowing(next, selector)) plant.frozen = frozen;
  return next;
}

/** Rempote des plants surdosés : pot neuf de même taille, eau et engrais remis à zéro. */
export function repot(state: GameState, plantIds: number[], now: number): GameState {
  const next = cloneState(state);
  const plants = selectGrowing(next, plantIds);
  for (const plant of plants) {
    if (!plant.overdosed) throw new GameError('PLANT_NOT_OVERDOSED', { plantId: plant.id });
  }
  for (const plant of plants) {
    const pot = POTS[plant.potSize];
    if (next.inventory.pots[plant.potSize] < 1) throw new GameError('INSUFFICIENT_POTS', { potSize: plant.potSize });
    if (next.inventory.soilL < pot.soilLiters) throw new GameError('INSUFFICIENT_SOIL', { needed: pot.soilLiters });
    next.inventory.pots[plant.potSize] -= 1;
    next.inventory.soilL -= pot.soilLiters;
    plant.waterCl = 0;
    plant.fertMl = 0;
    plant.overdosed = false;
    plant.overdoseHours = 0;
  }
  addLog(next, now, 'plants_repotted', { count: plants.length });
  return next;
}

export function setLightHours(state: GameState, room: Room, hours: number): GameState {
  if (!Number.isInteger(hours) || hours < 0 || hours > 24) throw new GameError('INVALID_LIGHT_HOURS');
  const next = cloneState(state);
  next.lightHours[room] = hours;
  return next;
}

// ---------------------------------------------------------------- Tri & récolte

export function discardPlants(state: GameState, plantIds: number[]): GameState {
  const ids = new Set(plantIds);
  for (const id of ids) {
    if (!state.plants.some((p) => p.id === id)) throw new GameError('PLANT_NOT_FOUND', { plantId: id });
  }
  const next = cloneState(state);
  next.plants = next.plants.filter((p) => !ids.has(p.id));
  return next;
}

/** Jette tous les mâles identifiés (leur sexe se révèle en floraison). */
export function discardMales(state: GameState): GameState {
  const next = cloneState(state);
  next.plants = next.plants.filter((p) => !(p.stage === 'flo' && p.sex === 'male'));
  return next;
}

export function clearDead(state: GameState): GameState {
  const next = cloneState(state);
  next.plants = next.plants.filter((p) => p.stage !== 'dead');
  return next;
}

/** Récolte tous les plants secs : beuh dans la bourse, graines dans l'inventaire. */
export function harvest(state: GameState, now: number): GameState {
  const next = cloneState(state);
  const dry = next.plants.filter((p) => p.stage === 'dry');
  let grams = 0;
  let seeds = 0;
  for (const plant of dry) {
    next.stock[plant.variety] += plant.harvestGrams;
    next.inventory.seeds[plant.variety] += plant.harvestSeeds;
    grams += plant.harvestGrams;
    seeds += plant.harvestSeeds;
  }
  next.plants = next.plants.filter((p) => p.stage !== 'dry');
  if (dry.length > 0) addLog(next, now, 'harvest', { plants: dry.length, grams, seeds });
  return next;
}
