import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

// Web : pas de clavier virtuel à éviter. Les apps iOS / Android utilisent keyboard.native.tsx.
export { KeyboardAvoidingView } from 'react-native';

export function KeyboardProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function KeyboardSpacer({ minHeight = 0, style }: { minHeight?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[style, { height: minHeight }]} />;
}
