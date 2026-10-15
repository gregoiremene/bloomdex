import 'expo-sqlite/localStorage/install';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
/** EXPO_PUBLIC_FORCE_DEMO=1 : force le mode démo même si Supabase est configuré (tests en local). */
const forceDemo = process.env.EXPO_PUBLIC_FORCE_DEMO === '1';

/**
 * Client Supabase, ou `null` si l'app n'est pas configurée : elle tourne alors en
 * mode démo hors ligne (moteur local, sans chat ni vols).
 */
export const supabase: SupabaseClient | null =
  url && key && !forceDemo
    ? createClient(url, key, {
        auth: { storage: localStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
      })
    : null;

export const isOnline = supabase !== null;

if (supabase) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
