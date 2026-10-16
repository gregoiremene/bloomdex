import { gameClock } from '@weedapp/engine';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSession, type Profile } from '@/auth/session';
import { errorMessage } from '@/game/labels';
import { useGame, useNow } from '@/game/store';
import { supabase } from '@/lib/supabase';
import { Button, Card, Field, KeyboardAvoider, Muted, Row, Screen } from '@/ui/components';
import { colors, radius, spacing } from '@/ui/theme';

interface Message {
  id: number;
  /** null pour les messages du bot (quiz). */
  user_id: string | null;
  kind: 'player' | 'quiz';
  pseudo: string;
  body: string;
  created_at: string;
  deleted_at: string | null;
}

const HISTORY = 100;

export default function ChatScreen() {
  const profile = useSession((s) => s.profile);
  if (!supabase || !profile) {
    return (
      <Screen>
        <Card title="Squatte">
          <Muted>Le chat global est disponible uniquement en ligne, une fois connecté.</Muted>
        </Card>
      </Screen>
    );
  }
  return <Chat profile={profile} />;
}

function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [blocked, setBlocked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let active = true;
    void client
      .from('chat_messages')
      .select('id, user_id, kind, pseudo, body, created_at, deleted_at')
      .order('created_at', { ascending: false })
      .limit(HISTORY)
      .then(({ data }) => active && setMessages((data as Message[] | null) ?? []));
    void client
      .from('blocks')
      .select('blocked_id')
      .then(({ data }) => active && setBlocked(new Set((data ?? []).map((b: { blocked_id: string }) => b.blocked_id))));

    const channel = client
      .channel('squatte')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, ({ new: row }) => {
        setMessages((list) => [row as Message, ...list].slice(0, HISTORY));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' }, ({ new: row }) => {
        const updated = row as Message;
        setMessages((list) => list.map((m) => (m.id === updated.id ? updated : m)));
      })
      .subscribe();
    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, []);

  return { messages, blocked, setBlocked };
}

function Chat({ profile }: { profile: Profile }) {
  const { messages, blocked, setBlocked } = useChat();
  const setNotice = useGame((s) => s.setNotice);
  const [draft, setDraft] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const isModerator = profile.role !== 'player';
  const visible = useMemo(
    () => messages.filter((m) => !(m.user_id && blocked.has(m.user_id)) && (isModerator || !m.deleted_at)),
    [messages, blocked, isModerator],
  );

  const send = useCallback(async () => {
    const body = draft.trim();
    if (!body || !supabase) return;
    setDraft('');
    const { error } = await supabase.from('chat_messages').insert({ body });
    if (error) {
      setDraft(body);
      setNotice(error.message.includes('BANNED') ? errorMessage('BANNED') : error.message.includes('RATE_LIMITED') ? errorMessage('RATE_LIMITED') : error.message, 'error');
    }
  }, [draft, setNotice]);

  return (
    <KeyboardAvoider style={styles.container}>
      <QuizBanner />
      {visible.length === 0 ? (
        // Hors de la liste : une liste inversée retourne aussi son message « vide ».
        <View style={styles.empty}>
          <Muted>Personne n'a encore rien dit. Lance la discussion !</Muted>
        </View>
      ) : (
        <FlatList
          inverted
          data={visible}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
          renderItem={({ item }) =>
            item.kind === 'quiz' ? (
              <QuizMessage message={item} />
            ) : (
              <MessageBubble
                message={item}
                mine={item.user_id === profile.id}
                selected={selected === item.id}
                onPress={() => setSelected(selected === item.id ? null : item.id)}
              >
                {selected === item.id && item.user_id && item.user_id !== profile.id && (
                  <MessageActions
                    message={item}
                    authorId={item.user_id}
                    isModerator={isModerator}
                    onBlocked={() => setBlocked(new Set([...blocked, item.user_id!]))}
                    onDone={() => setSelected(null)}
                  />
                )}
              </MessageBubble>
            )
          }
        />
      )}
      <View style={styles.composer}>
        <Field value={draft} onChangeText={setDraft} placeholder="Écrire sur le squatte…" maxLength={500} onSubmitEditing={send} returnKeyType="send" />
        <Button label="Envoyer" onPress={send} disabled={!draft.trim()} />
      </View>
    </KeyboardAvoider>
  );
}

function MessageBubble({
  message,
  mine,
  selected,
  onPress,
  children,
}: {
  message: Message;
  mine: boolean;
  selected: boolean;
  onPress: () => void;
  children?: React.ReactNode;
}) {
  const time = new Date(message.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return (
    <Pressable onPress={onPress} style={[styles.bubble, mine && styles.bubbleMine, selected && { borderColor: colors.accent }]}>
      <Row>
        <Text style={[styles.pseudo, mine && { color: colors.accent }]}>{message.pseudo}</Text>
        <Text style={styles.time}>{time}</Text>
        {message.deleted_at && <Text style={styles.deleted}>masqué</Text>}
      </Row>
      <Text style={styles.body}>{message.body}</Text>
      {children}
    </Pressable>
  );
}

/** Message du bot du quiz (bonne réponse trouvée) : centré, sans actions. */
function QuizMessage({ message }: { message: Message }) {
  return (
    <View style={styles.quizMessage}>
      <Text style={styles.quizMessageText}>{message.body}</Text>
    </View>
  );
}

interface QuizStatus {
  reward: number;
  quietStart: number;
  quietEnd: number;
  current: { id: number; question: string; askedAt: string; winner: string | null; answer: string | null } | null;
  previous: { question: string; answer: string; winner: string | null } | null;
}

/** Question en cours (et réponse de la précédente), tenue à jour en temps réel. */
function useQuizStatus(): QuizStatus | null {
  const [status, setStatus] = useState<QuizStatus | null>(null);
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let active = true;
    const load = () =>
      void client.rpc('quiz_status').then(({ data }) => {
        if (active && data) setStatus(data as QuizStatus);
      });
    load();
    const channel = client
      .channel('quiz')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_rounds' }, load)
      .subscribe();
    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, []);
  return status;
}

/** Prochain quart d'heure (heure d'une nouvelle question). */
function nextQuarter(now: number): string {
  const quarter = 15 * 60_000;
  return new Date(Math.ceil((now + 1) / quarter) * quarter).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function QuizBanner() {
  const status = useQuizStatus();
  const now = useNow();
  if (!status) return null;
  const { hour } = gameClock(now);
  const quiet =
    status.quietStart < status.quietEnd
      ? hour >= status.quietStart && hour < status.quietEnd
      : hour >= status.quietStart || hour < status.quietEnd;
  const { current, previous } = status;

  return (
    <View style={styles.quiz}>
      {current && !current.winner ? (
        <>
          <Text style={styles.quizTitle}>🎲 Quiz du squatte · +{status.reward} Wl</Text>
          <Text style={styles.quizQuestion}>{current.question}</Text>
          <Muted>Réponds dans le chat : le premier qui trouve gagne.</Muted>
        </>
      ) : current?.winner ? (
        <>
          <Text style={styles.quizTitle}>🎲 Quiz du squatte</Text>
          <Text style={styles.quizQuestion}>
            ✅ {current.winner} a trouvé : « {current.answer} »
          </Text>
          <Muted>Prochaine question à {nextQuarter(now)}.</Muted>
        </>
      ) : (
        <>
          <Text style={styles.quizTitle}>🎲 Quiz du squatte</Text>
          <Muted>{quiet ? `Le quiz reprend à ${status.quietEnd} h.` : `Prochaine question à ${nextQuarter(now)}, si le squatte est animé.`}</Muted>
        </>
      )}
      {previous && !previous.winner && (
        <Text style={styles.quizPrevious} numberOfLines={2}>
          Personne n'a trouvé « {previous.question} » : c'était {previous.answer}.
        </Text>
      )}
    </View>
  );
}

const BAN_DURATIONS = [
  { label: '1 h', hours: 1 },
  { label: '24 h', hours: 24 },
  { label: '7 j', hours: 24 * 7 },
] as const;

function MessageActions({
  message,
  authorId,
  isModerator,
  onBlocked,
  onDone,
}: {
  message: Message;
  authorId: string;
  isModerator: boolean;
  onBlocked: () => void;
  onDone: () => void;
}) {
  const setNotice = useGame((s) => s.setNotice);
  const router = useRouter();
  const [reason, setReason] = useState('');

  async function run(label: string, call: () => PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await call();
    if (error) setNotice(error.message, 'error');
    else {
      setNotice(label, 'success');
      onDone();
    }
  }

  const client = supabase!;
  const ban = (scope: 'chat' | 'game', hours: number) =>
    run(`${message.pseudo} suspendu (${scope === 'chat' ? 'squatte' : 'jeu'}, ${hours} h)`, () =>
      client.from('bans').insert({
        user_id: authorId,
        scope,
        reason: reason.trim() || 'Non-respect des règles du squatte',
        expires_at: new Date(Date.now() + hours * 3_600_000).toISOString(),
      }),
    );

  return (
    <View style={styles.actions}>
      <Row wrap>
        <Button
          label="Envoyer un MP"
          compact
          onPress={() => {
            onDone();
            router.push({ pathname: '/messages/[id]', params: { id: authorId, pseudo: message.pseudo } });
          }}
        />
        <Button label="Signaler" compact variant="secondary" onPress={() => run('Message signalé, merci.', () => client.from('chat_reports').insert({ message_id: message.id }))} />
        <Button
          label="Bloquer"
          compact
          variant="secondary"
          onPress={() =>
            run(`${message.pseudo} bloqué`, async () => {
              const result = await client.from('blocks').insert({ blocked_id: authorId });
              if (!result.error) onBlocked();
              return result;
            })
          }
        />
      </Row>
      {isModerator && (
        <View style={{ gap: spacing.xs }}>
          <Muted>Modération</Muted>
          <Field value={reason} onChangeText={setReason} placeholder="Motif (optionnel)" maxLength={300} />
          <Row wrap>
            <Button label="Masquer" compact variant="danger" onPress={() => run('Message masqué', () => client.from('chat_messages').update({ deleted_at: new Date().toISOString() }).eq('id', message.id))} />
            {BAN_DURATIONS.map((d) => (
              <Button key={`chat${d.hours}`} label={`Muet ${d.label}`} compact variant="danger" onPress={() => ban('chat', d.hours)} />
            ))}
            {BAN_DURATIONS.map((d) => (
              <Button key={`game${d.hours}`} label={`Ban jeu ${d.label}`} compact variant="danger" onPress={() => ban('game', d.hours)} />
            ))}
          </Row>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  empty: { flex: 1, justifyContent: 'flex-end', padding: spacing.lg },
  composer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  bubble: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  bubbleMine: { backgroundColor: colors.surfaceRaised },
  pseudo: { color: colors.info, fontWeight: '700', fontSize: 13 },
  time: { color: colors.textMuted, fontSize: 11 },
  deleted: { color: colors.danger, fontSize: 11, fontWeight: '700' },
  body: { color: colors.text, fontSize: 15, lineHeight: 20 },
  actions: { gap: spacing.sm, paddingTop: spacing.sm },
  quiz: {
    gap: 4,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  quizTitle: { color: colors.warning, fontWeight: '800', fontSize: 13 },
  quizQuestion: { color: colors.text, fontWeight: '700', fontSize: 16, lineHeight: 21 },
  quizPrevious: { color: colors.textMuted, fontSize: 12, fontStyle: 'italic' },
  quizMessage: { alignSelf: 'center', paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surfaceRaised },
  quizMessageText: { color: colors.warning, fontWeight: '700', fontSize: 13, textAlign: 'center' },
});
