import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OnboardingVideoBackground } from "./OnboardingVideoBackground";

export function OnboardingWelcome() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return <View style={styles.root}>
    <OnboardingVideoBackground/>
    <View style={[styles.brand, { paddingTop: insets.top + 21 }]}>
      <Image source={require("../assets/images/icon.png")} style={styles.icon}/>
      <Text style={styles.wordmark}>My<Text style={{ color: "#ec4e92" }}>age</Text></Text>
    </View>
    <Text style={[styles.preview, { top: insets.top + 74 }]}>ONBOARDING PREVIEW</Text>
    <LinearGradient colors={["rgba(246,234,221,0)", "#f6eadd", "#f6eadd"]}
      locations={[0, .2, 1]} style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom) }]}>
      <View style={styles.footerInner}>
        <Text style={[styles.heading, height < 650 && { fontSize: 24 }]}>Your next connection starts here.</Text>
        <Text style={styles.subtitle}>Create your profile. Meet someone who gets you.</Text>
        <View style={styles.actions}>
          <Pressable testID="create-account" accessibilityRole="button" style={[styles.button, styles.primary]}
            onPress={() => router.push("/(auth)/sign-up")}>
            <Feather name="user-plus" size={17} color="#fff"/>
            <Text style={styles.primaryText}>Get Started</Text>
          </Pressable>
          <Pressable testID="sign-in" accessibilityRole="button" style={[styles.button, styles.secondary]}
            onPress={() => router.push("/(auth)/sign-in")}>
            <Feather name="lock" size={16} color="#302536"/>
            <Text style={styles.secondaryText}>Log in</Text>
          </Pressable>
        </View>
        <View style={styles.legal}>
          <Text style={styles.legalText}>Adults 18+ ·</Text>
          <Pressable onPress={() => router.push("/privacy-policy")} testID="privacy-policy"><Text style={styles.legalLink}>Privacy Policy</Text></Pressable>
          <Text style={styles.legalText}>·</Text>
          <Pressable onPress={() => router.push("/terms")} testID="terms-of-service"><Text style={styles.legalLink}>Terms</Text></Pressable>
        </View>
      </View>
    </LinearGradient>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#ebdfd1" },
  brand: { flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 24 },
  icon: { width: 32, height: 32, borderRadius: 11 },
  wordmark: { color: "#201c2e", fontSize: 22, fontWeight: "800", letterSpacing: -1 },
  preview: { position: "absolute", left: 24, fontSize: 10, letterSpacing: 1.2, color: "#655860" },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, paddingTop: 52, paddingHorizontal: 24 },
  footerInner: { width: "100%", maxWidth: 400, alignSelf: "center", alignItems: "center" },
  heading: { color: "#201c2e", fontSize: 30, lineHeight: 33, fontWeight: "800", textAlign: "center", letterSpacing: -1 },
  subtitle: { color: "#6e626b", fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: 8, marginBottom: 16 },
  actions: { flexDirection: "row", width: "100%", gap: 12 },
  button: { flex: 1, minHeight: 54, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  primary: { backgroundColor: "#ef4c92" },
  secondary: { backgroundColor: "rgba(255,255,255,.9)", borderWidth: 1, borderColor: "#cdb9be" },
  primaryText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  secondaryText: { color: "#302536", fontSize: 14, fontWeight: "700" },
  legal: { marginTop: 14, flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 4 },
  legalText: { color: "#71616c", fontSize: 10 },
  legalLink: { color: "#71616c", fontSize: 10, textDecorationLine: "underline" },
});
