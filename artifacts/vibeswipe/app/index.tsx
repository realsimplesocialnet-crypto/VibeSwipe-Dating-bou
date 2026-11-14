import { useAuth } from "@clerk/expo";
import { useGetMyProfile } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
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

  return (
    <View style={[styles.container, { backgroundColor: "#100e14" }]}>
      <View pointerEvents="none" style={styles.glow} />
      <View style={styles.content}>
        <View style={styles.brandRow}>
          <View style={styles.mark}>
            <Feather name="heart" size={23} color="#ff4e9b" />
          </View>
          <Text style={styles.brandText}>
            <Text style={{ color: "#ffffff" }}>Vibe</Text>
            <Text style={{ color: "#ff5ca6" }}>Swipe</Text>
          </Text>
        </View>
        <Text style={[styles.title, { color: "#ffffff" }]}>
          Welcome to{"\n"}VibeSwipe.
        </Text>
        <Text style={styles.body}>
          Create your account or sign in to continue.
        </Text>
      <View style={styles.actions}>
        <Pressable
          testID="create-account"
          style={({ pressed }) => [
            styles.primaryButton,
            { opacity: pressed ? 0.86 : 1 },
          ]}
          onPress={() => router.push("/(auth)/sign-up")}
        >
          <Feather name="user-plus" size={18} color="#27111d" />
          <Text style={styles.primaryText}>Create account</Text>
        </Pressable>
        <Pressable
          testID="sign-in"
          style={styles.secondaryButton}
          onPress={() => router.push("/(auth)/sign-in")}
        >
          <Feather name="lock" size={16} color="#f3edf3" />
          <Text style={styles.secondaryText}>Sign in</Text>
        </Pressable>
      </View>
      </View>
      <View style={styles.legal}>
        <Text style={styles.legalText}>For adults 18 and over</Text>
        <Text style={styles.bullet}>•</Text>
        <Pressable onPress={() => router.push("/community-guidelines")} testID="community-guidelines">
          <Text style={styles.guidelines}>Community guidelines</Text>
        </Pressable>
      </View>
    </View>
  );
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
    backgroundColor: "rgba(190, 66, 157, 0.11)",
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
    backgroundColor: "rgba(239,72,151,.13)",
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -1.3,
  },
  title: { fontSize: 39, lineHeight: 45, fontWeight: "800", letterSpacing: -1.7, textAlign: "center" },
  body: { fontSize: 15, lineHeight: 23, marginTop: 15, maxWidth: 300, textAlign: "center", color: "#aaa2b1" },
  actions: { width: "100%", gap: 12, marginTop: 34 },
  primaryButton: {
    minHeight: 60,
    borderRadius: 17,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 11,
    backgroundColor: "#f34e9a",
  },
  primaryText: { color: "#27111d", fontSize: 16, fontWeight: "700" },
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
  secondaryText: { fontSize: 15, fontWeight: "600", color: "#f3edf3" },
  legal: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, flexWrap: "wrap" },
  legalText: { fontSize: 11, color: "#8f8997" },
  bullet: { fontSize: 12, color: "#827987" },
  guidelines: { fontSize: 11, fontWeight: "600", color: "#ff70b0" },
});
