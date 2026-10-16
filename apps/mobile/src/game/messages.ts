import { create } from 'zustand';
import { errorMessage } from './labels';
import { supabase } from '@/lib/supabase';

export interface DirectMessage {
  id: number;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export interface Conversation {
  peer_id: string;
  peer_pseudo: string;
  last_body: string;
  last_at: string;
  last_from_me: boolean;
  unread: number;
}

interface MessagesStore {
  conversations: Conversation[];
  unread: number;
  /** Incrémenté à chaque MP reçu ou lu : les écrans ouverts s'en servent pour se recharger. */
  version: number;
  refresh: () => Promise<void>;
  /** Abonnement temps réel aux MP du joueur ; renvoie la fonction de désabonnement. */
  subscribe: (userId: string) => () => void;
}

export const useMessages = create<MessagesStore>((set, get) => ({
  conversations: [],
  unread: 0,
  version: 0,

  refresh: async () => {
    if (!supabase) return;
    const { data } = await supabase.rpc('dm_conversations');
    const conversations = (data as Conversation[] | null) ?? [];
    set({ conversations, unread: conversations.reduce((sum, c) => sum + c.unread, 0) });
  },

  subscribe: (userId) => {
    if (!supabase) return () => {};
    const client = supabase;
    void get().refresh();
    const onChange = () => {
      set((s) => ({ version: s.version + 1 }));
      void get().refresh();
    };
    // Les règles de sécurité filtrent déjà : on ne reçoit que ses propres MP.
    const channel = client
      .channel(`dm-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `recipient_id=eq.${userId}` }, onChange)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `sender_id=eq.${userId}` }, onChange)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'direct_messages', filter: `recipient_id=eq.${userId}` }, onChange)
      .subscribe();
    return () => void client.removeChannel(channel);
  },
}));

/** Erreur Supabase → message lisible (codes levés par les déclencheurs SQL). */
export function dmError(message: string): string {
  for (const code of ['BANNED', 'BLOCKED', 'RATE_LIMITED', 'MESSAGE_NOT_FOUND']) {
    if (message.includes(code)) return errorMessage(code);
  }
  return message;
}
