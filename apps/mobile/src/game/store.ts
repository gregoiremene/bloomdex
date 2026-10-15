import { advance, HOUR_MS, type GameAction, type GameState } from '@weedapp/engine';
import { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import { isOnline } from '@/lib/supabase';
import { ClientError, localClient, remoteClient, type GameClient, type Snapshot } from './client';
import { errorMessage, eventsSummary } from './labels';
import { scheduleReminders } from '@/notifications';

const client: GameClient = isOnline ? remoteClient : localClient;

interface GameStore {
  state: GameState | null;
  /** Décalage horloge serveur - horloge locale. */
  clockOffset: number;
  busy: boolean;
  notice: { text: string; tone: 'info' | 'error' | 'success' } | null;
  sync: () => Promise<void>;
  /** Admin : simule `hours` actualisations. */
  rewind: (hours: number) => Promise<void>;
  act: (action: GameAction, success?: string) => Promise<boolean>;
  run: <T extends Snapshot>(call: (client: GameClient) => Promise<T>) => Promise<T | null>;
  setNotice: (text: string, tone?: 'info' | 'error' | 'success') => void;
  clearNotice: () => void;
  reset: () => void;
}

export const useGame = create<GameStore>((set, get) => {
  function apply(snapshot: Snapshot): void {
    set({ state: snapshot.state, clockOffset: snapshot.serverTime - Date.now() });
    void scheduleReminders(snapshot.state);
  }

  function fail(error: unknown): void {
    const code = error instanceof ClientError ? error.code : 'NETWORK_ERROR';
    if (!(error instanceof ClientError)) console.warn(error);
    set({ notice: { text: errorMessage(code), tone: 'error' } });
  }

  return {
    state: null,
    clockOffset: 0,
    busy: false,
    notice: null,

    sync: async () => {
      try {
        const snapshot = await client.sync();
        apply(snapshot);
        const summary = eventsSummary(snapshot.events);
        if (summary) set({ notice: { text: summary, tone: 'info' } });
      } catch (error) {
        fail(error);
      }
    },

    rewind: async (hours) => {
      if (get().busy) return;
      set({ busy: true });
      try {
        const snapshot = await client.rewind(hours);
        apply(snapshot);
        const summary = eventsSummary(snapshot.events);
        set({ notice: { text: `⏩ ${hours} h simulée(s)${summary ? ` · ${summary}` : ''}`, tone: 'info' } });
      } catch (error) {
        fail(error);
      } finally {
        set({ busy: false });
      }
    },

    act: async (action, success) => {
      if (get().busy) return false;
      set({ busy: true });
      try {
        apply(await client.act(action));
        if (success) set({ notice: { text: success, tone: 'success' } });
        return true;
      } catch (error) {
        fail(error);
        return false;
      } finally {
        set({ busy: false });
      }
    },

    run: async (call) => {
      set({ busy: true });
      try {
        const result = await call(client);
        apply(result);
        return result;
      } catch (error) {
        fail(error);
        return null;
      } finally {
        set({ busy: false });
      }
    },

    setNotice: (text, tone = 'info') => set({ notice: { text, tone } }),
    clearNotice: () => set({ notice: null }),
    reset: () => set({ state: null, notice: null }),
  };
});

/** Heure courante (alignée sur le serveur), rafraîchie toutes les 30 s. */
export function useNow(): number {
  const offset = useGame((s) => s.clockOffset);
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    setNow(Date.now() + offset);
    const id = setInterval(() => setNow(Date.now() + offset), 30_000);
    return () => clearInterval(id);
  }, [offset]);
  return now;
}

/**
 * État affiché : l'état serveur projeté jusqu'à l'heure courante avec le même moteur
 * (déterministe), pour voir les plants pousser sans attendre une synchronisation.
 */
export function useGameState(): GameState | null {
  const state = useGame((s) => s.state);
  const now = useNow();
  const hour = Math.floor(now / HOUR_MS);
  return useMemo(() => (state ? project(state, hour) : null), [state, hour]);
}

// Projection partagée : tous les écrans montés (onglets compris) lisent le même résultat
// au lieu de recloner et rejouer l'état chacun de leur côté.
let projection: { source: GameState; hour: number; result: GameState } | null = null;

function project(state: GameState, hour: number): GameState {
  if (projection?.source !== state || projection.hour !== hour) {
    projection = { source: state, hour, result: advance(state, hour * HOUR_MS).state };
  }
  return projection.result;
}
