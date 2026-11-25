import {
  getGetBlockedProfilesQueryKey,
  getGetDiscoverProfilesQueryKey,
  getGetMatchesQueryKey,
  useGetBlockedProfiles,
  useGetMyProfile,
  useUnblockProfile,
} from "@workspace/api-client-react";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppHeader } from "@/components/AppHeader";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { ProfileReelsSection } from "@/components/ProfileReelsSection";
import { ProfileFollowStats } from "@/components/ProfileFollow";
import { ReferralProfileCard } from "@/components/ReferralProfileCard";
import { usePremiumColors } from "@/hooks/useColors";
import { useState } from "react";

export default function ProfileScreen() {
  const colors = usePremiumColors();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [areaHeight, setAreaHeight] = useState(0);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const profile = useGetMyProfile();
  const blockedProfiles = useGetBlockedProfiles();
  const unblockProfile = useUnblockProfile();
  const queryClient = useQueryClient();
  async function unblock(profileId: string) {
    try {
      await unblockProfile.mutateAsync({ targetUserId: profileId });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetBlockedProfilesQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetMatchesQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetDiscoverProfilesQueryKey() }),
      ]);
    } catch {
      Alert.alert("Could not unblock profile", "Please try again.");
    }
  }
  if (profile.isLoading) {
    return <View style={[styles.root, { backgroundColor: colors.profileGradientMiddle }]}><AppHeader /><View style={styles.center}><ActivityIndicator color={colors.primary} /></View></View>;
  }
  if (!profile.data) {
    return <View style={[styles.root, { backgroundColor: colors.profileGradientMiddle }]}><AppHeader /><View style={styles.center}><ActivityIndicator color={colors.primary} accessibilityLabel="Loading" /></View></View>;
  }
  const user = profile.data;
  const place = [[user.city, user.state].filter(Boolean).join(", "), user.country].filter(Boolean).join(" · ");
  const g = (user.gender || "").toLowerCase();
  const genderIcon = /^(man|male|men)\b/.test(g) ? "gender-male" : /^(woman|female|women)\b/.test(g) ? "gender-female" : "gender-non-binary";
  const work = user.occupation === "Other" ? user.occupationOther || "Other" : user.occupation || "Prefer not to say";
  const bio = user.bio || "Add a bio so people can get to know you.";
  const tabBar = Platform.OS === "web" ? 84 : 49 + insets.bottom;
  const avail = (areaHeight || window.height - 100) - tabBar;
  const avatar = Math.round(Math.max(80, Math.min(112, avail * 0.14)));
  const blockedCount = blockedProfiles.data?.length ?? 0;
  return (
    <View style={[styles.root, { backgroundColor: colors.profileGradientMiddle }]} onLayout={(e) => setAreaHeight(e.nativeEvent.layout.height)}>
      <AppHeader />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBar + 18 }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.profileCard, { backgroundColor: colors.profileCard, borderColor: colors.border }]}>
          <View style={styles.cover}>
            <View style={styles.coverActions}>
              <Pressable testID="profile-blocked" accessibilityLabel={`Blocked profiles${blockedCount ? `, ${blockedCount}` : ""}`} onPress={() => setBlockedOpen(true)} style={styles.coverAction}>
                <Feather name="slash" size={18} color="#FFFFFF" />
              </Pressable>
              <Pressable testID="profile-settings" accessibilityLabel="Settings" onPress={() => router.push("/settings")} style={styles.coverAction}>
                <Feather name="settings" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          <View style={styles.profileIdentity}>
            <View style={[styles.portrait, { backgroundColor: colors.profileCard, borderColor: colors.profileCard, marginTop: -58 }]}>
              <ProfileAvatar profile={user} size={avatar} />
            </View>
            <View style={styles.identity}>
              <Text numberOfLines={2} accessibilityLabel={user.name} style={[styles.name, { color: colors.profileLabel }]}>{user.name}</Text>
              {user.isVerified ? <Feather name="check-circle" size={18} color={colors.profileLabel} accessibilityLabel="Verified profile" /> : null}
            </View>
            {work && work !== "Prefer not to say" ? <Text numberOfLines={1} style={[styles.city, { color: colors.profileMuted }]}>{work}</Text> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: detailsOpen }}
              onPress={() => setDetailsOpen((open) => !open)}
              style={styles.seeMore}
            >
              <Text style={[styles.seeMoreText, { color: colors.foreground }]}>{detailsOpen ? "See less" : "See more"}</Text>
              <Feather name={detailsOpen ? "chevron-up" : "chevron-down"} size={15} color={colors.foreground} />
            </Pressable>
          </View>

          <View style={styles.statsInset}>
            <ProfileFollowStats profileId={user.id} viewerId={user.id} showAction={false} />
          </View>

          <View style={styles.actionRow}>
            <Pressable testID="edit-profile" onPress={() => router.push("/edit-profile")} style={({ pressed }) => [styles.actionButton, { backgroundColor: colors.profileEdit, opacity: pressed ? 0.8 : 1 }]}>
              <Feather name="edit-2" size={16} color={colors.profileEditForeground} />
              <Text style={[styles.actionText, { color: colors.profileEditForeground }]}>Edit Profile</Text>
            </Pressable>
            <Pressable testID="find-users" onPress={() => router.push("/search")} style={({ pressed }) => [styles.actionButton, { backgroundColor: colors.secondary, opacity: pressed ? 0.8 : 1 }]}>
              <Feather name="search" size={17} color={colors.foreground} />
              <Text style={[styles.actionText, { color: colors.foreground }]}>Find @users</Text>
            </Pressable>
          </View>

          {detailsOpen && (
            <View style={styles.details}>
              <View style={styles.twoCol}>
                <View style={styles.detailSection}>
                  <Text style={[styles.detailHeading, { color: colors.foreground }]}>About me</Text>
                  <Text style={[styles.body, { color: colors.foreground }]}>{bio}</Text>
                  {user.age !== null ? <Text style={[styles.meta, { color: colors.mutedForeground, marginTop: 8 }]}>Age · {user.age}</Text> : null}
                  {place ? <Text style={[styles.city, styles.detailPlace, { color: colors.mutedForeground }]}>{place}</Text> : null}
                  {user.gender ? <View style={styles.genderRow}><MaterialCommunityIcons name={genderIcon} size={15} color={colors.mutedForeground} /><Text style={[styles.meta, { color: colors.mutedForeground }]}>{user.gender}</Text></View> : null}
                </View>
                <View style={styles.detailSection}>
                  <Text style={[styles.detailHeading, { color: colors.foreground }]}>Work</Text>
                  <Text style={[styles.body, { color: colors.foreground }]}>{work}</Text>
                </View>
              </View>
              <View style={styles.detailSection}>
                <Text style={[styles.detailHeading, { color: colors.foreground }]}>Hobbies</Text>
                {user.interests.length ? (
                  <View style={styles.tags} accessibilityLabel={`Hobbies: ${user.interests.join(", ")}`}>
                    {user.interests.map((item) => <Text key={item} numberOfLines={1} style={[styles.tag, { backgroundColor: colors.profileChip, color: colors.profileChipForeground }]}>{item}</Text>)}
                  </View>
                ) : <Text style={[styles.body, { color: colors.profileMuted }]}>Add a few interests to your profile.</Text>}
              </View>
              <ReferralProfileCard />
            </View>
          )}
        </View>

        <ProfileReelsSection key={`own-${user.id}`} profileId={user.id} returnTo="/(tabs)/profile" own />
      </ScrollView>
      <Modal visible={blockedOpen} transparent animationType="slide" onRequestClose={() => setBlockedOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setBlockedOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: 20 + insets.bottom, maxHeight: window.height * 0.7 }]}>
          <View style={styles.sheetHead}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Blocked profiles</Text>
            <Pressable accessibilityLabel="Close" onPress={() => setBlockedOpen(false)}><Feather name="x" size={20} color={colors.mutedForeground} /></Pressable>
          </View>
          {blockedProfiles.isLoading ? <ActivityIndicator color={colors.primary} style={styles.blockedLoading} /> : null}
          {blockedProfiles.isError ? <ActivityIndicator color={colors.primary} accessibilityLabel="Loading" style={styles.blockedLoading} /> : null}
          {!blockedProfiles.isLoading && !blockedProfiles.isError && !blockedCount ? <Text style={[styles.blockedHint, { color: colors.mutedForeground }]}>Profiles you block will appear here.</Text> : null}
          <ScrollView>
            {blockedProfiles.data?.map(({ profile: blocked }) => (
              <View key={blocked.id} style={[styles.blockedRow, { borderColor: colors.border }]}>
                <ProfileAvatar profile={blocked} size={44} />
                <View style={styles.blockedCopy}>
                  <Text numberOfLines={1} style={[styles.blockedName, { color: colors.foreground }]}>{blocked.name}</Text>
                  <Text style={[styles.blockedHint, { color: colors.destructive }]}>Blocked</Text>
                </View>
                <Pressable testID={`profile-unblock-${blocked.id}`} disabled={unblockProfile.isPending} onPress={() => void unblock(blocked.id)} style={[styles.unblockButton, { borderColor: colors.border, opacity: unblockProfile.isPending ? 0.6 : 1 }]}>
                  <Text style={[styles.unblockText, { color: colors.primary }]}>Unblock</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  retry: { borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 18, gap: 18, justifyContent: "flex-start" },
  profileCard: { overflow: "hidden", borderRadius: 24, borderWidth: StyleSheet.hairlineWidth },
  cover: { height: 116, backgroundColor: "#111111", justifyContent: "flex-end", position: "relative" },
  coverActions: { position: "absolute", top: 12, right: 12, flexDirection: "row", gap: 8 },
  coverAction: { width: 40, height: 40, borderRadius: 13, backgroundColor: "rgba(0,0,0,0.18)", alignItems: "center", justifyContent: "center" },
  profileIdentity: { alignItems: "center", paddingHorizontal: 18, paddingBottom: 12 },
  statsInset: { paddingHorizontal: 18 },
  portrait: { borderWidth: 3, borderRadius: 999, overflow: "hidden" },
  name: { fontSize: 26, lineHeight: 32, fontWeight: "800", textAlign: "center", letterSpacing: -0.5, marginTop: 10, maxWidth: "100%" },
  identity: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, maxWidth: "100%" },
  city: { fontSize: 14, marginTop: 5, textAlign: "center", maxWidth: "100%" },
  detailPlace: { textAlign: "left", marginTop: 8 },
  genderRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  meta: { fontSize: 12, fontWeight: "600" },
  seeMore: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 12 },
  seeMoreText: { fontSize: 13, fontWeight: "700" },
  actionRow: { flexDirection: "row", gap: 10, paddingHorizontal: 18, paddingBottom: 18 },
  actionButton: { flex: 1, minHeight: 46, borderRadius: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  actionText: { fontSize: 14, fontWeight: "700" },
  details: { paddingHorizontal: 18, paddingBottom: 18, gap: 18 },
  detailSection: { gap: 7 },
  detailHeading: { fontSize: 16, fontWeight: "800" },
  twoCol: { flexDirection: "row", gap: 14 },
  body: { fontSize: 14, lineHeight: 21 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  tag: { overflow: "hidden", borderRadius: 20, paddingHorizontal: 13, paddingVertical: 7, fontSize: 13, fontWeight: "600", maxWidth: 160 },
  backdrop: { flex: 1, backgroundColor: "rgba(20,10,16,0.35)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18 },
  sheetHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  sheetTitle: { fontSize: 17, fontWeight: "800" },
  blockedHint: { fontSize: 12, lineHeight: 18 },
  blockedLoading: { marginVertical: 12 },
  blockedRow: { minHeight: 62, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 10 },
  blockedCopy: { flex: 1, minWidth: 0 },
  blockedName: { fontSize: 13, fontWeight: "700" },
  unblockButton: { borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 9 },
  unblockText: { fontSize: 12, fontWeight: "700" },
});
