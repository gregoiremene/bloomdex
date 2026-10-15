import { describe, expect, it } from 'vitest';
import { addPlant, equippedGame, hoursLater, plantById, T0 } from '../test-utils.ts';
import {
  clearDead,
  discardMales,
  fillToMax,
  harvest,
  plantFastestGerms,
  plantGerms,
  repot,
  setLightHours,
  sowSeeds,
  treatPlants,
  waterPlants,
} from './culture.ts';

describe('germination', () => {
  it('place des graines dans la limite des kits (15 par kit)', () => {
    const state = equippedGame(3); // 2 kits → 30 places
    const sown = sowSeeds(state, 'super_skunk', 30, T0);
    expect(sown.germs).toHaveLength(30);
    expect(sown.inventory.seeds.super_skunk).toBe(70);
    expect(() => sowSeeds(sown, 'super_skunk', 1, T0)).toThrow('GERMINATION_FULL');
  });

  it('refuse sans graines', () => {
    expect(() => sowSeeds(equippedGame(), 'crystal', 1, T0)).toThrow('INSUFFICIENT_SEEDS');
  });

  it('un germe moyen atteint 10 cm en 24 h', () => {
    const sown = sowSeeds(equippedGame(), 'super_skunk', 1, T0);
    sown.germs[0]!.devIndex = 1;
    expect(hoursLater(sown, 23).germs[0]!.height).toBeLessThan(10);
    expect(hoursLater(sown, 24).germs[0]!.height).toBeCloseTo(10);
  });

  it('ne plante que des germes prêts', () => {
    const sown = sowSeeds(equippedGame(), 'super_skunk', 1, T0);
    expect(() => plantGerms(sown, [sown.germs[0]!.id], 40, T0)).toThrow('GERM_NOT_READY');
  });

  it('plante les germes les plus rapides en consommant pots et terreau', () => {
    const grown = hoursLater(sowSeeds(equippedGame(3), 'super_skunk', 10, T0), 36);
    // Les germes plafonnent à 15 cm : à taille égale, l'indice de développement départage.
    const fastest = [...grown.germs].sort((a, b) => b.height - a.height || b.devIndex - a.devIndex).slice(0, 3);
    const planted = plantFastestGerms(grown, 3, 40, T0);
    expect(planted.plants.map((p) => p.id).sort()).toEqual(fastest.map((g) => g.id).sort());
    expect(planted.germs).toHaveLength(7);
    expect(planted.inventory.pots[40]).toBe(97);
    expect(planted.inventory.soilL).toBe(1_000 - 3 * 6);
    expect(planted.plants.every((p) => p.stage === 'veg')).toBe(true);
  });

  it("respecte la capacité de l'habitation", () => {
    const grown = hoursLater(sowSeeds(equippedGame(), 'super_skunk', 5, T0), 36);
    grown.housing = 'chambre';
    expect(() => plantFastestGerms(grown, 4, 40, T0)).toThrow('HOUSING_FULL');
  });
});

describe('arrosage', () => {
  it("fillToMax remplit au maximum de la salle et consomme l'engrais de la salle", () => {
    const state = equippedGame();
    const veg = addPlant(state, { waterCl: 1, fertMl: 2 });
    const flo = addPlant(state, { stage: 'flo', height: 80 });
    const filled = fillToMax(state, 'all');
    expect(plantById(filled, veg.id)).toMatchObject({ waterCl: 5, fertMl: 5, overdosed: false });
    expect(plantById(filled, flo.id)).toMatchObject({ waterCl: 15, fertMl: 15, overdosed: false });
    expect(filled.inventory.fertVegMl).toBe(10_000 - 3);
    expect(filled.inventory.fertFloMl).toBe(10_000 - 15);
    expect(filled.meters.waterCl).toBe(4 + 15);
  });

  it('dépasser le maximum surdose le plant', () => {
    const state = equippedGame();
    const plant = addPlant(state);
    const watered = waterPlants(state, [plant.id], { waterCl: 6, fertMl: 5 });
    expect(plantById(watered, plant.id).overdosed).toBe(true);
  });

  it("refuse si l'engrais manque, sans rien modifier", () => {
    const state = equippedGame();
    state.inventory.fertVegMl = 3;
    addPlant(state);
    expect(() => fillToMax(state, 'all')).toThrow('INSUFFICIENT_FERTILIZER');
    expect(state.plants[0]!.waterCl).toBe(0);
  });
});

describe('soins', () => {
  it('le rempotage sauve un plant surdosé', () => {
    const state = equippedGame();
    const plant = addPlant(state);
    let s = waterPlants(state, [plant.id], { waterCl: 8, fertMl: 5 });
    s = repot(s, [plant.id], T0);
    expect(plantById(s, plant.id)).toMatchObject({ overdosed: false, waterCl: 0, fertMl: 0 });
    expect(s.inventory.pots[40]).toBe(99);
    s = hoursLater(fillToMax(s, 'all'), 10);
    expect(plantById(s, plant.id).stage).toBe('veg');
  });

  it("refuse de rempoter un plant qui n'est pas surdosé", () => {
    const state = equippedGame();
    const plant = addPlant(state);
    expect(() => repot(state, [plant.id], T0)).toThrow('PLANT_NOT_OVERDOSED');
  });

  it("le traitement protège le stade en cours, guérit, et coûte 4 ml par plant", () => {
    const state = equippedGame();
    const plant = addPlant(state, { protectedVeg: false, infested: true });
    addPlant(state); // déjà protégé : ne consomme rien
    const treated = treatPlants(state, 'all');
    expect(plantById(treated, plant.id)).toMatchObject({ protectedVeg: true, infested: false });
    expect(treated.inventory.insecticideMl).toBe(1_000 - 4);
  });

  it("l'éclairage doit être entre 0 et 24 h", () => {
    expect(setLightHours(equippedGame(), 'veg', 20).lightHours.veg).toBe(20);
    expect(() => setLightHours(equippedGame(), 'flo', 25)).toThrow('INVALID_LIGHT_HOURS');
  });
});

describe('tri et récolte', () => {
  it('jette les mâles identifiés en floraison uniquement', () => {
    const state = equippedGame();
    addPlant(state, { sex: 'male' }); // végétation : sexe encore inconnu
    addPlant(state, { stage: 'flo', sex: 'male' });
    addPlant(state, { stage: 'flo', sex: 'female' });
    const sorted = discardMales(state);
    expect(sorted.plants.map((p) => [p.stage, p.sex])).toEqual([
      ['veg', 'male'],
      ['flo', 'female'],
    ]);
  });

  it('retire les plants morts', () => {
    const state = equippedGame();
    addPlant(state, { stage: 'dead', deathCause: 'thirst' });
    addPlant(state);
    expect(clearDead(state).plants).toHaveLength(1);
  });

  it('récolte beuh et graines des plants secs', () => {
    const state = equippedGame();
    addPlant(state, { stage: 'dry', harvestGrams: 140, harvestSeeds: 0 });
    addPlant(state, { stage: 'dry', harvestGrams: 17, harvestSeeds: 98 });
    addPlant(state, { stage: 'drying', harvestGrams: 140 });
    const harvested = harvest(state, T0);
    expect(harvested.stock.super_skunk).toBe(state.stock.super_skunk + 157);
    expect(harvested.inventory.seeds.super_skunk).toBe(100 + 98);
    expect(harvested.plants.map((p) => p.stage)).toEqual(['drying']);
    expect(harvested.log[0]).toMatchObject({ type: 'harvest', data: { plants: 2, grams: 157, seeds: 98 } });
  });
});
