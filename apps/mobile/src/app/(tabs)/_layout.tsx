import { Redirect, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, AppState, Text, View } from 'react-native';
import { useSession } from '@/auth/session';
import { useMessages } from '@/game/messages';
import { useGame } from '@/game/store';
import { isOnline } from '@/lib/supabase';
import { colors } from '@/ui/theme';
import { FeedbackButton } from '@/ui/Feedback';
import { WalletButton } from '@/ui/Wallet';

function icon(glyph: string) {
  return ({ focused }: { focused: boolean }) => <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{glyph}</Text>;
}

export default function TabsLayout() {
  const ready = useSession((s) => s.ready);
  const session = useSession((s) => s.session);
  const sync = useGame((s) => s.sync);
  const loaded = useGame((s) => s.state !== null);
  const signedIn = !isOnline || session !== null;
  const userId = session?.user.id;
  const subscribeMessages = useMessages((s) => s.subscribe);
  const unread = useMessages((s) => s.unread);

  // MP : compteur de non-lus tenu à jour en temps réel tant que le joueur est connecté.
  useEffect(() => (userId ? subscribeMessages(userId) : undefined), [userId, subscribeMessages]);

  // Synchronise à l'ouverture et à chaque retour au premier plan (rattrapage des heures écoulées).
  useEffect(() => {
    if (!signedIn) return;
    void sync();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync();
    });
    return () => sub.remove();
  }, [signedIn, sync]);

  if (!ready) return <Loading />;
  if (!signedIn) return <Redirect href="/login" />;
  if (!loaded) return <Loading />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        sceneStyle: { backgroundColor: colors.background },
        headerRight: () => <WalletButton />,
        headerLeft: () => <FeedbackButton side="left" />,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Exploitation', tabBarIcon: icon('🌱') }} />
      <Tabs.Screen name="shop" options={{ title: 'Boutique', tabBarIcon: icon('🛒') }} />
      <Tabs.Screen name="sell" options={{ title: 'Vendre', tabBarIcon: icon('💸') }} />
      <Tabs.Screen name="bank" options={{ title: 'Banque', tabBarIcon: icon('🏦') }} />
      <Tabs.Screen name="chat" options={{ title: 'Squatte', tabBarIcon: icon('💬') }} />
      {/* MP non lus : pastille sur l'onglet Plus (la messagerie y est, tuile « Messages »). */}
      <Tabs.Screen name="more" options={{ title: 'Plus', tabBarIcon: icon('☰'), tabBarBadge: unread > 0 ? unread : undefined }} />
    </Tabs>
  );
}

function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  );
}
