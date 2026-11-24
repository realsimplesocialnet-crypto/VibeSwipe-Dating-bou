import { Feather } from "@expo/vector-icons";
import { useGetNotifications } from "@workspace/api-client-react";
import { router, useIsFocused } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

export function AppHeader({ active }: { active?: "notifications" | "messages" }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const notifications = useGetNotifications({
    query: { enabled: focused, refetchInterval: 15_000 },
  });
  const unread = notifications.data?.unreadCounts;
  const activityCount = unread
    ? unread.views + unread.likes + unread.follows + (unread.reels ?? 0)
    : 0;
  const messageCount = unread?.messages ?? 0;

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top + 7,
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.actions}>
        <HeaderButton
          label={activityCount ? `Notifications, ${activityCount} unread` : "Notifications"}
          icon="bell"
          active={active === "notifications"}
          count={activityCount}
          onPress={() => router.push("/(tabs)/activity")}
        />
        <HeaderButton
          label={messageCount ? `Inbox, ${messageCount} unread` : "Inbox"}
          icon="message-square"
          active={active === "messages"}
          count={messageCount}
          onPress={() => router.push("/(tabs)/views")}
        />
      </View>
    </View>
  );
}

function HeaderButton({
  label,
  icon,
  active,
  count,
  onPress,
}: {
  label: string;
  icon: "bell" | "message-square";
  active: boolean;
  count: number;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        active && { backgroundColor: colors.primary },
        pressed && styles.pressed,
      ]}
    >
      <Feather
        name={icon}
        size={20}
        color={active ? colors.primaryForeground : colors.foreground}
      />
      {count > 0 && (
        <View style={[styles.badge, { backgroundColor: colors.primary }]}>
          <Text style={[styles.badgeText, { color: colors.primaryForeground }]}>
            {count > 99 ? "99+" : count}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 60,
    paddingHorizontal: 18,
    paddingBottom: 8,
    borderBottomWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  action: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.72 },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 9, fontWeight: "800" },
});
