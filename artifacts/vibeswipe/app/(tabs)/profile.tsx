import { useGetMyProfile, useGetVibeSwipeSettings } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useColors } from "@/hooks/useColors";

export default function ProfileScreen() {
  const colors = useColors();
  const { signOut } = useAuth();
  const profile = useGetMyProfile();
  const settings = useGetVibeSwipeSettings();
  if (profile.isLoading) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  }
  if (!profile.data) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={{ color: colors.foreground }}>Profile unavailable.</Text></View>;
  }
  const user = profile.data;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <View style={styles.top}>
        <Text style={[styles.heading, { color: colors.foreground }]}>Your profile</Text>
        <Pressable accessibilityLabel="Settings" onPress={() => router.push("/settings")} style={[styles.settings, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Feather name="settings" size={19} color={colors.foreground} />
        </Pressable>
      </View>
      <View style={styles.hero}>
        <ProfileAvatar profile={user} size={92} />
        <Text style={[styles.name, { color: colors.foreground }]}>{user.name}, {user.age}</Text>
        <Text style={[styles.city, { color: colors.mutedForeground }]}>{user.city} · {user.gender}</Text>
        {settings.data?.travelMode && settings.data.travelCity ? (
          <View style={[styles.travelBadge, { backgroundColor: colors.accent }]}>
            <Feather name="navigation" size={12} color={colors.primary} />
            <Text style={[styles.travelBadgeText, { color: colors.primary }]}>Traveling · {settings.data.travelCity}</Text>
          </View>
        ) : null}
        <Pressable testID="edit-profile" onPress={() => router.push("/edit-profile")} style={[styles.editButton, { backgroundColor: colors.accent }]}>
          <Feather name="edit-2" size={15} color={colors.primary} />
          <Text style={[styles.editText, { color: colors.primary }]}>Edit profile</Text>
        </Pressable>
      </View>
      <Text style={[styles.section, { color: colors.foreground }]}>About</Text>
      <Text style={[styles.bio, { color: colors.mutedForeground }]}>{user.bio || "Add a bio so people can get to know you."}</Text>
      <Text style={[styles.section, { color: colors.foreground }]}>Interests</Text>
      <View style={styles.tags}>
        {user.interests.length ? user.interests.map((item) => <Text key={item} style={[styles.tag, { backgroundColor: colors.accent, color: colors.accentForeground }]}>{item}</Text>) : <Text style={[styles.bio, { color: colors.mutedForeground }]}>Add a few interests to your profile.</Text>}
      </View>
      <Text style={[styles.section, { color: colors.foreground }]}>Your media</Text>
      <View style={styles.mediaRow}>
        {user.photos.map((photo, index) => (
          <View key={`${photo}-${index}`} style={[styles.mediaThumb, { backgroundColor: colors.card }]}>
            {index === 0 ? <ProfileAvatar profile={user} size={74} /> : <Feather name="image" size={20} color={colors.mutedForeground} />}
          </View>
        ))}
        {user.videoUrl ? <View style={[styles.mediaThumb, { backgroundColor: colors.accent }]}><Feather name="video" size={20} color={colors.primary} /></View> : null}
      </View>
      <Pressable onPress={() => void signOut().then(() => router.replace("/"))} style={[styles.signOut, { borderColor: colors.border }]}>
        <Feather name="log-out" size={17} color={colors.destructive} />
        <Text style={[styles.signOutText, { color: colors.destructive }]}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { padding: 20, paddingTop: 70, paddingBottom: 110 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heading: { fontSize: 26, fontWeight: "700" },
  settings: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  hero: { alignItems: "center", paddingVertical: 27, gap: 6 },
  name: { fontSize: 22, fontWeight: "700", marginTop: 4 },
  city: { fontSize: 13 },
  travelBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, marginTop: 3 },
  travelBadgeText: { fontSize: 11, fontWeight: "700" },
  editButton: { height: 38, borderRadius: 13, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 7, marginTop: 8 },
  editText: { fontSize: 12, fontWeight: "700" },
  section: { fontSize: 15, fontWeight: "700", marginTop: 16, marginBottom: 9 },
  bio: { fontSize: 14, lineHeight: 21 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { overflow: "hidden", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, fontSize: 12, fontWeight: "600" },
  mediaRow: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  mediaThumb: { width: 74, height: 86, borderRadius: 14, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  signOut: { height: 50, borderRadius: 14, borderWidth: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 30 },
  signOutText: { fontSize: 14, fontWeight: "700" },
});
