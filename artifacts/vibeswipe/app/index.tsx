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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.orbit} />
      <View style={[styles.mark, { backgroundColor: colors.primary }]}>
        <Feather name="heart" size={28} color="#ffffff" />
      </View>
      <Text style={[styles.eyebrow, { color: colors.primary }]}>VIBESWIPE</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>
        Meet someone{"\n"}worth the moment.
      </Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>
        Real people, moving stories, and conversations that start with a spark.
      </Text>
      <View style={styles.actions}>
        <Pressable
          testID="create-account"
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={() => router.push("/(auth)/sign-up")}
        >
          <Text style={styles.primaryText}>Create account</Text>
          <Feather name="arrow-up-right" size={18} color="#ffffff" />
        </Pressable>
        <Pressable
          testID="sign-in"
          style={[styles.secondaryButton, { borderColor: colors.border }]}
          onPress={() => router.push("/(auth)/sign-in")}
        >
          <Text style={[styles.secondaryText, { color: colors.foreground }]}>
            I already have an account
          </Text>
        </Pressable>
      </View>
      <Text style={[styles.legal, { color: colors.mutedForeground }]}>
        Adults only · 18+ · Your safety comes first
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 28,
    paddingBottom: 48,
    paddingTop: 80,
    overflow: "hidden",
  },
  orbit: {
    position: "absolute",
    top: 90,
    right: -90,
    width: 340,
    height: 340,
    borderWidth: 1,
    borderColor: "rgba(255,83,118,0.18)",
    borderRadius: 180,
  },
  mark: {
    position: "absolute",
    top: 170,
    left: 32,
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-8deg" }],
  },
  eyebrow: { fontSize: 12, fontWeight: "700", letterSpacing: 3, marginBottom: 16 },
  title: { fontSize: 42, lineHeight: 48, fontWeight: "700", letterSpacing: -1.5 },
  body: { fontSize: 16, lineHeight: 24, marginTop: 15, maxWidth: 320 },
  actions: { gap: 12, marginTop: 32 },
  primaryButton: {
    minHeight: 56,
    borderRadius: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  primaryText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
  secondaryButton: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryText: { fontSize: 14, fontWeight: "600" },
  legal: { marginTop: 22, textAlign: "center", fontSize: 12 },
});
