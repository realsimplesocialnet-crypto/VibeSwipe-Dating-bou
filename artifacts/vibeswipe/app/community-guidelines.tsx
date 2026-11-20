import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const guidelines = [
  ["Adults 18 and over", "VIBESWIPES is for adults only. Do not create an account if you are under 18, and keep your profile information honest."],
  ["Respect other people", "Harassment, hate speech, threats, unwanted pressure, and sharing someone’s private information are not allowed."],
  ["No scams or fake profiles", "Do not request or send money, misrepresent who you are, impersonate another person, or use a fake profile."],
  ["Respect consent and boundaries", "A match is not consent to share private information, images, or contact details. Use Block or Report when needed."],
  ["Use VIBESWIPES responsibly", "Do not use the service to threaten, defraud, spam, or harm others. VIBESWIPES may restrict accounts that violate these rules."],
];

const supportEmail = "Realsimplesocialnet@gmail.com";

function openSupport() {
  void Linking.openURL(`mailto:${supportEmail}?subject=VIBESWIPES%20support%20request`).catch(() => {
    Alert.alert("Email app unavailable", `Please email ${supportEmail} for support.`);
  });
}

export default function CommunityGuidelinesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 36 }]}
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
          <Text style={[styles.eyebrow, { color: colors.primary }]}>VIBESWIPES</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Community Guidelines</Text>
        </View>
      </View>
      <View style={[styles.notice, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <Feather name="info" size={16} color={colors.primary} />
        <Text style={[styles.noticeText, { color: colors.mutedForeground }]}>These community rules are not legal advice. VIBESWIPES LIMITED should have its legal documents reviewed by qualified counsel.</Text>
      </View>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>
          By creating an account or using VIBESWIPES, you agree to follow these rules.
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
        onPress={() => router.push("/privacy-policy")}
        style={[styles.safetyLink, { backgroundColor: colors.secondary }]}
      >
        <Feather name="lock" size={17} color={colors.primary} />
        <Text style={[styles.safetyLinkText, { color: colors.foreground }]}>Privacy Policy</Text>
        <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
      </Pressable>
      <Pressable
        onPress={() => router.push("/terms")}
        style={[styles.safetyLink, { backgroundColor: colors.secondary }]}
      >
        <Feather name="book-open" size={17} color={colors.primary} />
        <Text style={[styles.safetyLinkText, { color: colors.foreground }]}>Terms of Service</Text>
        <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
      </Pressable>
      <Pressable
        onPress={() => router.push("/report-safety")}
        style={[styles.safetyLink, { backgroundColor: colors.secondary }]}
      >
        <Feather name="shield" size={17} color={colors.primary} />
        <Text style={[styles.safetyLinkText, { color: colors.foreground }]}>Report a safety issue</Text>
        <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
      </Pressable>
      <Pressable
        onPress={openSupport}
        accessibilityRole="button"
        style={[styles.safetyLink, { backgroundColor: colors.secondary }]}
      >
        <Feather name="mail" size={17} color={colors.primary} />
        <Text style={[styles.safetyLinkText, { color: colors.foreground }]}>Contact support · {supportEmail}</Text>
        <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  back: { width: 36, height: 44, justifyContent: "center" },
  eyebrow: { fontSize: 9, letterSpacing: 1.6, fontWeight: "800", marginBottom: 4 },
  title: { fontSize: 25, fontWeight: "800" },
  card: { borderWidth: 1, borderRadius: 20, padding: 17 },
  intro: { fontSize: 13, lineHeight: 20, marginBottom: 6 },
  notice: { borderWidth: 1, borderRadius: 14, padding: 13, flexDirection: "row", alignItems: "flex-start", gap: 9 },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18 },
  item: { flexDirection: "row", gap: 12, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
  number: { width: 28, height: 28, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  numberText: { fontSize: 12, fontWeight: "800" },
  copy: { flex: 1, gap: 4 },
  itemTitle: { fontSize: 14, fontWeight: "800" },
  itemDetail: { fontSize: 12, lineHeight: 18 },
  safetyLink: { minHeight: 48, borderRadius: 14, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  safetyLinkText: { flex: 1, fontSize: 13, fontWeight: "700" },
});
