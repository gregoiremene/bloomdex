import {
  advance,
  applyAction,
  createInitialState,
  GameError,
  rewindClock,
  type DetectiveReport,
  type GameAction,
  type GameEvent,
  type GameState,
} from '@weedapp/engine';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export interface Snapshot {
  state: GameState;
  events: GameEvent[];
  serverTime: number;
}

export interface TheftOutcome {
  success: boolean;
  money: number;
  grams: Record<string, number>;
}

/** Erreur renvoyée au joueur : code métier du moteur ou code serveur. */
export class ClientError extends Error {
  constructor(public readonly code: string, public readonly details: Record<string, unknown> = {}) {
    super(code);
  }
}

export interface GameClient {
  sync(): Promise<Snapshot>;
  act(action: GameAction): Promise<Snapshot>;
  theft(targetId: string, thieves: number): Promise<Snapshot & { outcome: TheftOutcome }>;
  detective(targetId: string): Promise<Snapshot & { report: DetectiveReport }>;
  /** Admin : simule `hours` actualisations. */
  rewind(hours: number): Promise<Snapshot>;
}

// ---------------------------------------------------------------- Serveur (Supabase)

async function invoke<T>(fn: string, body: unknown): Promise<T> {
  if (!supabase) throw new ClientError('OFFLINE');
  const { data, error } = await supabase.functions.invoke<T>(fn, { body: body as Record<string, unknown> });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => ({}));
      throw new ClientError(payload.error ?? 'SERVER_ERROR', payload.details ?? {});
    }
    throw new ClientError('NETWORK_ERROR');
  }
  return data as T;
}

export const remoteClient: GameClient = {
  sync: () => invoke<Snapshot>('game', {}),
  act: (action) => invoke<Snapshot>('game', { action }),
  theft: (targetId, thieves) => invoke('pvp', { type: 'theft', targetId, thieves }),
  detective: (targetId) => invoke('pvp', { type: 'detective', targetId }),
  rewind: (hours) => invoke<Snapshot>('game', { debugRewindHours: hours }),
};

// ---------------------------------------------------------------- Démo hors ligne (moteur local)

const SAVE_KEY = 'weedapp.localGame.v1';

function loadLocal(now: number): GameState {
  const saved = localStorage.getItem(SAVE_KEY);
  if (saved) return JSON.parse(saved) as GameState;
  return createInitialState(now, Math.floor(Math.random() * 2 ** 31));
}

function runLocal(action: GameAction | null, rewindHours?: number): Snapshot {
  const now = Date.now();
  try {
    const saved = loadLocal(now);
    const { state, events } = advance(rewindHours ? rewindClock(saved, rewindHours) : saved, now);
    const next = action ? applyAction(state, action, now) : state;
    localStorage.setItem(SAVE_KEY, JSON.stringify(next));
    return { state: next, events, serverTime: now };
  } catch (error) {
    if (error instanceof GameError) throw new ClientError(error.code, error.details);
    throw error;
  }
}

export const localClient: GameClient = {
  sync: async () => runLocal(null),
  act: async (action) => runLocal(action),
  theft: async () => {
    throw new ClientError('OFFLINE');
  },
  detective: async () => {
    throw new ClientError('OFFLINE');
  },
  rewind: async (hours) => runLocal(null, hours),
};

export function resetLocalGame(): void {
  localStorage.removeItem(SAVE_KEY);
}
