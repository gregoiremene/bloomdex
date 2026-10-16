import { HeaderHeightContext } from '@react-navigation/elements';
import { useContext, useRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { KeyboardAvoidingView } from './keyboard';
import { colors, radius, spacing } from './theme';

/** Distance du bas (px) à partir de laquelle on charge la suite d'une liste. */
const END_REACHED_THRESHOLD = 600;

/**
 * Remonte le contenu au-dessus du clavier (iOS et Android, sans effet sur le web).
 * Le décalage compense l'en-tête de navigation, que la vue ne voit pas dans son propre cadre.
 */
export function KeyboardAvoider({ children, style, enabled = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; enabled?: boolean }) {
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  return (
    <KeyboardAvoidingView
      style={[{ flex: 1 }, style]}
      behavior="padding"
      enabled={enabled && Platform.OS !== 'web'}
      keyboardVerticalOffset={headerHeight}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

export function Screen({
  children,
  onRefresh,
  refreshing = false,
  onEndReached,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Appelé quand on approche du bas (chargement progressif d'une longue liste). */
  onEndReached?: () => void;
}) {
  // Une seule fois par hauteur de contenu : on attend que la suite soit affichée avant de redemander.
  const firedAt = useRef(-1);
  const onScroll = ({ nativeEvent: { layoutMeasurement, contentOffset, contentSize } }: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!onEndReached || firedAt.current === contentSize.height) return;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - END_REACHED_THRESHOLD) {
      firedAt.current = contentSize.height;
      onEndReached();
    }
  };
  // iOS : la ScrollView ajuste ses marges et défile jusqu'au champ actif. Android : on réduit la vue,
  // et la ScrollView native amène d'elle-même le champ actif à l'écran.
  return (
    <KeyboardAvoider enabled={Platform.OS === 'android'}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.screenContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        automaticallyAdjustKeyboardInsets
        onScroll={onEndReached ? onScroll : undefined}
        scrollEventThrottle={100}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} /> : undefined}
      >
        {children}
      </ScrollView>
    </KeyboardAvoider>
  );
}

export function Card({ title, right, children, style }: { title?: string; right?: ReactNode; children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.card, style]}>
      {(title || right) && (
        <View style={styles.cardHeader}>
          {title ? <Text style={styles.cardTitle}>{title}</Text> : <View />}
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  compact,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        (pressed || inactive) && { opacity: inactive ? 0.45 : 0.75 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.accentText : colors.text} />
      ) : (
        <Text style={[styles.buttonLabel, variant === 'primary' && { color: colors.accentText }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Row({ children, gap = spacing.sm, wrap }: { children: ReactNode; gap?: number; wrap?: boolean }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : 'nowrap' }}>{children}</View>;
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: 'warning' | 'danger' | 'accent' }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, tone && { color: colors[tone] }]}>{value}</Text>
    </View>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Body({ children, bold }: { children: ReactNode; bold?: boolean }) {
  return <Text style={[styles.body, bold && { fontWeight: '700' }]}>{children}</Text>;
}

export function Field(props: TextInputProps & { label?: string }) {
  const { label, style, ...rest } = props;
  return (
    // flexGrow/flexShrink plutôt que flex: 1 : sur natif, flexBasis 0 écrase la hauteur dans une colonne.
    <View style={{ gap: spacing.xs, flexGrow: 1, flexShrink: 1 }}>
      {label ? <Text style={styles.muted}>{label}</Text> : null}
      <TextInput placeholderTextColor={colors.textMuted} style={[styles.input, style]} {...rest} />
    </View>
  );
}

/** Sélecteur en pastilles (variété, taille de pot, quantité…). */
export function Chips<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <Row wrap gap={spacing.xs}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            style={[styles.chip, selected && styles.chipSelected]}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.chipLabel, selected && { color: colors.accentText }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </Row>
  );
}

/** Bulles flottantes en bas d'un écran (ex. stades de culture), avec un compteur optionnel. */
export function BubbleTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: readonly { value: T; label: string; icon?: ReactNode; count?: number; alert?: boolean }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.bubbles} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            onPress={() => onChange(tab.value)}
            style={({ pressed }) => [styles.bubble, selected && styles.bubbleSelected, pressed && { opacity: 0.8 }]}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={tab.count !== undefined ? `${tab.label}, ${tab.count}` : tab.label}
          >
            {tab.icon}
            <Text style={[styles.bubbleLabel, selected && { color: colors.accentText }]} numberOfLines={1}>
              {tab.label}
            </Text>
            {tab.count !== undefined && tab.count > 0 && (
              <View style={[styles.bubbleBadge, tab.alert && { backgroundColor: colors.danger }]}>
                <Text style={styles.bubbleBadgeText}>{tab.count}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Grille de tuiles, 2 par ligne. */
export function TileGrid({ children }: { children: ReactNode }) {
  return <View style={styles.tileGrid}>{children}</View>;
}

/** Gros bouton carré : logo, nom, sous-titre et pastille optionnelle. */
export function Tile({
  icon,
  title,
  subtitle,
  badge,
  badgeTone = 'accent',
  count,
  dimmed,
  onPress,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeTone?: 'accent' | 'warning' | 'danger' | 'muted';
  /** Bulle rouge bien visible en haut à droite (ex. messages non lus) ; masquée à 0. */
  count?: number;
  dimmed?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.tile, dimmed && { opacity: 0.55 }, pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]}
    >
      {badge ? (
        <Text style={[styles.tileBadge, { color: badgeTone === 'muted' ? colors.textMuted : colors[badgeTone] }]} numberOfLines={1}>
          {badge}
        </Text>
      ) : null}
      {count ? (
        <View style={styles.tileCount} accessibilityLabel={`${count} non lu(s)`}>
          <Text style={styles.tileCountText}>{count > 99 ? '99+' : count}</Text>
        </View>
      ) : null}
      <View style={styles.tileIcon}>{typeof icon === 'string' ? <Text style={styles.tileEmoji}>{icon}</Text> : icon}</View>
      <Text style={styles.tileTitle} numberOfLines={2}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.muted, { textAlign: 'center' }]} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Choix d'une quantité : − / valeur / +, et raccourcis (`presets={[]}` pour les masquer). */
export function Stepper({ value, onChange, min = 1, max = 9999, presets = [1, 5, 10, 50] }: { value: number; onChange: (value: number) => void; min?: number; max?: number; presets?: readonly number[] }) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const shortcuts = presets.filter((p) => p <= max);
  return (
    <View style={{ gap: spacing.sm }}>
      <Row>
        <Button label="−" variant="secondary" disabled={value <= min} onPress={() => onChange(clamp(value - 1))} />
        <TextInput
          value={String(value)}
          onChangeText={(text) => onChange(clamp(Number.parseInt(text, 10) || min))}
          keyboardType="number-pad"
          selectTextOnFocus
          style={[styles.input, styles.stepperInput]}
        />
        <Button label="+" variant="secondary" disabled={value >= max} onPress={() => onChange(clamp(value + 1))} />
      </Row>
      {shortcuts.length > 0 && <Chips options={shortcuts.map((p) => ({ value: p, label: `×${p}` }))} value={value} onChange={(p) => onChange(clamp(p))} />}
    </View>
  );
}

export function ProgressBar({ value, tone = 'accent' }: { value: number; tone?: 'accent' | 'warning' | 'danger' | 'info' }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View style={styles.progress}>
      <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: colors[tone] }]} />
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  screenContent: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  button: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCompact: { minHeight: 36, paddingHorizontal: spacing.md },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonSecondary: { backgroundColor: colors.surfaceRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  buttonDanger: { backgroundColor: '#5A2420' },
  buttonLabel: { color: colors.text, fontWeight: '700', fontSize: 15 },
  stat: { flex: 1, minWidth: 90, gap: 2 },
  statLabel: { color: colors.textMuted, fontSize: 12 },
  statValue: { color: colors.text, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  muted: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  body: { color: colors.text, fontSize: 15, lineHeight: 21 },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    fontSize: 16,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipLabel: { color: colors.text, fontSize: 13, fontWeight: '600' },
  bubbles: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingLeft: 6,
    paddingRight: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.text,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  bubbleSelected: { backgroundColor: colors.warning, borderColor: colors.text },
  bubbleLabel: { color: colors.text, fontSize: 12, fontWeight: '700' },
  bubbleBadge: {
    position: 'absolute',
    top: -6,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.info,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleBadgeText: { color: colors.accentText, fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.md },
  tile: {
    width: '48%',
    aspectRatio: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tileIcon: { height: 56, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  tileEmoji: { fontSize: 44 },
  tileTitle: { color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  tileCount: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    minWidth: 30,
    height: 30,
    paddingHorizontal: 8,
    borderRadius: 15,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  tileCountText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', fontVariant: ['tabular-nums'] },
  tileBadge: { position: 'absolute', top: spacing.sm, right: spacing.md, fontSize: 12, fontWeight: '700' },
  stepperInput: { flex: 1, textAlign: 'center', fontWeight: '700' },
  progress: { height: 6, borderRadius: 3, backgroundColor: colors.background, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
});
