import type { PlaceId } from '@weedapp/engine';

/** Logos des tuiles (emoji en attendant une vraie DA). */
export const PLACE_ICON: Record<PlaceId, string> = {
  college: '🏫',
  lycee: '🎒',
  universite: '🎓',
  boite_de_nuit: '🪩',
  fete_foraine: '🎡',
  cage_escalier: '🏢',
  rave_party: '🔊',
  disney_village: '🎢',
  plage: '🏖️',
  parc: '🌳',
  place_du_village: '⛲',
  gare: '🚉',
};

export const SHOP_ICON = {
  seeds: '🌰',
  soil: '🟫',
  fertilizer: '🧪',
  insecticide: '🐞',
  germKit: '🧫',
  lamp: '💡',
  heater: '🔥',
  fan: '🌀',
  pot: '🪴',
} as const;
