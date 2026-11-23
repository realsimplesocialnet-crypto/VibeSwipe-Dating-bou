import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const supportEmail = "Realsimplesocialnet@gmail.com";

const sections: Array<[string, string]> = [
  ["Who we are", "MyAgeBeauty is operated by VIBESWIPES LIMITED, a company registered in Nigeria. This notice applies to the MyAgeBeauty website, progressive web app, and mobile app. The service is intended for adults worldwide. Mandatory privacy rights in the country where you live continue to apply."],
  ["Information we collect", "We process account and profile information you provide, such as your name, age, email or account identifier, gender, biography, interests, work, photos and videos, and the city, state, or country you choose to add. We also process activity needed to run the service, including follows, profile views, posts, Reels, Stories, captions, comments, saved content, messages, attachments, blocks, and reports."],
  ["Location and safety information", "You choose your country during signup; signup does not request device location. If you enable a nearby-discovery feature or choose temporary live-location sharing in Safety Center, we may process device location for that feature. A live-location link is shared only with people you choose and remains available until it expires or you stop it. Emergency-contact details are processed only when you choose that feature."],
  ["Optional face verification", "If face verification is available and you choose to use it, a live camera image and the profile photo selected for checking are sent to Luxand for liveness and face-similarity checks. The live camera frame is not saved as a profile or message photo by MyAgeBeauty. A protected checked copy of the selected profile photo may be stored as verification evidence and, after a successful check, used as your main profile photo; it is shown according to your account settings and remains subject to normal profile-photo retention. Verification records can include photo references, status, and review details. Face checks are optional, are not proof of legal identity, and do not establish your age or location. Routine cleanup removes pending, processing, failed, or passed session records after 24 hours; requests awaiting review are expired after 30 days, and completed or cancelled session records are removed after 90 days. That session cleanup does not remove a checked photo that remains on your profile. Luxand's own terms and retention practices also apply."],
  ["How we use information", "We use information to create and display profiles, provide a social feed and people discovery, support follows, deliver messages and notifications, provide safety and moderation tools, respond to requests, prevent abuse, secure the service, and maintain its features. We do not sell personal information."],
  ["What other people can see", "Information and content you post may be shown according to your account and audience settings. Public content may be visible to people beyond your approved followers. Private-account content is limited to approved followers. Messages and attachments are available to the people in that conversation. A location link is available to the recipients you select. Do not post anything you are not comfortable sharing with that audience."],
  ["Service providers and sharing", "Clerk provides account authentication. Replit hosts application services, the database, and file storage. Luxand processes face-verification images when you choose that feature. Expo and the relevant browser or device push service may process notification tokens and delivery information. These providers process data to provide their services. We may also disclose information when legally required or when reasonably necessary to protect users, investigate abuse, enforce our terms, or protect the service."],
  ["Authorized administrator access", "Authorized administrators may review account details, online status, posts, stored conversations, and attachments for support, safety, moderation, and service operation. Private conversation inspection, media access, and conversation exports are recorded in an administrator access log. This does not give administrators access to activity in other apps or to messages you have not sent."],
  ["Retention, access, and deletion requests", "We keep account information while your account is active and as needed to provide the service, protect members, resolve disputes, and meet legal obligations. Deactivating an account hides your profile but is reversible and does not itself delete stored information. To request access, correction, or deletion, email the support team. We will verify and handle the request under the laws that apply; some information may need to be retained for safety, legal, or security reasons."],
  ["Your choices and device storage", "You can edit profile details, manage visibility and safety settings, block or report members, and control device notifications in the app. The web app uses essential browser storage and session cookies for sign-in, settings, and installation state; disabling them may prevent some features from working. Payments are not currently enabled. We will update this notice before collecting payment information for a future paid feature."],
  ["International processing, security, and children", "Because MyAgeBeauty serves users in multiple countries, our service providers may process information outside your country, subject to protections required by applicable law. We use access controls and other safeguards, but no online service can guarantee absolute security. MyAgeBeauty is for adults aged 18 and over; do not create an account if you are under 18."],
  ["Updates and contact", `We may update this policy when the service or its data practices change. The latest version will be posted here. Last updated November 20, 2026. For privacy questions or requests, contact ${supportEmail}.`],
];

function openSupport() {
  void Linking.openURL(`mailto:${supportEmail}?subject=MyAgeBeauty%20privacy%20request`).catch(() => {
    Alert.alert("Email app unavailable", `Please email ${supportEmail} for a privacy request.`);
  });
}

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
      <Text style={[styles.brand, { color: colors.primary }]}>MyAgeBeauty</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>Privacy Policy</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>How MyAgeBeauty handles information when you use the service.</Text>
      <View style={[styles.notice, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <Feather name="info" size={16} color={colors.primary} />
        <Text style={[styles.noticeText, { color: colors.mutedForeground }]}>This plain-language privacy notice is not legal advice. VIBESWIPES LIMITED should have it reviewed by qualified counsel for the countries where the service operates.</Text>
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
  item: { flexDirection: "row", gap: 11, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
  number: { width: 28, height: 28, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  numberText: { fontSize: 11, fontWeight: "800" },
  copy: { flex: 1, gap: 4 },
  itemTitle: { fontSize: 14, fontWeight: "800" },
  itemDetail: { fontSize: 12, lineHeight: 18 },
  link: { minHeight: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  linkText: { flex: 1, fontSize: 13, fontWeight: "700" },
});
