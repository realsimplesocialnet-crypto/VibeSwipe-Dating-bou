import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const sections = [
  ["Information collected", "Myage stores account and profile details you provide, including your name, age, gender, dating preferences, biography, interests, work, photos, and registered city, state, and country. When you use the service, it also processes likes, matches, profile views, messages and attachments, online status, and safety actions such as blocks and reports. Emergency contacts and temporary live-location details are used only if you choose those Safety Center features."],
  ["How information is used", "We use this information to create and display your profile, show relevant people, make matches, deliver messages and notifications, operate safety tools, and maintain the service. We do not sell personal information."],
  ["What other members can see", "Profile details you add—such as your photo, name, age, location, biography, work, and interests—may be shown to other Myage members. Messages are visible to the people in that conversation. Safety reports, account credentials, and emergency-contact details are not public profile information. A live-location link is available to people you choose to share it with until it expires or is stopped."],
  ["Service providers and storage", "Clerk handles account sign-in. Myage uses Replit-hosted application services, PostgreSQL, and file storage to operate the service and store profiles, messages, and uploaded media. These providers process information to provide their services to Myage; their own privacy terms also apply."],
  ["Your choices", "You can update profile details from the Profile area and control safety and visibility features in Settings. Share only information you are comfortable showing to other members."],
  ["Adults only and changes", "Myage is for people aged 18 and over. We do not knowingly allow minors to use the service. We may update this notice when the service or its data practices change; the current version will be available here."],
];

export default function PrivacyPolicyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 28 }]}
      testID="screen-privacy-policy"
    >
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={styles.back}>
        <Feather name="arrow-left" size={20} color={colors.foreground} />
      </Pressable>
      <Text style={[styles.brand, { color: colors.primary }]}>MYAGE · MYAGE.BEAUTY</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>Privacy Policy</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>What information helps Myage work, and what stays private.</Text>
      <View style={[styles.notice, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <Feather name="info" size={16} color={colors.primary} />
        <Text style={[styles.noticeText, { color: colors.mutedForeground }]}>This is a plain-language notice, not legal advice. The Myage operator should review it for the laws that apply to the business.</Text>
      </View>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {sections.map(([title, detail], index) => (
          <View key={title} style={[styles.item, index > 0 && { borderTopColor: colors.border }]}>
            <View style={[styles.number, { backgroundColor: colors.accent }]}>
              <Text style={[styles.numberText, { color: colors.primary }]}>{String(index + 1).padStart(2, "0")}</Text>
            </View>
            <View style={styles.copy}>
              <Text style={[styles.itemTitle, { color: colors.foreground }]}>{title}</Text>
              <Text style={[styles.itemDetail, { color: colors.mutedForeground }]}>{detail}</Text>
            </View>
          </View>
        ))}
      </View>
      <Pressable onPress={() => router.push("/terms")} style={[styles.link, { borderColor: colors.border }]}>
        <Feather name="book-open" size={17} color={colors.primary} />
        <Text style={[styles.linkText, { color: colors.foreground }]}>Terms of Service</Text>
        <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
      </Pressable>
      <Pressable onPress={() => router.push("/report-safety")} style={[styles.link, { borderColor: colors.border }]}>
        <Feather name="shield" size={17} color={colors.primary} />
        <Text style={[styles.linkText, { color: colors.foreground }]}>Report a safety issue</Text>
        <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 14 },
  back: { width: 40, height: 40, justifyContent: "center" },
  brand: { fontSize: 9, fontWeight: "800", letterSpacing: 1.6 },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.7 },
  subtitle: { fontSize: 14, lineHeight: 21, marginTop: -8 },
  notice: { borderWidth: 1, borderRadius: 14, padding: 13, flexDirection: "row", alignItems: "flex-start", gap: 9 },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18 },
  card: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 15, paddingVertical: 2 },
  item: { flexDirection: "row", gap: 11, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
  number: { width: 28, height: 28, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  numberText: { fontSize: 11, fontWeight: "800" },
  copy: { flex: 1, gap: 4 },
  itemTitle: { fontSize: 14, fontWeight: "800" },
  itemDetail: { fontSize: 12, lineHeight: 18 },
  link: { minHeight: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  linkText: { flex: 1, fontSize: 13, fontWeight: "700" },
});
