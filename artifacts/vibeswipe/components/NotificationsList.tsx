import {
  getGetNotificationsQueryKey,
  useGetMatches,
  useGetNotifications,
  useMarkNotificationRead,
} from "@workspace/api-client-react";
import type { Notification } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function timeAgo(value: string): string {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  if (!Number.isFinite(elapsed)) return "";
  if (elapsed < 60_000) return "Just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  if (elapsed < 604_800_000) return `${Math.floor(elapsed / 86_400_000)}d ago`;
  return new Date(value).toLocaleDateString();
}

export function NotificationsList({ tabMode = false }: { tabMode?: boolean }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const notifications = useGetNotifications({ query: { refetchInterval: 5_000 } });
  const matches = useGetMatches({ query: { refetchInterval: 15_000 } });
  const markRead = useMarkNotificationRead();
  const [notice, setNotice] = useState<{ id: string; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const returnTo = tabMode ? "activity" : "notifications";
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const currentMatch = (item: Notification) => matches.data?.find((m) => m.profile.id === item.actor.id);

  async function markAsRead(item: Notification) {
    if (item.readAt) return;
    try {
      await markRead.mutateAsync({ notificationId: item.id });
    } catch {
      // The destination remains available even if marking read fails.
    }
    void queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
  }

  async function openNotification(item: Notification) {
    await markAsRead(item);
    const match = currentMatch(item);
    if ((item.type === "new_match" || item.type === "new_message") && match && !match.blockedByMe && !match.blockedMe) {
      router.push({ pathname: "/chat/[matchId]", params: { matchId: match.id, returnTo } });
      return;
    }
    if (item.type === "new_match" || item.type === "new_message") {
      router.push("/(tabs)/matches");
      return;
    }
    router.push({ pathname: "/profile/[profileId]", params: { profileId: item.actor.id } });
  }

  async function sendMessage(item: Notification) {
    if (timer.current) clearTimeout(timer.current);
    setNotice({ id: item.id, text: "Checking your match…" });
    const fresh = await matches.refetch();
    if (fresh.isError || !fresh.data) {
      setNotice({ id: item.id, text: "We couldn’t check your match right now. Check your connection and tap Send message again." });
      return;
    }
    const match = fresh.data.find((m) => m.profile.id === item.actor.id);
    void markAsRead(item);
    if (match && (match.blockedByMe || match.blockedMe)) {
      setNotice({ id: item.id, text: match.blockedByMe ? `You blocked ${item.actor.name}. Unblock them from Matches to message again.` : `Messaging with ${item.actor.name} isn’t available.` });
      return;
    }
    if (match) {
      setNotice(null);
      router.push({ pathname: "/chat/[matchId]", params: { matchId: match.id, returnTo } });
      return;
    }
    setNotice({ id: item.id, text: `Match first to message ${item.actor.name}. Opening their profile so you can like back.` });
    timer.current = setTimeout(() => {
      router.push({ pathname: "/profile/[profileId]", params: { profileId: item.actor.id } });
    }, 1_300);
  }

  const titleFor = (item: Notification) => {
    if (item.type === "new_match") return `You matched with ${item.actor.name}`;
    if (item.type === "new_message") return `${item.actor.name} sent you a message`;
    if (item.type === "new_like") return `${item.actor.name} liked you`;
    return `${item.actor.name} viewed your profile`;
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: Platform.OS === "web" ? 72 : tabMode ? 16 : insets.top + 8 }]}>
      <View style={styles.header}>
        {tabMode ? null : (
          <Pressable accessibilityRole="button" accessibilityLabel="Back" testID="notifications-back" onPress={() => router.back()} style={styles.back}>
            <Feather name="arrow-left" size={21} color={colors.foreground} />
          </Pressable>
        )}
        <Text style={[styles.title, { color: colors.foreground }]}>Notifications</Text>
      </View>
      {notifications.isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : notifications.isError ? (
        <View style={styles.center}>
          <Text style={{ color: colors.foreground }}>Couldn’t load your activity.</Text>
          <Pressable testID="notifications-retry" onPress={() => void notifications.refetch()}><Text style={{ color: colors.primary, fontWeight: "700" }}>Try again</Text></Pressable>
        </View>
      ) : notifications.data?.notifications.length ? (
        <ScrollView contentContainerStyle={styles.list}>
          {notifications.data.notifications.map((item) => (
            <View key={item.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.row}>
                <Pressable
                  testID={`notification-${item.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${titleFor(item)}${item.readAt ? "" : ", unread"}`}
                  onPress={() => void openNotification(item)}
                  style={styles.main}
                >
                  <ProfileAvatar profile={item.actor} size={50} />
                  <View style={styles.copy}>
                    <Text numberOfLines={2} style={[styles.message, { color: colors.foreground }]}>{titleFor(item)}</Text>
                    <View style={styles.timeRow}>
                      {!item.readAt ? <View style={[styles.unread, { backgroundColor: colors.primary }]} /> : null}
                      <Text style={[styles.time, { color: colors.mutedForeground }]}>{timeAgo(item.createdAt)}</Text>
                    </View>
                  </View>
                </Pressable>
                <Pressable
                  testID={`notification-message-${item.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Send message to ${item.actor.name}`}
                  onPress={() => void sendMessage(item)}
                  style={({ pressed }) => [styles.send, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
                >
                  <Feather name="message-circle" size={15} color={colors.primaryForeground} />
                  <Text style={[styles.sendText, { color: colors.primaryForeground }]}>Send message</Text>
                </Pressable>
              </View>
              {notice?.id === item.id ? (
                <Text accessibilityRole="alert" style={[styles.notice, { backgroundColor: colors.accent, color: colors.foreground }]}>{notice.text}</Text>
              ) : null}
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.center}>
          <Feather name="bell" size={26} color={colors.mutedForeground} />
          <Text style={[styles.empty, { color: colors.foreground }]}>You’re all caught up</Text>
          <Text style={{ color: colors.mutedForeground, textAlign: "center" }}>New likes, views and matches will show up here.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 12, height: 52, marginBottom: 6 },
  back: { width: 35, height: 40, justifyContent: "center" },
  title: { fontSize: 30, fontWeight: "800", letterSpacing: -0.6 },
  list: { padding: 15, gap: 10, paddingBottom: 110 },
  card: { borderWidth: 1, borderRadius: 18, padding: 11 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: 11, minHeight: 56 },
  copy: { flex: 1, gap: 5 },
  message: { fontSize: 14, fontWeight: "600" },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  time: { fontSize: 11 },
  unread: { width: 8, height: 8, borderRadius: 4 },
  send: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 11, height: 36 },
  sendText: { fontSize: 12, fontWeight: "700" },
  notice: { marginTop: 9, borderRadius: 11, paddingHorizontal: 11, paddingVertical: 8, fontSize: 12, fontWeight: "600", overflow: "hidden" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 28 },
  empty: { fontSize: 16, fontWeight: "700" },
});
