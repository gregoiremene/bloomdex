import type { VarietyId } from './varieties.ts';

/**
 * Toutes les constantes d'équilibrage du moteur.
 *
 * Calibrage visé (GAME_SPEED = 1, germe d'indice de développement 1, bonnes conditions) :
 * germination ~24 h + végétation ~48 h + floraison ~84 h + séchage 7-8 h ≈ 6,8 jours.
 * Eau/engrais : un plein tient ~20 h, donc deux sessions par jour (~12 h d'écart) suffisent.
 */
export const BALANCE = {
  /** Multiplicateur global du temps de jeu (1 = cycle d'environ une semaine). */
  gameSpeed: 1,

  start: {
    money: 2_000,
    /** Stock offert au départ pour pouvoir vendre dès le premier jour. */
    stock: { variety: 'jack_herer' as VarietyId, grams: 150 },
    lightHours: { veg: 18, flo: 12 },
  },

  germination: {
    /** Graines par kit de germination. */
    seedsPerKit: 15,
    /** Croissance d'un germe d'indice 1 (atteint 10 cm en 24 h). */
    cmPerHour: 10 / 24,
    plantableHeight: 10,
    maxHeight: 15,
    /**
     * Durée de vie dans le kit, depuis le semis : au-delà, le germe meurt faute de place, quelle que
     * soit sa taille. Germe rapide (indice 1,3) prêt en ~18 h → ~30 h pour le planter ; lent (0,7) → ~14 h.
     */
    lifespanHours: 48,
    /** Le germe est signalé « à l'étroit » pendant ses dernières heures de vie. */
    crampedWarningHours: 12,
    /** Indice de développement aléatoire d'un germe (multiplie toute sa croissance). */
    devIndexMin: 0.7,
    devIndexMax: 1.3,
  },

  stages: {
    veg: {
      cmPerHour: 1.25,
      /** Passage automatique en floraison. */
      endHeight: 70,
      waterMaxCl: 5,
      fertMaxMl: 5,
      waterPerHourCl: 0.25,
      fertPerHourMl: 0.25,
      targetLightHours: 18,
    },
    flo: {
      cmPerHour: 90 / 84,
      /** Passage automatique en séchage. */
      endHeight: 160,
      waterMaxCl: 15,
      fertMaxMl: 15,
      waterPerHourCl: 0.75,
      fertPerHourMl: 0.75,
      targetLightHours: 12,
    },
  },

  drying: { minHours: 7, maxHours: 8 },

  /** Un plant surdosé arrête de pousser et meurt après ce délai s'il n'est pas rempoté. */
  overdoseGraceHours: 6,

  /** Perte de croissance par heure d'écart avec l'éclairage cible de la salle. */
  lightPenaltyPerHour: 0.1,

  /**
   * Couverture du matériel : sans lampes rien ne pousse ; radiateurs et ventilateurs
   * manquants retirent chacun jusqu'à ce poids du facteur de croissance.
   */
  equipment: { heaterWeight: 0.25, fanWeight: 0.25 },

  aphids: {
    chancePerHour: 0.01,
    growthFactor: 0.5,
    insecticidePerTreatmentMl: 4,
    /**
     * Végé : un traitement protège jusqu'à la fin du stade. Flo : la protection s'use au bout
     * d'une durée tirée au hasard à chaque traitement (≈ 2 traitements sur les ~84 h de flo).
     * Volontairement non affichée au joueur : il apprend le rythme en jouant.
     */
    floProtectionHours: { min: 36, max: 60 },
  },

  sex: { maleChance: 0.25 },

  yield: {
    femaleGrams: 140,
    /** Écart aléatoire ± sur le poids d'une femelle. */
    femaleVarianceGrams: 10,
    maleGrams: 17,
    /** Une femelle totalement pollinisée ne donne plus que ce poids… */
    pollinatedFemaleGrams: 17,
    /** … et ce nombre de graines. */
    maxSeeds: 98,
    /** Heures d'exposition à un mâle mature pour une pollinisation complète. */
    fullPollinationHours: 60,
    /** Un mâle pollinise à partir de cette taille (même gelé). */
    malePollinationHeight: 100,
  },

  market: {
    /** Les prix de revente sont réévalués toutes les 6 semaines (périodes alignées sur un lundi 00h UTC). */
    repricePeriodHours: 6 * 168,
    /**
     * Prix de revente (Wl/g) redistribués au hasard entre les variétés à chaque période :
     * toujours 2 variétés à 7, mais jamais les mêmes d'office. Une valeur par variété.
     * Sur la durée, toutes les variétés se valent (elles poussent et pèsent pareil).
     */
    priceLadder: [7, 7, 6, 6, 5, 5, 5, 4, 4, 4, 3, 3, 2, 2],
    /**
     * Saturation par joueur : plus il vend d'une même variété pendant la période, plus son prix baisse
     * (−10 % tous les `gramsPerTenPercent`, sans descendre sous `floor` × le prix). Pousse à diversifier
     * au lieu de ne planter que les variétés les mieux payées. Compteur remis à zéro à chaque période.
     */
    saturation: { gramsPerTenPercent: 3_000, floor: 0.5 },
    /** Graine fixe du marché : tous les joueurs voient les mêmes prix. */
    seed: 20_260_930,
  },

  police: {
    /**
     * Indice gagné par heure = grammes vendus × risque (%) × ce facteur.
     * Calibré sur l'original : 158 g/h à 0,75 % → +11,85/h.
     */
    indexPerGramRisk: 0.1,
    /** Baisse horaire sans vente en cours, en % de l'indice max de l'habitation. */
    decayPercentOfMaxPerHour: 2.5,
    /** Amende lors d'une descente des stups = indice × ce montant. */
    raidFinePerIndex: 30,
    /** Le commissaire corrompu remet l'indice à 0 pour indice × ce montant. */
    bribePerIndex: 20,
  },

  economy: {
    /** Impôts, salaire et intérêts tombent le lundi à cette heure (heure du jeu). */
    weeklyWeekday: 1,
    weeklyHour: 4,
    electricityPerKwh: 0.8,
    waterPerCl: 0.09,
    /** ISF : taux appliqué à la part de la bourse au-dessus du seuil. */
    wealthTaxThreshold: 15_000,
    wealthTaxRate: 0.06,
  },

  /** Livret unique de la V0. */
  bank: {
    weeklyInterestRate: 0.015,
    withdrawalFeeRate: 0.025,
    cap: 25_000_000,
  },

  security: {
    guardHireCost: 500,
    guardWeeklyCost: 200,
    guardFireCost: 1_250,
  },

  theft: {
    costPerThief: 3_000,
    attacksPerDay: 3,
    /** La victime doit posséder au moins cette habitation (en dessous : inattaquable). */
    minVictimHousingLevel: 3,
    /** Part maximale de la bourse (argent et beuh) volée en cas de réussite. */
    maxStealFraction: 0.1,
    minStealFraction: 0.05,
    detectiveCost: 250,
  },

  log: { maxEntries: 50 },

  /** Outils réservés aux admins (tests en conditions réelles). */
  admin: { maxRewindHours: 48 },
} as const;
