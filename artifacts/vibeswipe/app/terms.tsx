import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const supportEmail = "Realsimplesocialnet@gmail.com";

const sections: Array<[string, string]> = [
  ["1. Who operates MyAgeBeauty", "MyAgeBeauty is operated by VIBESWIPES LIMITED, a company registered in Nigeria. These Terms apply to the MyAgeBeauty website, progressive web app, and mobile app. By creating an account or using the service, you agree to these Terms. If you do not agree, do not use the service."],
  ["2. Eligibility and your account", "You must be at least 18 years old and legally able to enter into these Terms. Provide accurate information, protect your sign-in details, and use one account for yourself. Do not impersonate anyone, create a misleading profile, or let another person use your account. You are responsible for activity through your account."],
  ["3. The service", "MyAgeBeauty provides adult profiles, a social feed, people discovery, follows, likes, comments, private messaging, Reels, Stories, and safety tools. Features may change, be limited, or be unavailable in some places. We do not promise a particular number of users or uninterrupted service."],
  ["4. Community rules", "Do not harass, threaten, exploit, discriminate against, or defraud anyone; post illegal, non-consensual, or sexually exploitative content; share another person's private information without permission; impersonate someone; spam; or use MyAgeBeauty to request money or run a scam. Respect consent and boundaries. A follow or conversation is not consent to share private information, send money, or meet in person. Use Block and Report when needed."],
  ["5. Your content", "You keep ownership of content you submit. You give MyAgeBeauty a worldwide, non-exclusive permission to host, store, adapt for display, and show that content only as needed to operate, secure, and improve the service and to make it available to the audiences you choose. Remove content you no longer want to share. Copies already received by other members and records retained for safety, legal, or security reasons may remain."],
  ["6. Safety and verification", "Use care when communicating with people. MyAgeBeauty is not a background-check service and cannot guarantee another member's identity, conduct, or safety. Optional face verification checks a live image against a profile photo; it is not legal-identity, age, or location verification. Do not rely on a badge as a guarantee."],
  ["7. Moderation and account status", "You can block or report members. We may review reports, remove content, restrict features, suspend, or close accounts when needed to protect members, investigate abuse, enforce these Terms, or comply with law. Deactivation hides your profile and can be reversed; it is not account deletion. To request account or personal-data deletion, contact the support team."],
  ["8. Planned paid verification", "Paid verification is planned but is not available or chargeable now. The planned base price is ₦3,000 per month. When launched, the checkout screen will show the price and currency available to you; price, currency, and card acceptance may vary by country, card issuer, processor, and platform. Do not send card details to MyAgeBeauty support."],
  ["9. Future subscriptions, cancellation, and refunds", "If the planned verification subscription launches, it will renew monthly until you cancel it through the place where you purchased it. Cancellation stops the next renewal, and access continues through the paid period. If verification is declined or MyAgeBeauty cannot provide it, the charge will be refunded. Otherwise, there are no partial-month refunds except where required by law. Any required refund process and timing will be shown by the billing provider."],
  ["10. Cards and app-store billing", "No card or Paystack payments are currently being processed. Paystack may be considered for eligible card payments after launch, but it is not integrated now. For digital features in an Android app distributed through Google Play, Google Play Billing will be used unless an alternative billing method is expressly permitted and available under Google Play policy. Other platforms may have different purchase rules. The available payment methods will be shown before purchase."],
  ["11. Privacy and account deletion", "Our Privacy Policy explains how information is handled. Deactivating an account only hides the profile. To request deletion, email the support team from Settings or the contact link below; we will verify and handle the request under applicable law. Some records may be retained where necessary for legal compliance, safety, security, or dispute resolution."],
  ["12. Intellectual property and service availability", "MyAgeBeauty and its licensors own the service software, branding, and materials other than member content. Do not copy, reverse engineer, disrupt, or misuse the service, or use its content commercially without permission. The service is provided as available, subject to consumer and other rights that cannot be excluded under applicable law."],
  ["13. Changes, law, and contact", `We may update these Terms and will post the current version here. Last updated November 20, 2026. Nigerian law governs these Terms except where mandatory law in your place of residence gives you rights that cannot be waived. Questions, privacy requests, and deletion requests: ${supportEmail}.`],
];

function openSupport() {
  void Linking.openURL(`mailto:${supportEmail}?subject=MyAgeBeauty%20support%20request`).catch(() => {
    Alert.alert("Email app unavailable", `Please email ${supportEmail} for support.`);
  });
}

export default function TermsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 28 }]}
      testID="screen-terms"
    >
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={styles.back}>
        <Feather name="arrow-left" size={20} color={colors.foreground} />
      </Pressable>
      <Text style={[styles.brand, { color: colors.primary }]}>MyAgeBeauty</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>Terms of Service</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Rules for using MyAgeBeauty.</Text>
      <View style={[styles.notice, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <Feather name="info" size={16} color={colors.primary} />
        <Text style={[styles.noticeText, { color: colors.mutedForeground }]}>These plain-language Terms are not legal advice. VIBESWIPES LIMITED should have them reviewed by qualified counsel for the countries where the service operates.</Text>
      </View>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {sections.map(([title, detail], index) => (
          <View key={title} style={[styles.item, index > 0 && { borderTopColor: colors.border }]}>
            <Text style={[styles.itemTitle, { color: colors.foreground }]}>{title}</Text>
            <Text style={[styles.itemDetail, { color: colors.mutedForeground }]}>{detail}</Text>
          </View>
        ))}
      </View>
      <Pressable onPress={() => router.push("/privacy-policy")} style={[styles.link, { borderColor: colors.border }]}>
        <Feather name="lock" size={17} color={colors.primary} />
        <Text style={[styles.linkText, { color: colors.foreground }]}>Privacy Policy</Text>
        <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
      </Pressable>
      <Pressable onPress={() => router.push("/community-guidelines")} style={[styles.link, { borderColor: colors.border }]}>
        <Feather name="users" size={17} color={colors.primary} />
        <Text style={[styles.linkText, { color: colors.foreground }]}>Community Guidelines</Text>
        <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
      </Pressable>
      <Pressable onPress={openSupport} accessibilityRole="button" style={[styles.link, { borderColor: colors.border }]}>
        <Feather name="mail" size={17} color={colors.primary} />
        <Text style={[styles.linkText, { color: colors.foreground }]}>Contact support · {supportEmail}</Text>
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
  item: { gap: 5, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
  itemTitle: { fontSize: 14, fontWeight: "800" },
  itemDetail: { fontSize: 12, lineHeight: 18 },
  link: { minHeight: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  linkText: { flex: 1, fontSize: 13, fontWeight: "700" },
});
