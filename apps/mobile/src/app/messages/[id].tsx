import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/auth/session';
import { useGame } from '@/game/store';
import { dmError, useMessages, type DirectMessage } from '@/game/messages';
import { supabase } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Field, Muted, Row } from '@/ui/components';
import { KeyboardSpacer } from '@/ui/keyboard';
import { confirm } from '@/ui/confirm';
import { colors, radius, spacing } from '@/ui/theme';

const HISTORY = 200;

/** Fil d'une conversation privée avec un joueur. */
export default function ConversationScreen() {
  const { id: peerId, pseudo: pseudoParam } = useLocalSearchParams<{ id: string; pseudo?: string }>();
  const router = useRouter();
  const me = useSession((s) => s.profile);
  const setNotice = useGame((s) => s.setNotice);
  const version = useMessages((s) => s.version);
  const refreshInbox = useMessages((s) => s.refresh);
  const [pseudo, setPseudo] = useState(pseudoParam ?? '');
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const insets = useSafeAreaInsets();

  // Pseudo absent (lien direct) : on le relit.
  useEffect(() => {
    if (pseudo || !supabase || !peerId) return;
    void supabase
      .from('profiles')
      .select('pseudo')
      .eq('id', peerId)
      .maybeSingle()
      .then(({ data }) => data && setPseudo((data as { pseudo: string }).pseudo));
  }, [peerId, pseudo]);

  // Chargement, puis à chaque MP reçu/envoyé (version du store) ; marque les reçus comme lus.
  useEffect(() => {
    if (!supabase || !me || !peerId) return;
    const client = supabase;
    let active = true;
    void client
      .from('direct_messages')
      .select('id, sender_id, recipient_id, body, created_at, read_at')
      .or(`and(sender_id.eq.${me.id},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${me.id})`)
      .order('created_at', { ascending: false })
      .limit(HISTORY)
      .then(async ({ data }) => {
        if (!active) return;
        const list = (data as DirectMessage[] | null) ?? [];
        setMessages(list);
        if (list.some((m) => m.recipient_id === me.id && !m.read_at)) {
          await client.from('direct_messages').update({ read_at: new Date().toISOString() }).eq('sender_id', peerId).eq('recipient_id', me.id).is('read_at', null);
          void refreshInbox();
        }
      });
    return () => {
      active = false;
    };
  }, [me, peerId, version, refreshInbox]);

  const send = useCallback(async () => {
    const body = draft.trim();
    if (!body || !supabase || !peerId) return;
    setDraft('');
    const { error } = await supabase.from('direct_messages').insert({ recipient_id: peerId, body });
    if (error) {
      setDraft(body);
      setNotice(dmError(error.message), 'error');
    }
  }, [draft, peerId, setNotice]);

  const block = () =>
    confirm(`Bloquer ${pseudo} ?`, 'Vous ne pourrez plus vous écrire, et ses messages du squatte seront masqués pour toi.', 'Bloquer', async () => {
      const { error } = await supabase!.from('blocks').insert({ blocked_id: peerId });
      if (error) setNotice(error.message, 'error');
      else {
        setNotice(`${pseudo} bloqué`, 'success');
        router.back();
      }
    });

  const report = async (message: DirectMessage) => {
    const { error } = await supabase!.rpc('report_direct_message', { p_message_id: message.id });
    if (error) setNotice(dmError(error.message), 'error');
    else setNotice('Message signalé à la modération, merci.', 'success');
    setSelected(null);
  };

  if (!me || !peerId) return null;

  return (
    // Pas de KeyboardAvoidingView ici : l'espace sous le champ (KeyboardSpacer) suit le clavier.
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: pseudo || 'Conversation',
          headerRight: () => (
            <Pressable onPress={block} hitSlop={10} accessibilityRole="button">
              <Text style={styles.block}>Bloquer</Text>
            </Pressable>
          ),
        }}
      />
      {messages.length === 0 ? (
        // Hors de la liste : une liste inversée retourne aussi son message « vide ».
        <View style={styles.empty}>
          <Muted>Écris le premier message à {pseudo || 'ce joueur'}.</Muted>
        </View>
      ) : (
        <FlatList
          inverted
          data={messages}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
          renderItem={({ item }) => {
            const mine = item.sender_id === me.id;
            return (
              <Pressable
                onPress={() => !mine && setSelected(selected === item.id ? null : item.id)}
                style={[styles.bubble, mine ? styles.mine : styles.theirs, selected === item.id && { borderColor: colors.accent }]}
              >
                <Text style={styles.body}>{item.body}</Text>
                <Text style={styles.time}>
                  {new Date(item.created_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {mine && item.read_at ? ' · lu' : ''}
                </Text>
                {selected === item.id && (
                  <Row>
                    <Button label="Signaler" compact variant="secondary" onPress={() => void report(item)} />
                  </Row>
                )}
              </Pressable>
            );
          }}
        />
      )}
      <View style={styles.composer}>
        <Field value={draft} onChangeText={setDraft} placeholder={`Message à ${pseudo || '…'}`} maxLength={500} onSubmitEditing={send} returnKeyType="send" />
        <Button label="Envoyer" onPress={send} disabled={!draft.trim()} />
      </View>
      {/* Hauteur du clavier quand il est ouvert, sinon la barre de navigation du système (Android). */}
      <KeyboardSpacer minHeight={insets.bottom} style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  spacer: { backgroundColor: colors.surface },
  empty: { flex: 1, justifyContent: 'flex-end', padding: spacing.lg },
  bubble: { maxWidth: '85%', borderRadius: radius.md, padding: spacing.md, gap: 4, borderWidth: 1, borderColor: 'transparent' },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.surfaceRaised },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface },
  body: { color: colors.text, fontSize: 15, lineHeight: 20 },
  time: { color: colors.textMuted, fontSize: 11 },
  block: { color: colors.danger, fontWeight: '700', paddingHorizontal: spacing.lg },
  composer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
});
