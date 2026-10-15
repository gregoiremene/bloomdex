export type GameErrorCode =
  | 'INVALID_QUANTITY'
  | 'UNKNOWN_ITEM'
  | 'INSUFFICIENT_FUNDS'
  | 'INSUFFICIENT_SEEDS'
  | 'GERMINATION_FULL'
  | 'GERM_NOT_FOUND'
  | 'GERM_NOT_READY'
  | 'GERM_DEAD'
  | 'NOT_ENOUGH_READY_GERMS'
  | 'HOUSING_FULL'
  | 'INSUFFICIENT_POTS'
  | 'INSUFFICIENT_SOIL'
  | 'INSUFFICIENT_FERTILIZER'
  | 'INSUFFICIENT_INSECTICIDE'
  | 'PLANT_NOT_FOUND'
  | 'PLANT_NOT_GROWING'
  | 'PLANT_NOT_OVERDOSED'
  | 'INVALID_LIGHT_HOURS'
  | 'UNKNOWN_PLACE'
  | 'PLACE_CLOSED'
  | 'SALE_ALREADY_RUNNING'
  | 'SALE_NOT_FOUND'
  | 'INSUFFICIENT_STOCK'
  | 'NOTHING_TO_BRIBE'
  | 'BANK_CAP_REACHED'
  | 'INSUFFICIENT_BANK_BALANCE'
  | 'UNKNOWN_JOB'
  | 'ALREADY_IN_JOB'
  | 'HOUSING_TOO_SMALL'
  | 'MAX_HOUSING_REACHED'
  | 'NOT_ENOUGH_GUARDS'
  | 'CANNOT_TARGET_SELF'
  | 'TARGET_PROTECTED'
  | 'TARGET_TOO_SMALL'
  | 'DAILY_THEFT_LIMIT'
  | 'INVALID_ACTION';

/** Erreur métier : action refusée par les règles du jeu (l'état n'est pas modifié). */
export class GameError extends Error {
  constructor(
    public readonly code: GameErrorCode,
    public readonly details: Record<string, number | string> = {},
  ) {
    super(code);
    this.name = 'GameError';
  }
}
