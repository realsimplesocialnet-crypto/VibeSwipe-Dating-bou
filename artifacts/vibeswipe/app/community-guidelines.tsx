import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

const guidelines = [
  ["Be respectful", "Treat every person with care. No harassment, hate speech, threats, or unwanted pressure."],
  ["Be genuine", "Use an accurate profile and represent yourself honestly."],
  ["Respect consent", "A match is not consent to share private information, images, or contact details."],
  ["Keep it safe", "Do not request or send money. Report suspicious behavior and use Block when needed."],
];

export default function CommunityGuidelinesScreen() {
  const colors = useColors();
  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      testID="screen-community-guidelines"
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={styles.back}
        >
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <View>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>VIBESWIPE COMMUNITY</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Guidelines</Text>
        </View>
      </View>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>
          VibeSwipe is for adults looking to meet with respect, honesty, and care.
        </Text>
        {guidelines.map(([title, detail], index) => (
          <View key={title} style={[styles.item, index > 0 && { borderTopColor: colors.border }]}>
            <View style={[styles.number, { backgroundColor: colors.accent }]}>
              <Text style={[styles.numberText, { color: colors.primary }]}>{index + 1}</Text>
            </View>
            <View style={styles.copy}>
              <Text style={[styles.itemTitle, { color: colors.foreground }]}>{title}</Text>
              <Text style={[styles.itemDetail, { color: colors.mutedForeground }]}>{detail}</Text>
            </View>
          </View>
        ))}
      </View>
      <Pressable
        onPress={() => router.push("/safety-center")}
        style={[styles.safetyLink, { backgroundColor: colors.secondary }]}
      >
        <Feather name="shield" size={17} color={colors.primary} />
        <Text style={[styles.safetyLinkText, { color: colors.foreground }]}>Back to Safety Center</Text>
        <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, paddingTop: 58, paddingBottom: 36, gap: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  back: { width: 36, height: 44, justifyContent: "center" },
  eyebrow: { fontSize: 9, letterSpacing: 1.6, fontWeight: "800", marginBottom: 4 },
  title: { fontSize: 25, fontWeight: "800" },
  card: { borderWidth: 1, borderRadius: 20, padding: 17 },
  intro: { fontSize: 13, lineHeight: 20, marginBottom: 6 },
  item: { flexDirection: "row", gap: 12, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
  number: { width: 28, height: 28, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  numberText: { fontSize: 12, fontWeight: "800" },
  copy: { flex: 1, gap: 4 },
  itemTitle: { fontSize: 14, fontWeight: "800" },
  itemDetail: { fontSize: 12, lineHeight: 18 },
  safetyLink: { minHeight: 48, borderRadius: 14, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  safetyLinkText: { flex: 1, fontSize: 13, fontWeight: "700" },
});
