import type { StyleProp, ViewStyle } from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

// iOS / Android : gestion du clavier fiable, y compris sur Android en plein écran (edge-to-edge),
// où le KeyboardAvoidingView de React Native calcule mal la position du clavier.
// Le web utilise keyboard.tsx (cette bibliothèque est native).
export { KeyboardAvoidingView, KeyboardProvider } from 'react-native-keyboard-controller';

/**
 * Espace à placer tout en bas d'un écran qui descend jusqu'au bas de l'écran (sans barre d'onglets) :
 * il prend exactement la hauteur du clavier quand il est ouvert, et au moins `minHeight` sinon
 * (la barre de navigation du système). Pas de calcul de position : rien ne peut se tromper de repère.
 */
export function KeyboardSpacer({ minHeight = 0, style }: { minHeight?: number; style?: StyleProp<ViewStyle> }) {
  const { height } = useReanimatedKeyboardAnimation();
  // `height` va de 0 à −(hauteur du clavier).
  const animated = useAnimatedStyle(() => ({ height: Math.max(Math.abs(height.value), minHeight) }));
  return <Animated.View style={[style, animated]} />;
}
