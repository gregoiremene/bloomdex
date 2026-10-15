/**
 * Variétés de beuh. Toutes poussent à la même vitesse et produisent le même poids ; leur prix de
 * revente change chaque semaine (voir `market.priceLadder`). Seul le prix des graines est propre à
 * chaque variété (calibré sur l'instantané du jeu d'origine, docs/weedland-reference.md §5).
 */

export const VARIETY_IDS = [
  'jack_herer',
  'big_bud',
  'shiva_shanti',
  'super_skunk',
  'marleys_collie',
  'blueberry',
  'aurora_indica',
  'white_widow',
  'early_girl',
  'ak48',
  'crystal',
  'afghane',
  'tibetaine',
  'marocaine',
] as const;

export type VarietyId = (typeof VARIETY_IDS)[number];

export interface Variety {
  id: VarietyId;
  name: string;
  /** Prix d'un paquet de graines en boutique. */
  seedPackPrice: number;
  /** Cultivable en extérieur (V1). */
  outdoor: boolean;
}

export const VARIETIES: Record<VarietyId, Variety> = {
  jack_herer: { id: 'jack_herer', name: 'Jack Herer', seedPackPrice: 150, outdoor: true },
  big_bud: { id: 'big_bud', name: 'Big Bud', seedPackPrice: 88, outdoor: true },
  shiva_shanti: { id: 'shiva_shanti', name: 'Shiva Shanti', seedPackPrice: 33, outdoor: true },
  super_skunk: { id: 'super_skunk', name: 'Super Skunk', seedPackPrice: 44, outdoor: true },
  marleys_collie: { id: 'marleys_collie', name: "Marley's Collie", seedPackPrice: 120, outdoor: true },
  blueberry: { id: 'blueberry', name: 'Blueberry', seedPackPrice: 150, outdoor: false },
  aurora_indica: { id: 'aurora_indica', name: 'Aurora Indica', seedPackPrice: 45, outdoor: true },
  white_widow: { id: 'white_widow', name: 'White Widow', seedPackPrice: 140, outdoor: true },
  early_girl: { id: 'early_girl', name: 'Early Girl', seedPackPrice: 89, outdoor: true },
  ak48: { id: 'ak48', name: 'AK48', seedPackPrice: 115, outdoor: true },
  crystal: { id: 'crystal', name: 'Crystal', seedPackPrice: 200, outdoor: false },
  afghane: { id: 'afghane', name: 'Afghane', seedPackPrice: 135, outdoor: true },
  tibetaine: { id: 'tibetaine', name: 'Tibetaine', seedPackPrice: 130, outdoor: true },
  marocaine: { id: 'marocaine', name: 'Marocaine', seedPackPrice: 135, outdoor: true },
};

export const SEEDS_PER_PACK = 15;
