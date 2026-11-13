import { useAuth } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/hooks/useTheme";

export default function SettingsScreen() {
  const colors = useColors();
  const { signOut } = useAuth();
  const { scheme, setScheme } = useTheme();
  const dark = scheme === "dark";

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>
      </View>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: colors.accent }]}><Feather name="moon" size={17} color={colors.primary} /></View>
          <View style={styles.copy}>
            <Text style={[styles.rowTitle, { color: colors.foreground }]}>Dark appearance</Text>
            <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>Choose a comfortable theme.</Text>
          </View>
          <Switch value={dark} onValueChange={(value) => void setScheme(value ? "dark" : "light")} trackColor={{ true: colors.primary }} />
        </View>
      </View>
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SAFETY</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.safety}>
          <Feather name="shield" size={19} color={colors.primary} />
          <View style={styles.copy}>
            <Text style={[styles.rowTitle, { color: colors.foreground }]}>Your safety matters</Text>
            <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>You can block and report a profile from its details.</Text>
          </View>
        </View>
      </View>
      <Pressable onPress={() => void signOut().then(() => router.replace("/"))} style={[styles.signOut, { borderColor: colors.border }]}>
        <Feather name="log-out" size={17} color={colors.destructive} />
        <Text style={[styles.signOutText, { color: colors.destructive }]}>Sign out</Text>
      </Pressable>
      <Text style={[styles.version, { color: colors.mutedForeground }]}>VibeSwipe · 18+</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, paddingTop: 58 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 26 },
  back: { width: 36, height: 40, justifyContent: "center" },
  title: { fontSize: 25, fontWeight: "700" },
  section: { borderWidth: 1, borderRadius: 18, padding: 15, marginBottom: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 11 },
  icon: { width: 36, height: 36, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 14, fontWeight: "700" },
  rowSub: { fontSize: 12, lineHeight: 17 },
  sectionLabel: { fontSize: 10, letterSpacing: 1.4, fontWeight: "700", marginBottom: 9 },
  safety: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  signOut: { height: 50, borderRadius: 14, borderWidth: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 5 },
  signOutText: { fontSize: 14, fontWeight: "700" },
  version: { textAlign: "center", marginTop: 25, fontSize: 11 },
});
