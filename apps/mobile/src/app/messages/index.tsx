import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMessages } from '@/game/messages';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/auth/session';
import { Card, Field, Muted, Screen } from '@/ui/components';
import { colors, spacing } from '@/ui/theme';

/** Messagerie : une ligne par conversation, la plus récente en haut. */
export default function MessagesScreen() {
  const router = useRouter();
  const conversations = useMessages((s) => s.conversations);
  const refresh = useMessages((s) => s.refresh);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!supabase) {
    return (
      <Screen>
        <Card title="Messages">
          <Muted>Les messages privés sont disponibles uniquement en ligne.</Muted>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await refresh();
        setRefreshing(false);
      }}
    >
      <NewMessage />
      <Muted>Les messages sont effacés au bout de 90 jours.</Muted>
      {conversations.length === 0 ? (
        <Card>
          <Muted>Aucune conversation pour l'instant.</Muted>
        </Card>
      ) : (
        <Card>
          {conversations.map((c) => (
            <Pressable
              key={c.peer_id}
              onPress={() => router.push({ pathname: '/messages/[id]', params: { id: c.peer_id, pseudo: c.peer_pseudo } })}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel={`Conversation avec ${c.peer_pseudo}${c.unread ? `, ${c.unread} non lu(s)` : ''}`}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.header}>
                  <Text style={[styles.pseudo, c.unread > 0 && { color: colors.accent }]}>{c.peer_pseudo}</Text>
                  <Text style={styles.time}>{formatWhen(c.last_at)}</Text>
                </View>
                <Text style={[styles.preview, c.unread > 0 && styles.previewUnread]} numberOfLines={1}>
                  {c.last_from_me ? 'Toi : ' : ''}
                  {c.last_body}
                </Text>
              </View>
              {c.unread > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{c.unread}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}

/** Recherche d'un joueur par pseudo pour lui écrire. */
function NewMessage() {
  const router = useRouter();
  const me = useSession((s) => s.profile);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ id: string; pseudo: string }[]>([]);

  // Recherche dès 2 caractères, avec un petit délai pour ne pas interroger la base à chaque lettre.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || !supabase) {
      setResults([]);
      return;
    }
    const client = supabase;
    const id = setTimeout(() => {
      void client
        .from('profiles')
        .select('id, pseudo')
        .ilike('pseudo', `%${q.replace(/[%\\]/g, '')}%`)
        .neq('id', me?.id ?? '')
        .order('pseudo')
        .limit(8)
        .then(({ data }) => setResults((data as { id: string; pseudo: string }[] | null) ?? []));
    }, 250);
    return () => clearTimeout(id);
  }, [query, me?.id]);

  return (
    <Card title="Nouveau message">
      <Field value={query} onChangeText={setQuery} placeholder="Pseudo du joueur" autoCapitalize="none" autoCorrect={false} />
      {results.map((player) => (
        <Pressable
          key={player.id}
          onPress={() => {
            setQuery('');
            router.push({ pathname: '/messages/[id]', params: { id: player.id, pseudo: player.pseudo } });
          }}
          style={({ pressed }) => [styles.result, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
        >
          <Text style={styles.pseudo}>{player.pseudo}</Text>
          <Text style={styles.time}>Écrire ›</Text>
        </Pressable>
      ))}
      {query.trim().length >= 2 && results.length === 0 && <Muted>Aucun joueur trouvé.</Muted>}
    </Card>
  );
}

/** Heure si c'est aujourd'hui, sinon la date. */
function formatWhen(iso: string): string {
  const date = new Date(iso);
  const today = new Date().toDateString() === date.toDateString();
  return today
    ? date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  result: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  pseudo: { color: colors.text, fontWeight: '700', fontSize: 15 },
  time: { color: colors.textMuted, fontSize: 12 },
  preview: { color: colors.textMuted, fontSize: 14 },
  previewUnread: { color: colors.text, fontWeight: '600' },
  badge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.accentText, fontSize: 12, fontWeight: '800' },
});
