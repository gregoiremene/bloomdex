// Outils communs aux Edge Functions : client admin, authentification, chargement/sauvegarde des états.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createInitialState, GameError, HOUSINGS, type GameState } from './engine/index.ts';

export const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export class HttpError extends Error {
  constructor(public readonly status: number, public readonly code: string) {
    super(code);
  }
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

/** Enveloppe un handler : CORS, erreurs métier (400) et erreurs HTTP. */
export function serve(handler: (req: Request) => Promise<Response>): void {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    try {
      return await handler(req);
    } catch (error) {
      if (error instanceof GameError) return json({ error: error.code, details: error.details }, 400);
      if (error instanceof HttpError) return json({ error: error.code }, error.status);
      console.error(error);
      return json({ error: 'INTERNAL_ERROR' }, 500);
    }
  });
}

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  if (req.method !== 'POST') return {};
  try {
    const body = await req.json();
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  } catch {
    throw new HttpError(400, 'INVALID_JSON');
  }
}

export async function requireUser(req: Request): Promise<string> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'UNAUTHENTICATED');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'UNAUTHENTICATED');
  return data.user.id;
}

export async function assertNotBanned(userId: string, scope: 'game' | 'chat'): Promise<void> {
  const { data, error } = await admin.rpc('is_banned', { uid: userId, ban_scope: scope });
  if (error) throw error;
  if (data) throw new HttpError(403, 'BANNED');
}

/** Réservé aux comptes admin (outils de test). */
export async function requireAdmin(userId: string): Promise<void> {
  const { data, error } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (error) throw error;
  if (data?.role !== 'admin') throw new HttpError(403, 'FORBIDDEN');
}

export interface PlayerRecord {
  id: string;
  pseudo: string;
  state: GameState;
  /** 0 = pas encore de partie enregistrée. */
  version: number;
}

function randomSeed(): number {
  return crypto.getRandomValues(new Int32Array(1))[0]!;
}

/** Charge (ou crée) la partie d'un joueur. */
export async function loadPlayer(userId: string, now: number): Promise<PlayerRecord> {
  const [{ data: profile, error: profileError }, { data: row, error: stateError }] = await Promise.all([
    admin.from('profiles').select('pseudo').eq('id', userId).maybeSingle(),
    admin.from('player_states').select('state, version').eq('user_id', userId).maybeSingle(),
  ]);
  if (profileError) throw profileError;
  if (stateError) throw stateError;
  if (!profile) throw new HttpError(404, 'PLAYER_NOT_FOUND');
  if (!row) return { id: userId, pseudo: profile.pseudo, state: createInitialState(now, randomSeed()), version: 0 };
  return { id: userId, pseudo: profile.pseudo, state: row.state as GameState, version: row.version };
}

export async function savePlayer(userId: string, state: GameState, expectedVersion: number): Promise<boolean> {
  const { data, error } = await admin.rpc('save_player_state', {
    p_user_id: userId,
    p_state: state,
    p_expected_version: expectedVersion,
    p_housing_level: HOUSINGS[state.housing].level,
  });
  if (error) throw error;
  return data === true;
}

/** Notification push via le service Expo (au mieux : une erreur n'interrompt pas l'action). */
export async function sendPush(userId: string, title: string, body: string): Promise<void> {
  try {
    const { data } = await admin.from('push_tokens').select('token').eq('user_id', userId);
    if (!data?.length) return;
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data.map(({ token }) => ({ to: token, title, body, sound: 'default' }))),
    });
  } catch (error) {
    console.error('push', error);
  }
}
