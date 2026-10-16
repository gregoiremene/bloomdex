import Constants from 'expo-constants';
import { usePathname } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import { errorMessage } from '@/game/labels';
import { useGame } from '@/game/store';
import { isOnline, supabase } from '@/lib/supabase';
import { Button, Chips, Field, Muted } from './components';
import { Sheet } from './Sheet';
import { colors, spacing } from './theme';

type Kind = 'suggestion' | 'bug' | 'other';

const KINDS: readonly { value: Kind; label: string }[] = [
  { value: 'suggestion', label: '💡 Suggestion' },
  { value: 'bug', label: '🐛 Bug' },
  { value: 'other', label: '💬 Autre' },
];

/** Libellé lisible de l'écran courant, envoyé avec le retour. */
const SCREENS: Record<string, string> = {
  '/': 'Exploitation',
  '/shop': 'Boutique',
  '/sell': 'Vendre',
  '/bank': 'Banque',
  '/chat': 'Squatte',
  '/more': 'Plus',
  '/housing': 'Immobilier',
  '/jobs': 'Métiers',
  '/players': 'La ville',
  '/journal': 'Journal',
  '/messages': 'Messages',
};

function screenLabel(pathname: string): string {
  if (pathname.startsWith('/messages/')) return 'Conversation';
  return SCREENS[pathname] ?? pathname;
}

/** Bouton 💡 du header : suggestions et bugs, depuis n'importe quel écran (en ligne uniquement). */
export function FeedbackButton({ side }: { side: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  if (!isOnline) return null;
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={10}
        style={side === 'left' ? styles.left : styles.right}
        accessibilityRole="button"
        accessibilityLabel="Faire une suggestion ou signaler un bug"
      >
        <Text style={styles.icon}>💡</Text>
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title="Une idée, un bug ?" icon="💡">
        {open && <FeedbackForm onDone={() => setOpen(false)} />}
      </Sheet>
    </>
  );
}

function FeedbackForm({ onDone }: { onDone: () => void }) {
  const pathname = usePathname();
  const setNotice = useGame((s) => s.setNotice);
  const [kind, setKind] = useState<Kind>('suggestion');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const screen = screenLabel(pathname);

  async function send() {
    const text = body.trim();
    if (!text || !supabase) return;
    setSending(true);
    const { error } = await supabase.from('feedback').insert({
      kind,
      body: text,
      screen,
      platform: Platform.OS,
      app_version: Constants.expoConfig?.version ?? '',
    });
    setSending(false);
    if (error) {
      setNotice(error.message.includes('RATE_LIMITED') ? errorMessage('RATE_LIMITED') : error.message, 'error');
      return;
    }
    setNotice('Merci ! Ton retour a bien été envoyé.', 'success');
    onDone();
  }

  return (
    <>
      <Muted>Tout est lu par l'équipe. Pour un bug, dis ce que tu faisais et ce qui s'est passé.</Muted>
      <Chips options={KINDS} value={kind} onChange={setKind} />
      <Field
        value={body}
        onChangeText={setBody}
        placeholder={kind === 'bug' ? 'Ce que tu faisais, ce qui s’est passé…' : 'Ton idée pour le jeu…'}
        multiline
        maxLength={1000}
        style={styles.input}
        textAlignVertical="top"
      />
      <Muted>
        Envoyé avec : écran « {screen} », {Platform.OS}, version {Constants.expoConfig?.version ?? '?'}.
      </Muted>
      <Button label="Envoyer" onPress={send} loading={sending} disabled={!body.trim()} />
    </>
  );
}

const styles = StyleSheet.create({
  left: { paddingHorizontal: spacing.lg },
  right: { paddingLeft: spacing.sm, paddingRight: spacing.lg },
  icon: { fontSize: 22 },
  input: { minHeight: 120, paddingTop: spacing.md },
});
