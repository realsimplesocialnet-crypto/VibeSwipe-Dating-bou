import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const OPTIONS = [
  { key: "post", icon: "grid" as const, title: "Post", copy: "1 to 10 photos, or a video, on your profile and in followers' feeds.", to: "/reels/new" },
  { key: "story", icon: "aperture" as const, title: "Story", copy: "A photo, video or note that disappears after 24 hours.", to: "/story/new" },
  { key: "reel", icon: "film" as const, title: "Reel", copy: "A full-screen video with music for the Reels tab.", to: "/reels/new" },
];

export default function CreateScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: (Platform.OS === "web" ? 67 : insets.top) + 14 }]}>
      <Text style={[styles.title, { color: colors.foreground }]} accessibilityRole="header">Create</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>What are you sharing today?</Text>
      <View style={styles.list}>
        {OPTIONS.map((o) => (
          <Pressable key={o.key} testID={`create-${o.key}`} onPress={() => router.push(o.to as never)} accessibilityRole="button" style={({ pressed }) => [styles.row, { backgroundColor: colors.card, borderColor: colors.border, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
            <View style={[styles.icon, { backgroundColor: colors.accent }]}><Feather name={o.icon} size={22} color={colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.foreground }]}>{o.title}</Text>
              <Text style={[styles.rowCopy, { color: colors.mutedForeground }]}>{o.copy}</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 18 },
  title: { fontSize: 34, fontWeight: "900", letterSpacing: -1.4 },
  sub: { fontSize: 15, marginTop: 4 },
  list: { marginTop: 24, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1, borderRadius: 18, padding: 16 },
  icon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontSize: 17, fontWeight: "800" },
  rowCopy: { fontSize: 13, lineHeight: 18, marginTop: 2 },
});
