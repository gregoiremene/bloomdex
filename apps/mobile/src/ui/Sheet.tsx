import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Notice } from './Notice';
import { colors, radius, spacing } from './theme';

/**
 * Modale en bas d'écran (bottom sheet). Toucher le fond la ferme.
 * Le bandeau de retour d'action est réaffiché ici : la modale passe au-dessus de celui de l'écran.
 */
export function Sheet({ visible, onClose, title, icon, children }: { visible: boolean; onClose: () => void; title: string; icon?: ReactNode; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.root} behavior="padding" enabled={Platform.OS !== 'web'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            {typeof icon === 'string' ? <Text style={styles.icon}>{icon}</Text> : icon}
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Fermer">
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
        <Notice />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg * 1.5,
    borderTopRightRadius: radius.lg * 1.5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingTop: spacing.sm,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  icon: { fontSize: 28 },
  title: { flex: 1, color: colors.text, fontSize: 20, fontWeight: '800' },
  close: { color: colors.textMuted, fontSize: 18, fontWeight: '700' },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, gap: spacing.md },
});
