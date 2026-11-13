import { useGetProfileById, useRecordProfileView } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useColors } from "@/hooks/useColors";

export default function PublicProfileScreen() {
  const colors = useColors();
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  const profile = useGetProfileById(profileId);
  const recordView = useRecordProfileView();
  useEffect(() => {
    if (profileId) recordView.mutate({ profileId });
  }, [profileId]);

  if (profile.isLoading) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  }
  if (!profile.data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground }}>This profile is unavailable.</Text>
      </View>
    );
  }
  const user = profile.data;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
        <Feather name="arrow-left" size={21} color={colors.foreground} />
      </Pressable>
      <ProfileAvatar profile={user} size={190} />
      <Text style={[styles.name, { color: colors.foreground }]}>{user.name}, {user.age}</Text>
      <Text style={[styles.city, { color: colors.mutedForeground }]}>{user.city} · {user.gender}</Text>
      <Text style={[styles.section, { color: colors.foreground }]}>About</Text>
      <Text style={[styles.bio, { color: colors.mutedForeground }]}>{user.bio || "No bio added yet."}</Text>
      <Text style={[styles.section, { color: colors.foreground }]}>Interests</Text>
      <View style={styles.tags}>
        {user.interests.map((item) => <Text key={item} style={[styles.tag, { backgroundColor: colors.accent, color: colors.accentForeground }]}>{item}</Text>)}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { minHeight: "100%", alignItems: "center", padding: 24, paddingTop: 55, paddingBottom: 50 },
  back: { alignSelf: "flex-start", width: 40, height: 42, justifyContent: "center", marginBottom: 20 },
  name: { fontSize: 25, fontWeight: "800", marginTop: 18 },
  city: { fontSize: 13, marginTop: 5 },
  section: { alignSelf: "stretch", fontSize: 16, fontWeight: "700", marginTop: 28, marginBottom: 9 },
  bio: { alignSelf: "stretch", fontSize: 14, lineHeight: 21 },
  tags: { alignSelf: "stretch", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { overflow: "hidden", borderRadius: 18, paddingHorizontal: 11, paddingVertical: 7, fontSize: 12, fontWeight: "600" },
});
