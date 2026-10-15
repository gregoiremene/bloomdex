import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { registerPushToken } from '@/notifications';

export interface Profile {
  id: string;
  pseudo: string;
  role: 'player' | 'moderator' | 'admin';
}

interface SessionStore {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  init: () => () => void;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, pseudo: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  /** Vrai entre la validation du code de réinitialisation et le choix du nouveau mot de passe. */
  recovering: boolean;
  requestPasswordReset: (email: string) => Promise<string | null>;
  resetPassword: (email: string, code: string, password: string) => Promise<string | null>;
}

const AUTH_ERRORS: Record<string, string> = {
  invalid_credentials: 'Email ou mot de passe incorrect.',
  user_already_exists: 'Un compte existe déjà avec cet email.',
  weak_password: 'Mot de passe trop faible (6 caractères minimum).',
  email_not_confirmed: 'Confirme ton email avant de te connecter.',
  otp_expired: 'Code invalide ou expiré.',
  same_password: "Choisis un mot de passe différent de l'ancien.",
  over_email_send_rate_limit: 'Trop de demandes : réessaie dans quelques minutes.',
};

function authError(error: { code?: string; message: string }): string {
  if (error.message.includes('profiles_pseudo') || error.message.includes('Database error')) return 'Ce pseudo est déjà pris ou invalide.';
  return (error.code && AUTH_ERRORS[error.code]) || error.message;
}

async function loadProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null;
  const { data } = await supabase.from('profiles').select('id, pseudo, role').eq('id', userId).maybeSingle();
  return (data as Profile | null) ?? null;
}

export const useSession = create<SessionStore>((set, get) => ({
  ready: !supabase,
  recovering: false,
  session: null,
  profile: null,

  init: () => {
    if (!supabase) return () => {};
    const handle = async (session: Session | null) => {
      const profile = session ? await loadProfile(session.user.id) : null;
      set({ session, profile, ready: true });
      if (session) void registerPushToken(session.user.id);
    };
    void supabase.auth.getSession().then(({ data }) => handle(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      void handle(session);
    });
    return () => data.subscription.unsubscribe();
  },

  signIn: async (email, password) => {
    if (!supabase) return null;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? authError(error) : null;
  },

  signUp: async (email, password, pseudo) => {
    if (!supabase) return null;
    if (!/^[A-Za-z0-9_-]{3,20}$/.test(pseudo)) return 'Pseudo : 3 à 20 caractères (lettres, chiffres, _ ou -).';
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { pseudo } } });
    if (error) return authError(error);
    if (!data.session) return 'Compte créé : confirme ton email puis connecte-toi.';
    return null;
  },

  signOut: async () => {
    await supabase?.auth.signOut();
  },

  // Réinitialisation par code reçu par email (pas de lien : rien à rouvrir dans l'app, marche aussi dans Expo Go).
  requestPasswordReset: async (email) => {
    if (!supabase) return null;
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return error ? authError(error) : null;
  },

  resetPassword: async (email, code, password) => {
    if (!supabase) return null;
    if (password.length < 6) return AUTH_ERRORS.weak_password!;
    // Code déjà validé si une tentative précédente a échoué sur le mot de passe : on ne le revérifie pas.
    if (!get().recovering) {
      set({ recovering: true });
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
      if (error) {
        set({ recovering: false });
        return authError(error);
      }
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return authError(error);
    set({ recovering: false });
    return null;
  },
}));
