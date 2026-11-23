import { useGetNotifications } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

export function NotificationBell({ color }: { color: string }) {
  const colors = useColors();
  const notifications = useGetNotifications({
    query: { refetchInterval: 5_000 },
  });
  const counts = notifications.data?.unreadCounts;
  const unread = counts
    ? counts.matches + counts.messages + counts.views + counts.likes + (counts.reels ?? 0)
    : 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread ? `Notifications, ${unread} unread` : "Notifications"}
      onPress={() => router.push("/notifications")}
      style={styles.button}
    >
      <Feather name="bell" size={19} color={color} />
      {unread > 0 ? (
          <View style={[styles.badge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
          <Text style={[styles.badgeText, { color: colors.primaryForeground }]}>{unread > 99 ? "99+" : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(25,25,29,0.82)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 3,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 9, fontWeight: "800" },
});
