import { useSignUp } from "@clerk/expo";
import { OnboardingVideoBackground } from "@/components/OnboardingVideoBackground";
import { Feather } from "@expo/vector-icons";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useColors } from "@/hooks/useColors";

export default function SignUpScreen() {
  const colors = useColors();
  const { height } = useWindowDimensions();
  const animationSpaceHeight = Math.min(420, Math.max(250, height * 0.4));
  const { signUp, errors, fetchStatus } = useSignUp();
  const { ref } = useLocalSearchParams<{ ref?: string | string[] }>();
  const referralFromUrl = (Array.isArray(ref) ? ref[0] : ref ?? "")
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 8);
  const [step, setStep] = useState<"email" | "password">("email");
  const [emailAddress, setEmailAddress] = useState("");
  const [referralCode, setReferralCode] = useState(referralFromUrl);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(true);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const normalizedEmail = emailAddress.trim();
  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizedEmail);
  const passwordIsTooShort = password.length > 0 && password.length < 15;
  const verifying = signUp.status === "missing_requirements" &&
    signUp.unverifiedFields.includes("email_address") &&
    signUp.missingFields.length === 0;
  const submitDisabled =
    fetchStatus === "fetching" ||
    (verifying && !code) ||
    (!verifying && step === "email" && !emailIsValid) ||
    (!verifying && step === "password" && password.length < 15);

  function continueToPassword() {
    setMessage("");
    if (!emailIsValid) {
      setMessage("Enter a valid email address.");
      return;
    }
    setStep("password");
  }

  async function createAccount() {
    setMessage("");
    if (!emailIsValid) {
      setMessage("Enter a valid email address.");
      return;
    }
    if (password.length < 15) {
      setMessage("Password must be at least 15 characters");
      return;
    }
    const { error } = await signUp.password({ emailAddress: normalizedEmail, password });
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
          const next = referralCode
            ? `/onboarding?ref=${encodeURIComponent(referralCode.trim().toUpperCase())}`
            : "/onboarding";
          router.replace(decorateUrl(next) as never);
        },
      });
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <OnboardingVideoBackground form/>
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: "transparent" }}
      contentContainerStyle={styles.container}
      bottomOffset={24}
    >
      <View style={{ height: animationSpaceHeight }} />
      <View style={[styles.panel, { backgroundColor: colors.background, minHeight: height - animationSpaceHeight }]}>
      <Pressable
        testID="sign-up-back"
        style={styles.back}
        onPress={() => {
          if (!verifying && step === "password") {
            setMessage("");
            setStep("email");
            return;
          }
          router.replace("/");
        }}
      >
        <Feather name="arrow-left" size={20} color={colors.foreground} />
      </Pressable>
      <Text style={[styles.eyebrow, { color: colors.primary }]}>
        {verifying
          ? "EMAIL VERIFICATION"
          : `ACCOUNT SETUP · ${step === "email" ? "1" : "2"} OF 2`}
      </Text>
      {!verifying ? (
        <View style={styles.progressTrack} accessibilityLabel={`Step ${step === "email" ? "1" : "2"} of 2`}>
          <View style={[styles.progressSegment, { backgroundColor: colors.primary }]} />
          <View style={[styles.progressSegment, { backgroundColor: step === "password" ? colors.primary : colors.border }]} />
        </View>
      ) : null}
      <Text style={[styles.title, { color: colors.foreground }]}>
        {verifying
          ? "Check your inbox."
          : step === "email"
            ? "Start with your email."
            : "Create a password."}
      </Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        {verifying
          ? `We sent a code to ${emailAddress}.`
          : step === "email"
            ? "Enter your email to begin creating your account."
            : "Choose a password with at least 15 characters."}
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
      ) : step === "email" ? (
        <>
          <Text style={[styles.label, { color: colors.foreground }]}>Email</Text>
          <TextInput
            testID="sign-up-email"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            value={emailAddress}
            onChangeText={(value) => {
              setEmailAddress(value);
              setMessage("");
            }}
            placeholder="you@example.com"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
          />
          {emailAddress.length > 0 && !emailIsValid ? (
            <Text style={[styles.fieldError, { color: colors.destructive }]}>Enter a valid email address.</Text>
          ) : null}
          <Text style={[styles.label, { color: colors.foreground }]}>Referral code (optional)</Text>
          <TextInput
            testID="sign-up-referral-code"
            value={referralCode}
            onChangeText={(value) => setReferralCode(value.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 8))}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
            placeholder="8 characters"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
          />
          <Text style={[styles.passwordHint, { color: colors.mutedForeground }]}>Your friend earns 100 points when you join.</Text>
        </>
      ) : (
        <>
          <Text style={[styles.label, { color: colors.foreground }]}>Password</Text>
          <View style={[styles.passwordField, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <TextInput
              testID="sign-up-password"
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setMessage("");
              }}
              placeholder="At least 15 characters"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.passwordInput, { color: colors.foreground }]}
            />
            <Pressable
              testID="toggle-sign-up-password"
              accessibilityRole="button"
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              onPress={() => setShowPassword((visible) => !visible)}
              hitSlop={10}
              style={styles.passwordToggle}
            >
              <Feather name={showPassword ? "eye-off" : "eye"} size={19} color={colors.mutedForeground} />
            </Pressable>
          </View>
          {passwordIsTooShort ? (
            <Text style={[styles.fieldError, { color: colors.destructive }]}>Password must be at least 15 characters</Text>
          ) : password.length === 0 ? (
            <Text style={[styles.passwordHint, { color: colors.mutedForeground }]}>Use at least 15 characters.</Text>
          ) : null}
        </>
      )}
      {message ? <Text style={[styles.error, { color: colors.destructive }]}>{message}</Text> : null}
      <View nativeID="clerk-captcha" />
      <Pressable
        testID="submit-sign-up"
        onPress={verifying ? verifyAccount : step === "email" ? continueToPassword : createAccount}
        disabled={submitDisabled}
        style={[styles.submit, { backgroundColor: colors.primary, opacity: submitDisabled ? 0.6 : 1 }]}
      >
        {fetchStatus === "fetching" ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.submitText}>
            {verifying ? "Verify email" : step === "email" ? "Continue" : "Create account"}
          </Text>
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
      <View style={styles.legalLinks}>
        <Link href="/privacy-policy" asChild>
          <Pressable><Text style={[styles.legalLink, { color: colors.mutedForeground }]}>Privacy Policy</Text></Pressable>
        </Link>
        <Text style={[styles.legalLink, { color: colors.mutedForeground }]}>·</Text>
        <Link href="/terms" asChild>
          <Pressable><Text style={[styles.legalLink, { color: colors.mutedForeground }]}>Terms of Service</Text></Pressable>
        </Link>
      </View>
      </View>
    </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1 },
  panel: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 36, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  back: { marginBottom: 35, width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 2.3, marginBottom: 10 },
  progressTrack: { flexDirection: "row", gap: 7, marginBottom: 20 },
  progressSegment: { height: 3, flex: 1, borderRadius: 2 },
  title: { fontSize: 32, fontWeight: "700", lineHeight: 38, letterSpacing: -0.7 },
  subtitle: { fontSize: 15, lineHeight: 22, marginTop: 9, marginBottom: 24 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 8, marginTop: 12 },
  input: { height: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontSize: 15 },
  passwordField: { height: 52, borderWidth: 1, borderRadius: 14, flexDirection: "row", alignItems: "center", paddingLeft: 14, paddingRight: 12 },
  passwordInput: { flex: 1, height: "100%", fontSize: 15 },
  passwordToggle: { width: 34, height: 42, alignItems: "center", justifyContent: "center" },
  fieldError: { fontSize: 12, lineHeight: 17, marginTop: 6 },
  passwordHint: { fontSize: 12, lineHeight: 17, marginTop: 6 },
  error: { fontSize: 13, marginTop: 12 },
  submit: { height: 54, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 24 },
  submitText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
  resend: { alignItems: "center", padding: 14 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 18 },
  legalLinks: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10, marginTop: 18 },
  legalLink: { fontSize: 11, fontWeight: "600" },
  footerText: { fontSize: 13 },
  link: { fontSize: 13, fontWeight: "700" },
});
