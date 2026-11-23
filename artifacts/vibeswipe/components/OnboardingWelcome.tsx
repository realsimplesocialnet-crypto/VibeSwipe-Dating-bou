import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { OnboardingVideoBackground } from "./OnboardingVideoBackground";

export function OnboardingWelcome() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { height } = useWindowDimensions();
  return <View style={[styles.root, { backgroundColor: colors.background }]}>
    <OnboardingVideoBackground/>
    <View style={[styles.footer, { backgroundColor: colors.background, paddingBottom: Math.max(16, insets.bottom) }]}>
      <View style={styles.footerInner}>
        <View style={styles.brand}>
          <View style={[styles.icon, { backgroundColor: colors.primary }]}><Text style={[styles.iconText, { color: colors.primaryForeground }]}>M</Text></View>
          <Text style={[styles.wordmark, { color: colors.foreground }]}>MyAgeBeauty</Text>
        </View>
        <Text style={[styles.heading, { color: colors.foreground }, height < 650 && { fontSize: 24 }]}>Your community starts here.</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Share photos and videos. Follow people and join conversations.</Text>
        <View style={styles.actions}>
          <Pressable testID="create-account" accessibilityRole="button" style={[styles.button, styles.primary, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/(auth)/sign-up")}>
            <Feather name="user-plus" size={17} color={colors.primaryForeground}/>
            <Text style={[styles.primaryText, { color: colors.primaryForeground }]}>Create Account</Text>
          </Pressable>
          <Pressable testID="sign-in" accessibilityRole="button" style={[styles.button, styles.secondary, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push("/(auth)/sign-in")}>
            <Feather name="lock" size={16} color={colors.foreground}/>
            <Text style={[styles.secondaryText, { color: colors.foreground }]}>Login</Text>
          </Pressable>
        </View>
        <View style={styles.legal}>
          <Text style={[styles.legalText, { color: colors.mutedForeground }]}>Adults 18+ ·</Text>
          <Pressable onPress={() => router.push("/privacy-policy")} testID="privacy-policy"><Text style={[styles.legalLink, { color: colors.mutedForeground }]}>Privacy Policy</Text></Pressable>
          <Text style={[styles.legalText, { color: colors.mutedForeground }]}>·</Text>
          <Pressable onPress={() => router.push("/terms")} testID="terms-of-service"><Text style={[styles.legalLink, { color: colors.mutedForeground }]}>Terms</Text></Pressable>
        </View>
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  brand: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginBottom: 8 },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  iconText: { fontSize: 19, fontWeight: "900" },
  wordmark: { color: "#111111", fontSize: 22, fontWeight: "800", letterSpacing: -1 },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, paddingTop: 16, paddingHorizontal: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  footerInner: { width: "100%", maxWidth: 400, alignSelf: "center", alignItems: "center" },
  heading: { color: "#111111", fontSize: 25, lineHeight: 29, fontWeight: "800", textAlign: "center", letterSpacing: -0.7 },
  subtitle: { color: "#666666", fontSize: 12, lineHeight: 17, textAlign: "center", marginTop: 5, marginBottom: 12 },
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
