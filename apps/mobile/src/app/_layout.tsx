import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSession } from '@/auth/session';
import { FeedbackButton } from '@/ui/Feedback';
import { KeyboardProvider } from '@/ui/keyboard';
import { LegalGate } from '@/ui/LegalGate';
import { Notice } from '@/ui/Notice';
import { colors } from '@/ui/theme';

export default function RootLayout() {
  const init = useSession((s) => s.init);
  useEffect(() => init(), [init]);

  return (
    <SafeAreaProvider>
      <KeyboardProvider>
      <StatusBar style="light" />
      <LegalGate>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
              headerTitleStyle: { fontWeight: '700' },
              contentStyle: { backgroundColor: colors.background },
              headerBackTitle: 'Retour',
              // À gauche : la flèche de retour ; le bouton 💡 passe donc à droite sur ces écrans.
              headerRight: () => <FeedbackButton side="right" />,
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="housing" options={{ title: 'Immobilier' }} />
            <Stack.Screen name="jobs" options={{ title: 'Métiers' }} />
            <Stack.Screen name="players" options={{ title: 'La ville' }} />
            <Stack.Screen name="journal" options={{ title: 'Journal' }} />
            <Stack.Screen name="messages/index" options={{ title: 'Messages' }} />
            <Stack.Screen name="messages/[id]" options={{ title: 'Conversation' }} />
            <Stack.Screen name="admin/index" options={{ title: 'Admin · joueurs' }} />
            <Stack.Screen name="admin/[id]" options={{ title: 'Joueur' }} />
          </Stack>
          <Notice />
        </View>
      </LegalGate>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
