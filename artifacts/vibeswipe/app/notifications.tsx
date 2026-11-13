import {
  getGetNotificationsQueryKey,
  useGetNotifications,
  useMarkNotificationRead,
} from "@workspace/api-client-react";
import type { Notification } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useColors } from "@/hooks/useColors";

export default function NotificationsScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const notifications = useGetNotifications({ query: { refetchInterval: 15_000 } });
  const markRead = useMarkNotificationRead();

  async function openNotification(item: Notification) {
    if (!item.readAt) {
      try {
        await markRead.mutateAsync({ notificationId: item.id });
        await queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
      } catch {
        // The destination remains available even if marking read fails.
      }
    }
    if ((item.type === "new_match" || item.type === "new_message") && item.matchId) {
      router.push({ pathname: "/chat/[matchId]", params: { matchId: item.matchId } });
      return;
    }
    if (item.type === "new_match") {
      router.push("/(tabs)/matches");
      return;
    }
    router.push({ pathname: "/profile/[profileId]", params: { profileId: item.actor.id } });
  }

  const titleFor = (item: Notification) => {
    if (item.type === "new_match") return `You matched with ${item.actor.name}`;
    if (item.type === "new_message") return `${item.actor.name} sent you a message`;
    if (item.type === "new_like") return `${item.actor.name} liked you`;
    return `${item.actor.name} viewed your profile`;
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={21} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Notifications</Text>
      </View>
      {notifications.isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : notifications.isError ? (
        <View style={styles.center}>
          <Text style={{ color: colors.foreground }}>Couldn’t load notifications.</Text>
          <Pressable onPress={() => void notifications.refetch()}><Text style={{ color: colors.primary }}>Try again</Text></Pressable>
        </View>
      ) : notifications.data?.notifications.length ? (
        <ScrollView contentContainerStyle={styles.list}>
          {notifications.data.notifications.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => void openNotification(item)}
              style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <ProfileAvatar profile={item.actor} size={52} />
              <View style={styles.copy}>
                <Text style={[styles.message, { color: colors.foreground }]}>{titleFor(item)}</Text>
                <Text style={[styles.time, { color: colors.mutedForeground }]}>{new Date(item.createdAt).toLocaleString()}</Text>
              </View>
              {!item.readAt ? <View style={[styles.unread, { backgroundColor: colors.primary }]} /> : null}
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.center}>
          <Feather name="bell" size={26} color={colors.mutedForeground} />
          <Text style={[styles.empty, { color: colors.foreground }]}>You’re all caught up</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 55 },
  header: { paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 12, height: 52, marginBottom: 10 },
  back: { width: 35, height: 40, justifyContent: "center" },
  title: { fontSize: 23, fontWeight: "800" },
  list: { padding: 15, gap: 9, paddingBottom: 40 },
  row: { minHeight: 76, borderWidth: 1, borderRadius: 16, padding: 11, flexDirection: "row", alignItems: "center", gap: 11 },
  copy: { flex: 1, gap: 5 },
  message: { fontSize: 14, fontWeight: "600" },
  time: { fontSize: 11 },
  unread: { width: 9, height: 9, borderRadius: 5 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  empty: { fontSize: 16, fontWeight: "700" },
});
