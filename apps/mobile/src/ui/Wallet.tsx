import { policeIndexMax, VARIETY_IDS } from '@weedapp/engine';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fmt, grams, varietyName, wl } from '@/game/labels';
import { useGameState } from '@/game/store';
import { ProgressBar } from './components';
import { colors, radius, spacing } from './theme';

/** Bouton du header : ouvre « Ma bourse » (weedlars, beuh par variété, indice police). */
export function WalletButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={10} style={styles.button} accessibilityRole="button" accessibilityLabel="Ma bourse">
        <Text style={styles.buttonIcon}>👛</Text>
      </Pressable>
      <WalletModal visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

function WalletModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const state = useGameState();
  if (!state) return null;
  const totalGrams = VARIETY_IDS.reduce((sum, v) => sum + state.stock[v], 0);
  const max = policeIndexMax(state);
  const ratio = state.policeIndex / max;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer" />
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>👛 Ma bourse</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Fermer">
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <View style={[styles.line, styles.moneyLine]}>
            <Text style={styles.label}>Weedlars</Text>
            <Text style={[styles.money, state.money < 0 && { color: colors.danger }]}>{wl(state.money)}</Text>
          </View>

          {/* Toutes les variétés, dans l'ordre du catalogue ; celles à 0 g sont estompées. */}
          <ScrollView style={styles.list} contentContainerStyle={styles.section}>
            {VARIETY_IDS.map((v) => {
              const empty = state.stock[v] <= 0;
              return (
                <View key={v} style={styles.line}>
                  <Text style={[styles.label, empty && styles.empty]}>{varietyName(v)}</Text>
                  <Text style={[styles.value, empty && styles.empty]}>{grams(state.stock[v])}</Text>
                </View>
              );
            })}
          </ScrollView>
          <View style={[styles.line, styles.totalLine]}>
            <Text style={styles.muted}>Total</Text>
            <Text style={styles.muted}>{grams(totalGrams)}</Text>
          </View>

          <View style={styles.police}>
            <View style={styles.line}>
              <Text style={styles.label}>Indice police</Text>
              <Text style={[styles.value, ratio > 0.8 ? { color: colors.danger } : ratio > 0.5 ? { color: colors.warning } : null]}>
                {fmt(state.policeIndex)} / {fmt(max)}
              </Text>
            </View>
            <ProgressBar value={ratio} tone={ratio > 0.8 ? 'danger' : ratio > 0.5 ? 'warning' : 'info'} />
            {state.raidPending && <Text style={styles.alert}>🚨 Les stups arrivent à la prochaine actualisation !</Text>}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  button: { paddingHorizontal: spacing.lg },
  buttonIcon: { fontSize: 22 },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: 'rgba(0,0,0,0.6)' },
  card: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg * 1.5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  close: { color: colors.textMuted, fontSize: 18, fontWeight: '700' },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  moneyLine: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.background },
  money: { color: colors.accent, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  list: { flexGrow: 0, flexShrink: 1 },
  section: { gap: spacing.sm },
  empty: { color: colors.textMuted, fontWeight: '400' },
  totalLine: { paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  label: { color: colors.text, fontSize: 15, fontWeight: '600', flexShrink: 1 },
  value: { color: colors.text, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  muted: { color: colors.textMuted, fontSize: 14 },
  police: { gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  alert: { color: colors.danger, fontWeight: '700', fontSize: 13 },
});
