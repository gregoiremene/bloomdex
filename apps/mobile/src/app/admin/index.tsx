import { HOUSINGS, type GameState } from '@weedapp/engine';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/auth/session';
import { wl } from '@/game/labels';
import { supabase } from '@/lib/supabase';
import { Button, Card, Field, Muted, Row, Screen } from '@/ui/components';
import { colors, spacing } from '@/ui/theme';

export interface AdminPlayerRow {
  user_id: string;
  state: GameState;
  updated_at: string;
  profiles: { pseudo: string; role: string; created_at: string } | null;
}

/** Page admin : tous les joueurs, la dernière activité en premier. Lecture seule. */
export default function AdminScreen() {
  const role = useSession((s) => s.profile?.role);
  const router = useRouter();
  const [rows, setRows] = useState<AdminPlayerRow[]>([]);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error: err } = await supabase
      .from('player_states')
      .select('user_id, state, updated_at, profiles(pseudo, role, created_at)')
      .order('updated_at', { ascending: false })
      .limit(500);
    if (err) setError(err.message);
    else setRows((data as unknown as AdminPlayerRow[] | null) ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (role !== 'admin') {
    return (
      <Screen>
        <Card>
          <Muted>Réservé aux admins.</Muted>
        </Card>
      </Screen>
    );
  }

  const q = query.trim().toLowerCase();
  const shown = q ? rows.filter((r) => r.profiles?.pseudo.toLowerCase().includes(q)) : rows;

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      <Row>
        <Field value={query} onChangeText={setQuery} placeholder="Chercher un pseudo" autoCapitalize="none" autoCorrect={false} />
        {/* Tirer pour rafraîchir n'existe pas à la souris : bouton pour le web. */}
        <Button
          label="Rafraîchir"
          variant="secondary"
          loading={refreshing}
          onPress={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      </Row>
      <Muted>
        {rows.length} partie(s) · bourse et livret au dernier enregistrement (la fiche du joueur les met à jour à l'heure actuelle).
      </Muted>
      {error && <Text style={{ color: colors.danger }}>{error}</Text>}
      <Card>
        {shown.map((row) => (
          <Pressable
            key={row.user_id}
            onPress={() => router.push({ pathname: '/admin/[id]', params: { id: row.user_id } })}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.pseudo}>
                {row.profiles?.pseudo ?? '?'}
                {row.profiles && row.profiles.role !== 'player' ? <Text style={styles.role}> · {row.profiles.role}</Text> : null}
              </Text>
              <Muted>
                {HOUSINGS[row.state.housing]?.name ?? row.state.housing} · {wl(row.state.money)} · livret {wl(row.state.bankBalance)}
              </Muted>
            </View>
            <Text style={styles.when}>{ago(row.updated_at)}</Text>
          </Pressable>
        ))}
        {shown.length === 0 && <Muted>Aucun joueur.</Muted>}
      </Card>
    </Screen>
  );
}

/** « il y a 3 h », « il y a 2 j »… */
export function ago(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `il y a ${hours} h`;
  return `il y a ${Math.round(hours / 24)} j`;
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
  pseudo: { color: colors.text, fontWeight: '700', fontSize: 15 },
  role: { color: colors.warning, fontWeight: '600', fontSize: 13 },
  when: { color: colors.textMuted, fontSize: 12 },
});
