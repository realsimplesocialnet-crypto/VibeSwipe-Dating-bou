import { useSignIn } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { signIn, errors, fetchStatus } = useSignIn();
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function submit() {
    setMessage("");
    const { error } = await signIn.password({ emailAddress, password });
    if (error) {
      setMessage(errors.fields.identifier?.message ?? "Check your email and password.");
      return;
    }
    if (signIn.status === "complete") {
      await signIn.finalize({
        navigate: ({ session, decorateUrl }) => {
          if (session?.currentTask) return;
          router.replace(decorateUrl("/") as never);
        },
      });
    } else if (signIn.status === "needs_client_trust") {
      setMessage("Complete the verification step to continue.");
    } else {
      setMessage("This sign-in needs another verification step.");
    }
  }

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { paddingTop: (Platform.OS === "web" ? 67 : insets.top) + 16, paddingBottom: Math.max(insets.bottom, 16) + 20 }]}
      bottomOffset={24}
    >
      <Pressable style={styles.back} onPress={() => router.replace("/")}>
        <Feather name="arrow-left" size={20} color={colors.foreground} />
      </Pressable>
      <Text style={[styles.eyebrow, { color: colors.primary }]}>WELCOME BACK</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>Your feed is waiting.</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Sign in to catch up on photos, Reels, and messages.
      </Text>
      <Text style={[styles.label, { color: colors.foreground }]}>Email</Text>
      <TextInput
        testID="sign-in-email"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        value={emailAddress}
        onChangeText={setEmailAddress}
        placeholder="you@example.com"
        placeholderTextColor={colors.mutedForeground}
        style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
      />
      <Text style={[styles.label, { color: colors.foreground }]}>Password</Text>
      <TextInput
        testID="sign-in-password"
        secureTextEntry
        autoComplete="current-password"
        value={password}
        onChangeText={setPassword}
        placeholder="Your password"
        placeholderTextColor={colors.mutedForeground}
        style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
      />
      {message || errors.fields.password?.message ? (
        <Text style={[styles.error, { color: colors.destructive }]}>
          {message || errors.fields.password?.message}
        </Text>
      ) : null}
      <Pressable
        testID="submit-sign-in"
        onPress={submit}
        disabled={!emailAddress || !password || fetchStatus === "fetching"}
        style={[styles.submit, { backgroundColor: colors.primary, opacity: fetchStatus === "fetching" ? 0.6 : 1 }]}
      >
        {fetchStatus === "fetching" ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.submitText}>Sign in</Text>
        )}
      </Pressable>
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
          New to MyAgeBeauty?{" "}
        </Text>
        <Link href="/(auth)/sign-up" asChild>
          <Pressable><Text style={[styles.link, { color: colors.primary }]}>Create account</Text></Pressable>
        </Link>
      </View>
      <View style={styles.legalLinks}>
        <Link href="/privacy-policy" asChild>
          <Pressable><Text style={[styles.legalLink, { color: colors.mutedForeground }]}>Privacy Policy</Text></Pressable>
        </Link>
        <Text style={[styles.legalDot, { color: colors.mutedForeground }]}>·</Text>
        <Link href="/terms" asChild>
          <Pressable><Text style={[styles.legalLink, { color: colors.mutedForeground }]}>Terms of Service</Text></Pressable>
        </Link>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24 },
  back: { marginBottom: 35, width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 2.3, marginBottom: 10 },
  title: { fontSize: 32, fontWeight: "700", lineHeight: 38, letterSpacing: -0.7 },
  subtitle: { fontSize: 15, marginTop: 8, marginBottom: 26 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 8, marginTop: 12 },
  input: { height: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontSize: 15 },
  error: { fontSize: 13, marginTop: 12 },
  submit: { height: 54, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 22 },
  submitText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  footerText: { fontSize: 13 },
  link: { fontSize: 13, fontWeight: "700" },
  legalLinks: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10, marginTop: 20 },
  legalLink: { fontSize: 11, fontWeight: "600" },
  legalDot: { fontSize: 11 },
});
