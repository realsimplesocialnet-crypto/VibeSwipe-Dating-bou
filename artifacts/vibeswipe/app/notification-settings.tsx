import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState, type ComponentProps } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetVibeSwipeSettingsQueryKey,
  useGetVibeSwipeSettings,
  useUpdateVibeSwipeSettings,
  type VibeSwipeSettings,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/hooks/useTheme";

type NotifyKey = "notifyLikes" | "notifyMessages" | "notifyProfileViews";
type NotifySettings = Record<NotifyKey, boolean>;

const rows: { key: NotifyKey; title: string; detail: string; icon: ComponentProps<typeof Feather>["name"]; testID: string }[] = [
  { key: "notifyLikes", title: "Likes", detail: "When someone likes your profile or posts", icon: "heart", testID: "toggle-notify-likes" },
  { key: "notifyMessages", title: "Messages", detail: "When you receive a new message", icon: "message-circle", testID: "toggle-notify-messages" },
  { key: "notifyProfileViews", title: "Views", detail: "When someone views your profile", icon: "eye", testID: "toggle-notify-profile-views" },
];

export default function NotificationSettingsScreen() {
  const colors = useColors();
  const { scheme } = useTheme();
  const dark = scheme === "dark";
  const queryClient = useQueryClient();
  const settings = useGetVibeSwipeSettings();
  const update = useUpdateVibeSwipeSettings();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const p = dark
    ? { bg: colors.background, card: colors.card, title: colors.primary, text: colors.foreground, sub: colors.mutedForeground, tile: colors.accent, icon: colors.primary, on: colors.primary, off: colors.border, line: colors.border, btn: colors.card }
    : { bg: "#FDEEF2", card: "#FFFAFB", title: "#E0507F", text: "#2B1D24", sub: "#7D6370", tile: "#FDE8EE", icon: "#EF5F8F", on: "#F27AA0", off: "#ECD9E0", line: "#F6DBE4", btn: "#FFFAFB" };

  const data = settings.data as (VibeSwipeSettings & Partial<NotifySettings>) | undefined;
  const value = (k: NotifyKey) => data?.[k] ?? true;

  async function save(key: NotifyKey, next: boolean) {
    setError(""); setSaved(false);
    try {
      const result = await update.mutateAsync({ data: { [key]: next } as Partial<VibeSwipeSettings> as VibeSwipeSettings });
      queryClient.setQueryData(getGetVibeSwipeSettingsQueryKey(), result);
      setSaved(true);
    } catch {
      setError("Couldn't save that change. Check your connection and try again.");
    }
  }

  function goBack() {
    if (router.canGoBack()) router.back(); else router.replace("/settings");
  }

  return (
    <ScrollView style={{ backgroundColor: p.bg }} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" testID="button-notification-settings-back" onPress={goBack} style={[styles.back, { backgroundColor: p.btn, shadowColor: p.title }]}>
          <Feather name="chevron-left" size={22} color={p.title} />
        </Pressable>
        <Text style={[styles.title, { color: p.title }]}>Notification settings</Text>
        <View style={styles.spacer} />
      </View>
      <Text style={[styles.lede, { color: p.sub }]}>Choose what you want to be notified about.</Text>

      {settings.isLoading ? (
        <View accessibilityLabel="Loading settings" style={[styles.card, { backgroundColor: p.card }]}>
          {[0, 1, 2].map((i) => <View key={i} style={[styles.skeleton, { backgroundColor: p.tile }]} />)}
        </View>
      ) : settings.isError ? (
        <View accessibilityRole="alert" style={[styles.card, { backgroundColor: p.card }]}>
          <Text style={[styles.sub, { color: colors.destructive }]}>Settings couldn't load.</Text>
          <Pressable accessibilityRole="button" testID="button-retry-settings" onPress={() => void settings.refetch()} style={[styles.retry, { backgroundColor: p.on }]}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <View testID="card-notification-settings" style={[styles.card, { backgroundColor: p.card, borderColor: dark ? colors.border : "transparent", shadowColor: p.title }]}>
          {rows.map((row) => (
            <View key={row.key} style={[styles.row, { borderBottomColor: p.line }]}>
              <View style={[styles.tile, { backgroundColor: p.tile }]}><Feather name={row.icon} size={22} color={p.icon} /></View>
              <View style={styles.copy}>
                <Text style={[styles.rowTitle, { color: p.text }]}>{row.title}</Text>
                <Text style={[styles.sub, { color: p.sub }]}>{row.detail}</Text>
              </View>
              <Switch
                testID={row.testID}
                accessibilityLabel={row.title}
                value={value(row.key)}
                disabled={update.isPending}
                onValueChange={(next) => void save(row.key, next)}
                trackColor={{ true: p.on, false: p.off }}
                thumbColor="#FFFAFB"
                ios_backgroundColor={p.off}
              />
            </View>
          ))}
          <View style={styles.note}>
            <Feather name="shield" size={18} color={p.icon} />
            <Text style={[styles.noteText, { color: p.sub }]}>You can change these settings anytime here.</Text>
          </View>
        </View>
      )}

      <View style={styles.status}>
        {update.isPending ? (
          <View style={styles.statusRow}><ActivityIndicator size="small" color={p.on} /><Text style={[styles.sub, { color: p.sub }]}>Saving</Text></View>
        ) : saved ? (
          <Text accessibilityRole="text" testID="text-notification-saved" style={[styles.sub, { color: p.title }]}>Saved</Text>
        ) : null}
        {error ? <Text accessibilityRole="alert" testID="settings-save-error" style={[styles.sub, { color: colors.destructive }]}>{error}</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 20, paddingTop: 58, paddingBottom: 60 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  spacer: { width: 44 },
  title: { flex: 1, textAlign: "center", fontSize: 23, fontWeight: "800", letterSpacing: -0.4 },
  lede: { textAlign: "center", fontSize: 14, marginBottom: 22 },
  card: { borderRadius: 26, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 6, shadowOpacity: 0.12, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth },
  tile: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 16, fontWeight: "700" },
  sub: { fontSize: 13, lineHeight: 18 },
  note: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 15 },
  noteText: { flex: 1, fontSize: 12 },
  skeleton: { height: 60, borderRadius: 16, marginVertical: 8 },
  retry: { alignSelf: "flex-start", marginVertical: 12, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  retryText: { color: "#FFFAFB", fontWeight: "700" },
  status: { marginTop: 14, gap: 6, minHeight: 20 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
});
