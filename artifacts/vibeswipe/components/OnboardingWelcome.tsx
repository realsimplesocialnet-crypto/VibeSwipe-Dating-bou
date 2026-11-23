import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { OnboardingVideoBackground } from "./OnboardingVideoBackground";

export function OnboardingWelcome() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { height } = useWindowDimensions();
  return <View style={[styles.root, { backgroundColor: colors.background }]}>
    <OnboardingVideoBackground/>
    <View style={[styles.brand, { paddingTop: insets.top + 21 }]}>
      <View style={[styles.icon, { backgroundColor: colors.primary }]}><Text style={[styles.iconText, { color: colors.primaryForeground }]}>M</Text></View>
      <Text style={[styles.wordmark, { color: colors.foreground }]}>MyAgeBeauty</Text>
    </View>
    <Text style={[styles.preview, { top: insets.top + 74 }]}>ONBOARDING PREVIEW</Text>
    <LinearGradient colors={["rgba(15,15,18,0)", colors.background, colors.background]}
      locations={[0, .2, 1]} style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom) }]}>
      <View style={styles.footerInner}>
        <Text style={[styles.heading, { color: colors.foreground }, height < 650 && { fontSize: 24 }]}>Your community starts here.</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Share photos and videos. Follow people and join conversations.</Text>
        <View style={styles.actions}>
          <Pressable testID="create-account" accessibilityRole="button" style={[styles.button, styles.primary, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/(auth)/sign-up")}>
            <Feather name="user-plus" size={17} color={colors.primaryForeground}/>
            <Text style={[styles.primaryText, { color: colors.primaryForeground }]}>Get Started</Text>
          </Pressable>
          <Pressable testID="sign-in" accessibilityRole="button" style={[styles.button, styles.secondary, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push("/(auth)/sign-in")}>
            <Feather name="lock" size={16} color={colors.foreground}/>
            <Text style={[styles.secondaryText, { color: colors.foreground }]}>Log in</Text>
          </Pressable>
        </View>
        <View style={styles.legal}>
          <Text style={[styles.legalText, { color: colors.mutedForeground }]}>Adults 18+ ·</Text>
          <Pressable onPress={() => router.push("/privacy-policy")} testID="privacy-policy"><Text style={[styles.legalLink, { color: colors.mutedForeground }]}>Privacy Policy</Text></Pressable>
          <Text style={[styles.legalText, { color: colors.mutedForeground }]}>·</Text>
          <Pressable onPress={() => router.push("/terms")} testID="terms-of-service"><Text style={[styles.legalLink, { color: colors.mutedForeground }]}>Terms</Text></Pressable>
        </View>
      </View>
    </LinearGradient>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  brand: { flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 24 },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  iconText: { fontSize: 19, fontWeight: "900" },
  wordmark: { color: "#111111", fontSize: 22, fontWeight: "800", letterSpacing: -1 },
  preview: { position: "absolute", left: 24, fontSize: 10, letterSpacing: 1.2, color: "#666666" },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, paddingTop: 52, paddingHorizontal: 24 },
  footerInner: { width: "100%", maxWidth: 400, alignSelf: "center", alignItems: "center" },
  heading: { color: "#111111", fontSize: 30, lineHeight: 33, fontWeight: "800", textAlign: "center", letterSpacing: -1 },
  subtitle: { color: "#666666", fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: 8, marginBottom: 16 },
  actions: { flexDirection: "row", width: "100%", gap: 12 },
  button: { flex: 1, minHeight: 54, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  primary: { backgroundColor: "#111111" },
  secondary: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D9D9D9" },
  primaryText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  secondaryText: { color: "#111111", fontSize: 14, fontWeight: "700" },
  legal: { marginTop: 14, flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 4 },
  legalText: { color: "#666666", fontSize: 10 },
  legalLink: { color: "#666666", fontSize: 10, textDecorationLine: "underline" },
});
