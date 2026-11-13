import { useGetWhoViewedYou } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NotificationBell } from "@/components/NotificationBell";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useColors } from "@/hooks/useColors";

export default function ViewsScreen() {
  const colors = useColors();
  const views = useGetWhoViewedYou({ query: { refetchInterval: 30_000 } });
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Who viewed you</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>People who opened your profile</Text>
        </View>
        <NotificationBell color={colors.foreground} />
      </View>
      {views.isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : views.isError ? (
        <View style={styles.center}>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Couldn’t load views</Text>
          <Pressable onPress={() => void views.refetch()}><Text style={{ color: colors.primary }}>Try again</Text></Pressable>
        </View>
      ) : views.data?.length ? (
        <ScrollView contentContainerStyle={styles.list}>
          {views.data.map((item) => (
            <Pressable
              key={`${item.profile.id}-${item.viewedAt}`}
              onPress={() => router.push({ pathname: "/profile/[profileId]", params: { profileId: item.profile.id } })}
              style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <ProfileAvatar profile={item.profile} size={56} />
              <View style={styles.copy}>
                <Text style={[styles.name, { color: colors.foreground }]}>{item.profile.name}, {item.profile.age}</Text>
                <Text style={[styles.city, { color: colors.mutedForeground }]}>{item.profile.city || "Nearby"}</Text>
                <Text style={[styles.time, { color: colors.mutedForeground }]}>{new Date(item.viewedAt).toLocaleString()}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.center}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.accent }]}><Feather name="eye" size={23} color={colors.primary} /></View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No profile views yet</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>When someone opens your profile, they’ll appear here.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 64 },
  header: { minHeight: 56, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  title: { fontSize: 23, fontWeight: "800" },
  subtitle: { fontSize: 12, marginTop: 4 },
  list: { padding: 16, gap: 10, paddingBottom: 100 },
  row: { minHeight: 82, borderWidth: 1, borderRadius: 17, padding: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  copy: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: "700" },
  city: { fontSize: 12 },
  time: { fontSize: 10 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30, gap: 12 },
  emptyIcon: { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 17, fontWeight: "700", textAlign: "center" },
});
