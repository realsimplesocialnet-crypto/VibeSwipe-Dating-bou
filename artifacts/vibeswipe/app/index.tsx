import { useAuth } from "@clerk/expo";
import { useGetMyProfile } from "@workspace/api-client-react";
import { OnboardingWelcome } from "@/components/OnboardingWelcome";
import { router } from "expo-router";
import { useEffect } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

export default function EntryScreen() {
  const colors = useColors();
  const { isLoaded, isSignedIn } = useAuth();
  const profile = useGetMyProfile({
    query: { enabled: isLoaded && !!isSignedIn, retry: false },
  });

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (profile.data) router.replace("/(tabs)");
    else if (profile.isError) router.replace("/onboarding");
  }, [isLoaded, isSignedIn, profile.data, profile.isError]);

  if (!isLoaded || (isSignedIn && profile.isLoading)) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (isSignedIn) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          Loading your profile…
        </Text>
      </View>
    );
  }

  return <OnboardingWelcome/>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingBottom: 30,
    paddingTop: 30,
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    top: -155,
    width: 430,
    height: 390,
    borderRadius: 220,
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  content: {
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 40,
  },
  mark: {
    width: 46,
    height: 46,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.1)",
    backgroundColor: "rgba(255,255,255,.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  markImage: { width: 46, height: 46, borderRadius: 17 },
  brandText: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -1.3,
  },
  title: { fontSize: 39, lineHeight: 45, fontWeight: "800", letterSpacing: -1.7, textAlign: "center" },
  body: { fontSize: 15, lineHeight: 23, marginTop: 15, maxWidth: 300, textAlign: "center", color: "#666666" },
  actions: { width: "100%", gap: 12, marginTop: 34 },
  primaryButton: {
    minHeight: 60,
    borderRadius: 17,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 11,
    backgroundColor: "#FFFFFF",
  },
  primaryText: { color: "#111111", fontSize: 16, fontWeight: "700" },
  secondaryButton: {
    minHeight: 58,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.14)",
    backgroundColor: "rgba(255,255,255,.035)",
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryText: { fontSize: 15, fontWeight: "600", color: "#111111" },
  legal: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, flexWrap: "wrap" },
  legalText: { fontSize: 11, color: "#666666" },
  bullet: { fontSize: 12, color: "#777777" },
  guidelines: { fontSize: 11, fontWeight: "600", color: "#FFFFFF" },
});
