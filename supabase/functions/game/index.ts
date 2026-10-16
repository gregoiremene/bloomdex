// POST /game { action?: GameAction, debugRewindHours?: number }
// Rattrape les actualisations horaires du joueur, applique son action (optionnelle) et sauvegarde.
// Sans action : simple synchronisation (renvoie l'état à jour).
// debugRewindHours (admin uniquement) : simule N actualisations en reculant l'horloge du joueur.
import { advance, applyAction, creditQuizRewards, parseAction, rewindClock } from '../_shared/engine/index.ts';
import {
  assertNotBanned,
  claimQuizRewards,
  HttpError,
  json,
  loadPlayer,
  readBody,
  releaseQuizRewards,
  requireAdmin,
  requireUser,
  savePlayer,
  serve,
} from '../_shared/server.ts';

const MAX_ATTEMPTS = 3;

serve(async (req) => {
  const userId = await requireUser(req);
  await assertNotBanned(userId, 'game');
  const body = await readBody(req);
  const action = body.action == null ? null : parseAction(body.action);
  const rewindHours = body.debugRewindHours == null ? null : Number(body.debugRewindHours);
  if (rewindHours !== null) await requireAdmin(userId);

  // Gains du quiz du squatte en attente : versés avant l'action, remis en attente si on ne sauvegarde pas.
  const quiz = await claimQuizRewards(userId);
  try {
    // Verrou optimiste : si une autre requête a écrit entre-temps, on recommence depuis l'état frais.
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const now = Date.now();
      const player = await loadPlayer(userId, now);
      const base = rewindHours !== null ? rewindClock(player.state, rewindHours) : player.state;
      const { state: advanced, events, ticks } = advance(base, now);
      const credited = quiz.amount > 0 ? creditQuizRewards(advanced, quiz.amount, quiz.ids.length, now) : advanced;
      const next = action ? applyAction(credited, action, now) : credited;
      const changed = action !== null || ticks > 0 || quiz.amount > 0 || player.version === 0;
      if (!changed || (await savePlayer(userId, next, player.version))) {
        return json({ state: next, events, serverTime: now });
      }
    }
    throw new HttpError(409, 'VERSION_CONFLICT');
  } catch (error) {
    await releaseQuizRewards(quiz.ids);
    throw error;
  }
});
