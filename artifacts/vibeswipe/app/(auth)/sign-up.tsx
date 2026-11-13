import { useSignUp } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useColors } from "@/hooks/useColors";

export default function SignUpScreen() {
  const colors = useColors();
  const { signUp, errors, fetchStatus } = useSignUp();
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const verifying = signUp.status === "missing_requirements" &&
    signUp.unverifiedFields.includes("email_address") &&
    signUp.missingFields.length === 0;

  async function createAccount() {
    setMessage("");
    const { error } = await signUp.password({ emailAddress, password });
    if (error) {
      setMessage(errors.fields.emailAddress?.message ?? errors.fields.password?.message ?? "Check your email and password.");
      return;
    }
    await signUp.verifications.sendEmailCode();
  }

  async function verifyAccount() {
    const { error } = await signUp.verifications.verifyEmailCode({ code });
    if (error) {
      setMessage(errors.fields.code?.message ?? "That code didn’t work. Try again.");
      return;
    }
    if (signUp.status === "complete") {
      await signUp.finalize({
        navigate: ({ session, decorateUrl }) => {
          if (session?.currentTask) return;
          router.replace(decorateUrl("/") as never);
        },
      });
    }
  }

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      bottomOffset={24}
    >
      <Pressable style={styles.back} onPress={() => router.replace("/")}>
        <Feather name="arrow-left" size={20} color={colors.foreground} />
      </Pressable>
      <Text style={[styles.eyebrow, { color: colors.primary }]}>JOIN VIBESWIPE</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>
        {verifying ? "Check your inbox." : "Make room for a real connection."}
      </Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        {verifying
          ? `We sent a code to ${emailAddress}.`
          : "Create an account to meet people and start a conversation."}
      </Text>
      {verifying ? (
        <>
          <Text style={[styles.label, { color: colors.foreground }]}>Verification code</Text>
          <TextInput
            testID="verification-code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            placeholder="Enter your code"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
          />
        </>
      ) : (
        <>
          <Text style={[styles.label, { color: colors.foreground }]}>Email</Text>
          <TextInput
            testID="sign-up-email"
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
            testID="sign-up-password"
            secureTextEntry
            autoComplete="new-password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
          />
        </>
      )}
      {message ? <Text style={[styles.error, { color: colors.destructive }]}>{message}</Text> : null}
      <View nativeID="clerk-captcha" />
      <Pressable
        testID="submit-sign-up"
        onPress={verifying ? verifyAccount : createAccount}
        disabled={fetchStatus === "fetching" || (!verifying && (!emailAddress || !password)) || (verifying && !code)}
        style={[styles.submit, { backgroundColor: colors.primary, opacity: fetchStatus === "fetching" ? 0.6 : 1 }]}
      >
        {fetchStatus === "fetching" ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.submitText}>{verifying ? "Verify email" : "Create account"}</Text>
        )}
      </Pressable>
      {verifying ? (
        <Pressable onPress={() => signUp.verifications.sendEmailCode()} style={styles.resend}>
          <Text style={[styles.link, { color: colors.primary }]}>Send a new code</Text>
        </Pressable>
      ) : null}
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.mutedForeground }]}>Already here? </Text>
        <Link href="/(auth)/sign-in" asChild>
          <Pressable><Text style={[styles.link, { color: colors.primary }]}>Sign in</Text></Pressable>
        </Link>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingTop: 60, paddingBottom: 36 },
  back: { marginBottom: 35, width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 2.3, marginBottom: 10 },
  title: { fontSize: 32, fontWeight: "700", lineHeight: 38, letterSpacing: -0.7 },
  subtitle: { fontSize: 15, lineHeight: 22, marginTop: 9, marginBottom: 24 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 8, marginTop: 12 },
  input: { height: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontSize: 15 },
  error: { fontSize: 13, marginTop: 12 },
  submit: { height: 54, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 24 },
  submitText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
  resend: { alignItems: "center", padding: 14 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 18 },
  footerText: { fontSize: 13 },
  link: { fontSize: 13, fontWeight: "700" },
});
