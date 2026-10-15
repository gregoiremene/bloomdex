import { describe, expect, it } from 'vitest';
import { advance } from '../advance.ts';
import { discardMales, fillToMax, germinationCapacity, plantFastestGerms, plantGerms, sowSeeds, treatPlants, waterPlants } from '../actions/culture.ts';
import { BALANCE } from '../data/balance.ts';
import { HOUR_MS, isProtected, type GameState } from '../state.ts';
import { addPlant, equippedGame, hoursLater, plantById, T0 } from '../test-utils.ts';
import { equipmentFactor, lightFactor } from './growth.ts';

describe('eau et engrais', () => {
  it("un plant planté sans arrosage meurt à l'actualisation suivante", () => {
    const state = equippedGame();
    const plant = addPlant(state);
    const after = advance(state, T0 + HOUR_MS);
    expect(plantById(after.state, plant.id)).toMatchObject({ stage: 'dead', deathCause: 'thirst' });
    expect(after.events).toContainEqual(expect.objectContaining({ type: 'plant_died', plantId: plant.id }));
  });

  it('un plein tient 12 h sans risque, et le plant meurt de soif au bout de 20 h', () => {
    for (const room of ['veg', 'flo'] as const) {
      const state = equippedGame();
      const plant = addPlant(state, { stage: room, height: room === 'veg' ? 10 : 70 });
      const watered = fillToMax(state, 'all');
      expect(plantById(hoursLater(watered, 12), plant.id).stage).toBe(room);
      expect(plantById(hoursLater(watered, 19), plant.id).stage).toBe(room);
      expect(plantById(hoursLater(watered, 20), plant.id).stage).toBe('dead');
    }
  });

  it("sans engrais le plant meurt aussi", () => {
    const state = equippedGame();
    const plant = addPlant(state);
    const watered = waterPlants(state, 'all', { waterCl: 5, fertMl: 0 });
    expect(plantById(hoursLater(watered, 1), plant.id)).toMatchObject({ stage: 'dead', deathCause: 'starvation' });
  });

  it("un plant surdosé arrête de pousser et meurt après 6 h s'il n'est pas rempoté", () => {
    const state = equippedGame();
    const plant = addPlant(state);
    const watered = waterPlants(state, 'all', { waterCl: 7, fertMl: 5 });
    const after5 = plantById(hoursLater(watered, 5), plant.id);
    expect(after5.stage).toBe('veg');
    expect(after5.height).toBe(10);
    expect(plantById(hoursLater(watered, 6), plant.id)).toMatchObject({ stage: 'dead', deathCause: 'overdose' });
  });

  it('un plant gelé ne pousse pas et ne consomme rien', () => {
    const state = equippedGame();
    const plant = addPlant(state, { waterCl: 5, fertMl: 5, frozen: true });
    const later = plantById(hoursLater(state, 48), plant.id);
    expect(later).toMatchObject({ stage: 'veg', height: 10, waterCl: 5, fertMl: 5 });
  });
});

describe('croissance', () => {
  it('un plant moyen bien équipé passe en floraison au bout de 48 h de végétation', () => {
    const state = equippedGame();
    const plant = addPlant(state, { waterCl: 5, fertMl: 5 });
    // Arrosage toutes les 12 h pour survivre.
    let s = state;
    for (let i = 0; i < 4; i++) s = fillToMax(hoursLater(s, 12), 'all');
    const result = plantById(s, plant.id);
    expect(result.stage).toBe('flo');
    expect(result.height).toBeCloseTo(70);
  });

  it("au passage en floraison, les réserves gardent la même autonomie en heures", () => {
    const state = equippedGame();
    const plant = addPlant(state, { height: 69.5, waterCl: 2, fertMl: 2 });
    const flo = plantById(hoursLater(state, 1), plant.id);
    expect(flo.stage).toBe('flo');
    // 1,75 cl restants à 0,25 cl/h = 7 h → 5,25 cl à 0,75 cl/h = 7 h.
    expect(flo.waterCl).toBeCloseTo(5.25);
    expect(flo.fertMl).toBeCloseTo(5.25);
  });

  it("sans lumière rien ne pousse (mais le plant consomme)", () => {
    const state = equippedGame();
    state.lightHours.veg = 0;
    const plant = addPlant(state, { waterCl: 5, fertMl: 5 });
    const later = plantById(hoursLater(state, 5), plant.id);
    expect(later.height).toBe(10);
    expect(later.waterCl).toBeCloseTo(3.75);
  });

  it("un éclairage éloigné de la cible ralentit la pousse", () => {
    const state = equippedGame();
    expect(lightFactor(state, 'veg')).toBe(1);
    state.lightHours.veg = 14;
    expect(lightFactor(state, 'veg')).toBeCloseTo(0.6);
  });

  it('le matériel insuffisant ralentit, sans lampe rien ne pousse', () => {
    const state = equippedGame(3);
    for (let i = 0; i < 6; i++) addPlant(state); // 6 plants pour 15 places de matériel
    expect(equipmentFactor(state)).toBe(1);
    state.inventory.equipment.heater_15 = 0;
    state.inventory.equipment.fan_15 = 0;
    expect(equipmentFactor(state)).toBeCloseTo(0.5);
    state.inventory.equipment.lamp_1000 = 0;
    state.inventory.equipment.lamp_250 = 1; // couvre 3 plants sur 6
    expect(equipmentFactor(state)).toBeCloseTo(0.25);
    state.inventory.equipment.lamp_250 = 0;
    expect(equipmentFactor(state)).toBe(0);
  });

  it("les pucerons n'attaquent que les plants non protégés", () => {
    const state = equippedGame(30);
    for (let i = 0; i < 20; i++) addPlant(state, { waterCl: 5, fertMl: 5, protectedVeg: false });
    for (let i = 0; i < 20; i++) addPlant(state, { waterCl: 5, fertMl: 5 });
    const later = hoursLater(state, 15);
    const infested = later.plants.filter((p) => p.infested);
    expect(infested.length).toBeGreaterThan(0);
    expect(infested.every((p) => !p.protectedVeg)).toBe(true);
  });

  it('en floraison, la protection dure 36 à 60 h puis s’use', () => {
    const state = equippedGame(30);
    for (let i = 0; i < 20; i++) addPlant(state, { stage: 'flo', height: 70, floProtectionHours: 0 });
    const treated = treatPlants(state, 'all');
    const hours = treated.plants.map((p) => p.floProtectionHours);
    expect(hours.every((h) => h >= 36 && h <= 60)).toBe(true);
    expect(new Set(hours).size).toBeGreaterThan(1);

    const watered = fillToMax(treated, 'all');
    expect(hoursLater(watered, 12).plants.every((p) => isProtected(p))).toBe(true);
    const later = hoursLater(fillToMax(hoursLater(fillToMax(hoursLater(watered, 12), 'all'), 12), 'all'), 12);
    // 36 h écoulées : chaque plant a perdu 36 h de protection, certains ne sont plus protégés.
    expect(later.plants.every((p, i) => p.floProtectionHours === Math.max(0, hours[i]! - 36))).toBe(true);
    const at60 = hoursLater(fillToMax(hoursLater(fillToMax(later, 'all'), 12), 'all'), 12);
    expect(at60.plants.some((p) => !isProtected(p))).toBe(true);
    expect(at60.plants.filter((p) => p.stage === 'flo').every((p) => !isProtected(p))).toBe(true);
  });

  it('en végétation, un seul traitement protège jusqu’à la fin du stade', () => {
    const state = equippedGame();
    const plant = addPlant(state, { protectedVeg: false, floProtectionHours: 0 });
    const treated = fillToMax(treatPlants(state, 'all'), 'all');
    const later = hoursLater(fillToMax(hoursLater(treated, 12), 'all'), 12);
    expect(plantById(later, plant.id)).toMatchObject({ stage: 'veg', protectedVeg: true });
    expect(isProtected(plantById(later, plant.id))).toBe(true);
  });
});

describe('floraison, pollinisation et séchage', () => {
  function flowerRoom(withMale: boolean): { state: GameState; femaleId: number } {
    const state = equippedGame();
    const female = addPlant(state, { stage: 'flo', height: 100, waterCl: 15, fertMl: 15 });
    if (withMale) addPlant(state, { stage: 'flo', height: 100, sex: 'male', waterCl: 15, fertMl: 15 });
    return { state, femaleId: female.id };
  }

  function growUntilDry(state: GameState): GameState {
    let s = state;
    for (let i = 0; i < 20 && s.plants.some((p) => p.stage !== 'dry' && p.stage !== 'dead'); i++) {
      s = fillToMax(hoursLater(s, 6), 'all');
    }
    return s;
  }

  it('une femelle seule donne ~140 g et aucune graine', () => {
    const { state, femaleId } = flowerRoom(false);
    const female = plantById(growUntilDry(state), femaleId);
    expect(female.stage).toBe('dry');
    expect(female.harvestGrams).toBeGreaterThanOrEqual(130);
    expect(female.harvestGrams).toBeLessThanOrEqual(150);
    expect(female.harvestSeeds).toBe(0);
  });

  it('un mâle mature pollinise : moins de beuh, des graines', () => {
    const { state, femaleId } = flowerRoom(true);
    const female = plantById(growUntilDry(state), femaleId);
    expect(female.pollinationHours).toBeGreaterThan(0);
    expect(female.harvestSeeds).toBeGreaterThan(0);
    expect(female.harvestGrams).toBeLessThan(130);
  });

  it('jeter les mâles à temps évite la pollinisation', () => {
    const { state, femaleId } = flowerRoom(true);
    const female = plantById(growUntilDry(discardMales(state)), femaleId);
    expect(female.harvestSeeds).toBe(0);
  });

  it('le séchage dure 7 à 8 h puis le plant est récoltable', () => {
    const state = equippedGame();
    const plant = addPlant(state, { stage: 'flo', height: 159.5, waterCl: 15, fertMl: 15 });
    const drying = hoursLater(state, 1);
    expect(plantById(drying, plant.id).stage).toBe('drying');
    const hours = plantById(drying, plant.id).dryingHoursLeft;
    expect(hours).toBeGreaterThanOrEqual(7);
    expect(hours).toBeLessThanOrEqual(8);
    const done = advance(drying, drying.lastTickAt + hours * HOUR_MS);
    expect(plantById(done.state, plant.id).stage).toBe('dry');
    expect(done.events).toContainEqual(expect.objectContaining({ type: 'drying_done', plantId: plant.id }));
  });
});

describe('cycle complet', () => {
  it('de la graine à la récolte en environ une semaine, avec deux sessions par jour', () => {
    let s = sowSeeds(equippedGame(3), 'super_skunk', 15, T0);
    s = hoursLater(s, 36);
    s = plantFastestGerms(s, 3, 40, s.lastTickAt);
    let hours = 36;
    // Routine du joueur : matin et soir, remplir, traiter, jeter les mâles.
    while (s.plants.some((p) => p.stage !== 'dry' && p.stage !== 'dead') && hours < 14 * 24) {
      s = discardMales(treatPlants(fillToMax(s, 'all'), 'all'));
      s = hoursLater(s, 12);
      hours += 12;
    }
    expect(s.plants.filter((p) => p.stage === 'dead')).toHaveLength(0);
    expect(s.plants.length).toBeGreaterThan(0);
    expect(s.plants.every((p) => p.stage === 'dry')).toBe(true);
    expect(hours / 24).toBeGreaterThanOrEqual(4.5);
    expect(hours / 24).toBeLessThanOrEqual(8);
  });
});

describe('germination', () => {
  it('un germe meurt faute de place au bout de sa durée de vie, même petit, et ne peut plus être planté', () => {
    const state = sowSeeds(equippedGame(), 'super_skunk', 3, T0);
    state.germs[0]!.devIndex = 1.3;
    state.germs[1]!.devIndex = 1;
    state.germs[2]!.devIndex = 0.5; // très lent : n'atteint jamais 15 cm à temps
    const { lifespanHours } = BALANCE.germination;
    const almost = advance(state, T0 + (lifespanHours - 1) * HOUR_MS);
    expect(almost.state.germs.every((germ) => !germ.dead)).toBe(true);
    const later = advance(state, T0 + lifespanHours * HOUR_MS);
    expect(later.state.germs.every((germ) => germ.dead)).toBe(true);
    expect(later.state.germs[2]!.height).toBeLessThan(BALANCE.germination.maxHeight);
    expect(later.events).toContainEqual(expect.objectContaining({ type: 'germs_died', count: 3 }));
    expect(() => plantGerms(later.state, [later.state.germs[0]!.id], 40, T0)).toThrow('GERM_DEAD');
    expect(() => plantFastestGerms(later.state, 1, 40, T0)).toThrow('NOT_ENOUGH_READY_GERMS');
    // Les germes morts occupent le kit jusqu'à ce qu'on les jette.
    const free = germinationCapacity(later.state) - 3;
    expect(() => sowSeeds(later.state, 'super_skunk', free + 1, T0)).toThrow('GERMINATION_FULL');
  });
});

describe('mort des plants', () => {
  it('retient la salle où le plant est mort', () => {
    const state = equippedGame();
    const veg = addPlant(state);
    const flo = addPlant(state, { stage: 'flo', height: 70 });
    const after = advance(state, T0 + HOUR_MS).state;
    expect(plantById(after, veg.id)).toMatchObject({ stage: 'dead', diedIn: 'veg' });
    expect(plantById(after, flo.id)).toMatchObject({ stage: 'dead', diedIn: 'flo' });
  });
});
