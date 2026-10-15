import { advance, HOUR_MS, PLACES, type GameEvent, type GameState } from '@weedapp/engine';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

type NotificationsModule = typeof import('expo-notifications');

/**
 * Notifications seulement dans un vrai build (dev build ou store) : ni sur le web, ni dans
 * Expo Go, qui ne les gère plus depuis le SDK 53. Le module n'est alors même pas chargé.
 */
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const supported = Platform.OS !== 'web' && !isExpoGo;

let module: NotificationsModule | null = null;

async function load(): Promise<NotificationsModule | null> {
  if (!supported) return null;
  if (!module) {
    module = await import('expo-notifications');
    module.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
  return module;
}

/** Horizon de projection des rappels. */
const LOOKAHEAD_HOURS = 48;
/** On prévient avant qu'un plant meure, pour laisser le temps de passer. */
const THIRST_WARNING_HOURS = 3;

let permission: boolean | undefined;

async function ensurePermission(Notifications: NotificationsModule): Promise<boolean> {
  if (permission !== undefined) return permission;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('game', { name: 'Exploitation', importance: Notifications.AndroidImportance.HIGH });
  }
  const current = await Notifications.getPermissionsAsync();
  const status = current.status === 'granted' ? current.status : (await Notifications.requestPermissionsAsync()).status;
  permission = status === 'granted';
  return permission;
}

function first(events: GameEvent[], type: GameEvent['type']): GameEvent | undefined {
  return events.find((e) => e.type === type);
}

/**
 * Planifie les rappels locaux en projetant la partie avec le moteur, comme si le joueur
 * ne faisait rien : on sait exactement quand un plant mourra, séchera, quand une vente finira…
 */
export async function scheduleReminders(state: GameState): Promise<void> {
  try {
    const Notifications = await load();
    if (!Notifications || !(await ensurePermission(Notifications))) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    const now = Date.now();
    const { events } = advance(state, now + LOOKAHEAD_HOURS * HOUR_MS);
    const reminders: { at: number; title: string; body: string }[] = [];

    const death = first(events, 'plant_died');
    if (death) reminders.push({ at: death.at - THIRST_WARNING_HOURS * HOUR_MS, title: 'Tes plants ont soif 💧', body: 'Un plant va mourir dans moins de 3 h sans arrosage.' });
    const dried = first(events, 'drying_done');
    if (dried) reminders.push({ at: dried.at, title: 'Récolte prête 🌿', body: 'Un plant a fini de sécher.' });
    const germs = first(events, 'germs_ready');
    if (germs) reminders.push({ at: germs.at, title: 'Germes prêts 🌱', body: 'Des germes font 10 cm : plante-les.' });
    const cramped = first(events, 'germs_died');
    if (cramped) reminders.push({ at: cramped.at - THIRST_WARNING_HOURS * HOUR_MS, title: 'Germes à l’étroit 🌱', body: 'Des germes vont mourir faute de place : plante-les vite.' });
    const sale = first(events, 'sale_completed');
    if (sale?.type === 'sale_completed') reminders.push({ at: sale.at, title: 'Vente terminée 💰', body: `Ta vente à ${PLACES[sale.placeId].name} est finie.` });
    const alert = first(events, 'police_alert');
    if (alert) reminders.push({ at: alert.at, title: 'Les stups arrivent 🚨', body: 'Ton indice police a dépassé le maximum : passe voir le commissaire !' });

    for (const reminder of reminders) {
      if (reminder.at <= now + 60_000) continue;
      await Notifications.scheduleNotificationAsync({
        content: { title: reminder.title, body: reminder.body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(reminder.at), channelId: 'game' },
      });
    }
  } catch (error) {
    console.warn('rappels', error);
  }
}

/** Enregistre le jeton push (vols subis) — nécessite un appareil réel et un projet EAS. */
export async function registerPushToken(userId: string): Promise<void> {
  try {
    const Notifications = await load();
    if (!Notifications || !supabase || !Device.isDevice || !(await ensurePermission(Notifications))) return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.from('push_tokens').upsert({ user_id: userId, token, updated_at: new Date().toISOString() });
  } catch (error) {
    console.warn('push', error);
  }
}
