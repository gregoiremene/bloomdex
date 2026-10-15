import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '@/auth/session';
import { Button, Chips, Field, KeyboardAvoider, Muted } from '@/ui/components';
import { colors, spacing } from '@/ui/theme';

type Mode = 'signIn' | 'signUp' | 'reset';

export default function LoginScreen() {
  const session = useSession((s) => s.session);
  const signIn = useSession((s) => s.signIn);
  const signUp = useSession((s) => s.signUp);
  const recovering = useSession((s) => s.recovering);
  const requestPasswordReset = useSession((s) => s.requestPasswordReset);
  const resetPassword = useSession((s) => s.resetPassword);
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pseudo, setPseudo] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Pendant une réinitialisation, la session existe déjà mais le nouveau mot de passe n'est pas encore choisi.
  if (session && !recovering) return <Redirect href="/" />;

  async function submit() {
    setLoading(true);
    setMessage(null);
    const error = mode === 'signIn' ? await signIn(email.trim(), password) : await signUp(email.trim(), password, pseudo.trim());
    setLoading(false);
    if (error) setMessage(error);
  }

  async function sendCode() {
    setLoading(true);
    setMessage(null);
    const error = await requestPasswordReset(email.trim());
    setLoading(false);
    if (error) return setMessage(error);
    setCodeSent(true);
    setMessage(`Si un compte existe pour ${email.trim()}, un code vient d'y être envoyé.`);
  }

  async function submitReset() {
    setLoading(true);
    setMessage(null);
    const error = await resetPassword(email.trim(), code.trim(), password);
    setLoading(false);
    if (error) setMessage(error);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setMessage(null);
    setPassword('');
    setCode('');
    setCodeSent(false);
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoider style={styles.content}>
        <Text style={styles.title}>WeedApp</Text>
        <Muted>Cultive, deale, échappe aux stups… et méfie-toi de tes potes.</Muted>
        {mode === 'reset' ? (
          <>
            <Text style={styles.subtitle}>Mot de passe oublié</Text>
            <Muted>
              {codeSent
                ? "Entre le code reçu par email et choisis ton nouveau mot de passe."
                : "Entre l'email de ton compte : on t'envoie un code pour choisir un nouveau mot de passe."}
            </Muted>
            <View style={{ gap: spacing.md }}>
              <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" editable={!codeSent} />
              {codeSent && (
                <>
                  <Field label="Code reçu par email" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" maxLength={10} />
                  <Field label="Nouveau mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
                </>
              )}
            </View>
            {message ? <Text style={styles.message}>{message}</Text> : null}
            {codeSent ? (
              <>
                <Button label="Changer mon mot de passe" onPress={submitReset} loading={loading} disabled={!code || !password} />
                <LinkText label="Renvoyer un code" onPress={sendCode} />
              </>
            ) : (
              <Button label="Envoyer le code" onPress={sendCode} loading={loading} disabled={!email} />
            )}
            <LinkText label="← Retour à la connexion" onPress={() => switchMode('signIn')} />
          </>
        ) : (
          <>
            <Chips
              options={[
                { value: 'signIn', label: 'Connexion' },
                { value: 'signUp', label: 'Inscription' },
              ]}
              value={mode}
              onChange={switchMode}
            />
            <View style={{ gap: spacing.md }}>
              {mode === 'signUp' && (
                <Field label="Pseudo" value={pseudo} onChangeText={setPseudo} autoCapitalize="none" autoCorrect={false} maxLength={20} />
              )}
              <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
              <Field label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'signUp' ? 'new-password' : 'password'} />
            </View>
            {message ? <Text style={styles.message}>{message}</Text> : null}
            <Button label={mode === 'signIn' ? 'Se connecter' : 'Créer mon compte'} onPress={submit} loading={loading} disabled={!email || !password} />
            {mode === 'signIn' && <LinkText label="Mot de passe oublié ?" onPress={() => switchMode('reset')} />}
          </>
        )}
      </KeyboardAvoider>
    </SafeAreaView>
  );
}

function LinkText({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="link" style={{ alignSelf: 'center' }}>
      <Text style={styles.link}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, padding: spacing.xl, gap: spacing.lg, justifyContent: 'center' },
  title: { color: colors.accent, fontSize: 34, fontWeight: '800' },
  subtitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  message: { color: colors.warning, fontSize: 14 },
  link: { color: colors.accent, fontSize: 14, fontWeight: '600' },
});
