import { BALANCE } from '../data/balance.ts';
import { EQUIPMENT, EQUIPMENT_IDS, POTS, type EquipmentKind } from '../data/equipment.ts';
import { chance, randomBetween, randomInt } from '../rng.ts';
import { addLog, germHoursLeft, growingPlants, isProtected, type DeathCause, type GameState, type Plant, type Room } from '../state.ts';

export type GrowthEvent =
  | { type: 'germs_ready'; count: number }
  | { type: 'germs_died'; count: number }
  | { type: 'stage_changed'; plantId: number; to: 'flo' | 'drying' }
  | { type: 'plant_died'; plantId: number; cause: DeathCause }
  | { type: 'aphids'; plantId: number }
  | { type: 'drying_done'; plantId: number };

/** Capacité totale (en plants) du matériel possédé, par type. */
export function equipmentCapacity(state: GameState): Record<EquipmentKind, number> {
  const capacity: Record<EquipmentKind, number> = { lamp: 0, heater: 0, fan: 0 };
  for (const id of EQUIPMENT_IDS) {
    const item = EQUIPMENT[id];
    capacity[item.kind] += item.capacity * state.inventory.equipment[id];
  }
  return capacity;
}

/**
 * Facteur de croissance lié au matériel, dans [0, 1].
 * Sans lampes rien ne pousse ; radiateurs et ventilateurs manquants ralentissent.
 */
export function equipmentFactor(state: GameState): number {
  const plants = growingPlants(state).length;
  if (plants === 0) return 1;
  const cap = equipmentCapacity(state);
  const cover = (c: number) => Math.min(1, c / plants);
  const { heaterWeight, fanWeight } = BALANCE.equipment;
  return cover(cap.lamp) * (1 - heaterWeight * (1 - cover(cap.heater)) - fanWeight * (1 - cover(cap.fan)));
}

/** Facteur de croissance lié à l'éclairage de la salle, dans [0, 1]. */
export function lightFactor(state: GameState, room: Room): number {
  const hours = state.lightHours[room];
  if (hours <= 0) return 0;
  const gap = Math.abs(hours - BALANCE.stages[room].targetLightHours);
  return Math.max(0, 1 - BALANCE.lightPenaltyPerHour * gap);
}

function kill(state: GameState, plant: Plant, cause: DeathCause, at: number, events: GrowthEvent[]): void {
  if (plant.stage === 'veg' || plant.stage === 'flo') plant.diedIn = plant.stage;
  plant.stage = 'dead';
  plant.deathCause = cause;
  events.push({ type: 'plant_died', plantId: plant.id, cause });
  addLog(state, at, 'plant_died', { plantId: plant.id, variety: plant.variety, cause });
}

/** Fixe la récolte d'un plant qui entre en séchage. */
function computeHarvest(state: GameState, plant: Plant): void {
  const y = BALANCE.yield;
  const conditions = plant.growthHours > 0 ? plant.conditionSum / plant.growthHours : 1;
  const quality = conditions * POTS[plant.potSize].yieldFactor;
  if (plant.sex === 'male') {
    plant.harvestGrams = Math.round(y.maleGrams * quality);
    plant.harvestSeeds = 0;
    return;
  }
  const fullGrams = (y.femaleGrams + randomBetween(state, -y.femaleVarianceGrams, y.femaleVarianceGrams)) * quality;
  const pollination = Math.min(1, plant.pollinationHours / y.fullPollinationHours);
  plant.harvestGrams = Math.round(fullGrams + (y.pollinatedFemaleGrams - fullGrams) * pollination);
  plant.harvestSeeds = Math.round(y.maxSeeds * pollination);
}

function tickGerms(state: GameState, at: number, events: GrowthEvent[]): void {
  const g = BALANCE.germination;
  let newlyReady = 0;
  let died = 0;
  for (const germ of state.germs) {
    if (germ.dead) continue;
    const wasReady = germ.height >= g.plantableHeight;
    germ.height = Math.min(g.maxHeight, germ.height + g.cmPerHour * germ.devIndex * BALANCE.gameSpeed);
    if (!wasReady && germ.height >= g.plantableHeight) newlyReady++;
    if (germHoursLeft(germ, at) <= 0) {
      germ.dead = true;
      died++;
    }
  }
  if (newlyReady > 0) events.push({ type: 'germs_ready', count: newlyReady });
  if (died > 0) {
    events.push({ type: 'germs_died', count: died });
    addLog(state, at, 'germs_died', { count: died });
  }
}

function tickGrowingPlant(state: GameState, plant: Plant, equipFactor: number, at: number, events: GrowthEvent[]): void {
  if (plant.frozen || (plant.stage !== 'veg' && plant.stage !== 'flo')) return;
  const room: Room = plant.stage;
  const stage = BALANCE.stages[room];
  const speed = BALANCE.gameSpeed;

  plant.waterCl = Math.max(0, plant.waterCl - stage.waterPerHourCl * speed);
  plant.fertMl = Math.max(0, plant.fertMl - stage.fertPerHourMl * speed);
  if (plant.waterCl <= 0) return kill(state, plant, 'thirst', at, events);
  if (plant.fertMl <= 0) return kill(state, plant, 'starvation', at, events);

  if (plant.overdosed) {
    plant.overdoseHours++;
    if (plant.overdoseHours >= BALANCE.overdoseGraceHours) kill(state, plant, 'overdose', at, events);
    return;
  }

  const conditions = equipFactor * lightFactor(state, room);
  const aphidFactor = plant.infested ? BALANCE.aphids.growthFactor : 1;
  plant.height += stage.cmPerHour * plant.devIndex * conditions * aphidFactor * speed;
  plant.conditionSum += conditions;
  plant.growthHours++;

  if (!isProtected(plant) && !plant.infested && chance(state, BALANCE.aphids.chancePerHour)) {
    plant.infested = true;
    events.push({ type: 'aphids', plantId: plant.id });
  }
  if (room === 'flo') plant.floProtectionHours = Math.max(0, plant.floProtectionHours - speed);

  if (plant.height >= stage.endHeight) {
    if (room === 'veg') {
      // La floraison consomme 3× plus : on convertit les réserves pour garder la même autonomie
      // en heures, sinon un plant arrosé la veille mourrait avant la session suivante.
      const flo = BALANCE.stages.flo;
      plant.waterCl *= flo.waterPerHourCl / stage.waterPerHourCl;
      plant.fertMl *= flo.fertPerHourMl / stage.fertPerHourMl;
      plant.stage = 'flo';
      events.push({ type: 'stage_changed', plantId: plant.id, to: 'flo' });
    } else {
      plant.stage = 'drying';
      plant.dryingHoursLeft = randomInt(state, BALANCE.drying.minHours, BALANCE.drying.maxHours);
      computeHarvest(state, plant);
      events.push({ type: 'stage_changed', plantId: plant.id, to: 'drying' });
    }
  }
}

/** Les mâles matures en floraison (même gelés) pollinisent toutes les femelles en floraison. */
function tickPollination(state: GameState): void {
  const pollinating = state.plants.some(
    (p) => p.stage === 'flo' && p.sex === 'male' && p.height >= BALANCE.yield.malePollinationHeight,
  );
  if (!pollinating) return;
  for (const plant of state.plants) {
    if (plant.stage === 'flo' && plant.sex === 'female' && !plant.frozen) plant.pollinationHours += BALANCE.gameSpeed;
  }
}

function tickDrying(state: GameState, at: number, events: GrowthEvent[]): void {
  for (const plant of state.plants) {
    if (plant.stage !== 'drying') continue;
    plant.dryingHoursLeft -= BALANCE.gameSpeed;
    if (plant.dryingHoursLeft <= 0) {
      plant.dryingHoursLeft = 0;
      plant.stage = 'dry';
      events.push({ type: 'drying_done', plantId: plant.id });
      addLog(state, at, 'drying_done', { plantId: plant.id, variety: plant.variety, grams: plant.harvestGrams });
    }
  }
}

/** Une actualisation horaire de la culture. Modifie `state` en place. */
export function tickGrowth(state: GameState, at: number): GrowthEvent[] {
  const events: GrowthEvent[] = [];
  tickDrying(state, at, events);
  tickGerms(state, at, events);
  // Le facteur matériel est calculé une fois pour l'heure, avant les changements de salle.
  const equipFactor = equipmentFactor(state);
  for (const plant of state.plants) tickGrowingPlant(state, plant, equipFactor, at, events);
  tickPollination(state);
  return events;
}
