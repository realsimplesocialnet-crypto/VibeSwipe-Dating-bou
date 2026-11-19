import {
  getGetBlockedProfilesQueryKey,
  getGetDiscoverProfilesQueryKey,
  getGetMatchesQueryKey,
  useGetBlockedProfiles,
  useGetMyProfile,
  useGetVibeSwipeSettings,
  useUnblockProfile,
} from "@workspace/api-client-react";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Platform } from "react-native";
import { useAuth } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { ProfileLikedReelsSection, ProfileReelsSection } from "@/components/ProfileReelsSection";
import { ProfileFollowStats } from "@/components/ProfileFollow";
import { ReferralProfileCard } from "@/components/ReferralProfileCard";
import { usePremiumColors } from "@/hooks/useColors";
import { profileImageSource } from "@/lib/media";
import { useEffect, useState } from "react";

export default function ProfileScreen() {
  const colors = usePremiumColors();
  const { getToken } = useAuth();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [areaHeight, setAreaHeight] = useState(0);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [mediaToken, setMediaToken] = useState<string | null>(null);
  const profile = useGetMyProfile();
  const settings = useGetVibeSwipeSettings();
  const blockedProfiles = useGetBlockedProfiles();
  const unblockProfile = useUnblockProfile();
  const queryClient = useQueryClient();
  useEffect(() => {
    let active = true;
    void getToken().then((value) => {
      if (active) setMediaToken(value);
    });
    return () => {
      active = false;
    };
  }, [getToken]);

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
    return <View style={[styles.center, { backgroundColor: colors.profileGradientMiddle }]}><ActivityIndicator color={colors.primary} /></View>;
  }
  if (!profile.data) {
    return <View style={[styles.center, { backgroundColor: colors.profileGradientMiddle }]}><ActivityIndicator color={colors.primary} accessibilityLabel="Loading" /></View>;
  }
  const user = profile.data;
  const place = [[user.city, user.state].filter(Boolean).join(", "), user.country].filter(Boolean).join(" · ");
  const g = (user.gender || "").toLowerCase();
  const genderIcon = /^(man|male|men)\b/.test(g) ? "gender-male" : /^(woman|female|women)\b/.test(g) ? "gender-female" : "gender-non-binary";
  const work = user.occupation === "Other" ? user.occupationOther || "Other" : user.occupation || "Prefer not to say";
  const bio = user.bio || "Add a bio so people can get to know you.";
  // Tab bar is absolutely positioned; header (title) already owns the top inset.
  const tabBar = Platform.OS === "web" ? 84 : 49 + insets.bottom;
  const avail = (areaHeight || window.height - 100) - tabBar;
  const tight = avail < 560;
  const avatar = Math.round(Math.max(64, Math.min(140, avail * 0.17)));
  const gap = tight ? 7 : 11;
  const shownHobbies = user.interests.slice(0, tight ? 3 : 4);
  const moreHobbies = user.interests.length - shownHobbies.length;
  const photos = user.photos.slice(0, 6);
  const travel = settings.data?.travelMode && settings.data.travelCity ? settings.data.travelCity : null;
  const blockedCount = blockedProfiles.data?.length ?? 0;
  const sectionHead = (icon: "user" | "briefcase" | "heart" | "camera", title: string) => (
    <View style={styles.sectionHead}>
      <View style={[styles.sectionIcon, { backgroundColor: colors.profileChip }]}><Feather name={icon} size={12} color={colors.profileEdit} /></View>
      <Text style={[styles.label, { color: colors.profileLabel }]}>{title}</Text>
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: colors.profileGradientMiddle }} onLayout={(e) => setAreaHeight(e.nativeEvent.layout.height)}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBar + gap, paddingTop: tight ? 8 : 12, gap }]} showsVerticalScrollIndicator={false}>
        <View style={styles.top}>
          <Pressable testID="profile-blocked" accessibilityLabel="Blocked profiles" onPress={() => setBlockedOpen(true)} style={({ pressed }) => [styles.pill, { backgroundColor: colors.profileCard, opacity: pressed ? 0.7 : 1 }]}>
            <Feather name="slash" size={14} color={colors.profileMuted} />
            <Text style={[styles.pillText, { color: colors.profileMuted }]}>Blocked{blockedCount ? ` (${blockedCount})` : ""}</Text>
          </Pressable>
          <Pressable testID="profile-settings" accessibilityLabel="Settings" onPress={() => router.push("/settings")} style={({ pressed }) => [styles.pill, { backgroundColor: colors.profileCard, opacity: pressed ? 0.7 : 1 }]}>
            <Feather name="settings" size={15} color={colors.profileLabel} />
            <Text style={[styles.pillText, { color: colors.profileLabel }]}>Settings</Text>
          </Pressable>
        </View>
        <View style={[styles.card, { backgroundColor: colors.profileCard, paddingVertical: tight ? 10 : 16 }]}>
          <View style={[styles.portrait, { borderColor: colors.profileChip }]}><ProfileAvatar profile={user} size={avatar} /></View>
          <View style={styles.identity}>
            <Text numberOfLines={1} accessibilityLabel={`${user.name}${user.age !== null ? `, ${user.age}` : ""}`} style={[styles.name, { color: colors.profileLabel, fontSize: tight ? 22 : 26 }]}>{user.name}{user.age !== null ? `, ${user.age}` : ""}</Text>
            {user.isVerified ? <Feather name="check-circle" size={18} color={colors.premiumAccent} accessibilityLabel="Verified profile" /> : null}
          </View>
          {place ? <Text numberOfLines={1} accessibilityLabel={place} style={[styles.city, { color: colors.profileMuted }]}>{place}</Text> : null}
          {user.gender || travel ? (
            <View style={styles.metaRow}>
              {user.gender ? <View style={styles.genderRow}><MaterialCommunityIcons name={genderIcon} size={15} color={colors.profileMuted} /><Text style={[styles.meta, { color: colors.profileMuted }]}>{user.gender}</Text></View> : null}
              {travel ? <View style={[styles.travelBadge, { backgroundColor: colors.profileChip }]}><Feather name="navigation" size={11} color={colors.profileChipForeground} /><Text numberOfLines={1} style={[styles.travelBadgeText, { color: colors.profileChipForeground }]}>Traveling · {travel}</Text></View> : null}
            </View>
          ) : null}
          <ProfileFollowStats profileId={user.id} viewerId={user.id} showAction={false} />
          <ReferralProfileCard />
          <Pressable testID="edit-profile" onPress={() => router.push("/edit-profile")} style={({ pressed }) => [styles.editButton, { height: tight ? 42 : 48, marginTop: tight ? 8 : 12, backgroundColor: colors.profileEdit, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
            <Feather name="edit-2" size={15} color={colors.profileEditForeground} />
            <Text style={[styles.editText, { color: colors.profileEditForeground }]}>Edit profile</Text>
          </Pressable>
        </View>
        <View style={[styles.twoCol, { gap }]}>
          <View style={[styles.sectionCard, styles.half, { backgroundColor: colors.profileCard }]}>
            {sectionHead("user", "ABOUT")}
            <Text numberOfLines={2} accessibilityLabel={bio} style={[styles.body, { color: colors.profileLabel }]}>{bio}</Text>
          </View>
          <View style={[styles.sectionCard, styles.half, { backgroundColor: colors.profileCard }]}>
            {sectionHead("briefcase", "WORK")}
            <Text numberOfLines={2} accessibilityLabel={work} style={[styles.body, { color: colors.profileLabel }]}>{work}</Text>
          </View>
        </View>
        <View style={[styles.sectionCard, { backgroundColor: colors.profileCard }]}>
          {sectionHead("heart", "HOBBIES")}
          {user.interests.length ? (
            <View style={styles.tags} accessibilityLabel={`Hobbies: ${user.interests.join(", ")}`}>
              {shownHobbies.map((item) => <Text key={item} numberOfLines={1} style={[styles.tag, { backgroundColor: colors.profileChip, color: colors.profileChipForeground }]}>{item}</Text>)}
              {moreHobbies > 0 ? <Pressable accessibilityLabel={`${moreHobbies} more hobbies, open editor`} onPress={() => router.push("/edit-profile")}><Text style={[styles.tag, { backgroundColor: colors.profileChip, color: colors.profileEdit }]}>+{moreHobbies}</Text></Pressable> : null}
            </View>
          ) : <Text style={[styles.body, { color: colors.profileMuted }]}>Add a few interests to your profile.</Text>}
        </View>
        <View style={[styles.sectionCard, { backgroundColor: colors.profileCard }]}>
          <View style={styles.photoHeading}>
            <View style={styles.sectionHeadRow}>{sectionHead("camera", "PHOTOS")}<Text style={[styles.meta, { color: colors.profileMuted, marginBottom: 6 }]}>{user.photos.length}/6</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Manage profile photos" onPress={() => router.push("/edit-profile")} style={[styles.managePhotos, { backgroundColor: colors.profileChip }]}>
              <Feather name="camera" size={12} color={colors.profileEdit} />
              <Text style={[styles.managePhotosText, { color: colors.profileEdit }]}>Manage</Text>
            </Pressable>
          </View>
          {photos.length ? (
            <View style={styles.mediaRow}>
              {photos.map((photo, index) => (
                <View key={`${photo}-${index}`} accessibilityLabel={`Profile photo ${index + 1}${index === 0 ? " (main)" : ""}`} style={[styles.mediaThumb, { backgroundColor: colors.profileChip }]}>
                  {profileImageSource(photo, mediaToken) ? <Image source={profileImageSource(photo, mediaToken)} style={styles.mediaImage} resizeMode="cover" /> : <Feather name="image" size={16} color={colors.profileMuted} />}
                  {index === 0 ? <View style={[styles.mainPhotoBadge, { backgroundColor: colors.profileEdit }]}><Text style={[styles.mainPhotoBadgeText, { color: colors.profileEditForeground }]}>Main</Text></View> : null}
                </View>
              ))}
              {Array.from({ length: 6 - photos.length }).map((_, i) => <View key={`empty-${i}`} style={[styles.mediaThumb, { backgroundColor: colors.profileChip, opacity: 0.5 }]} />)}
            </View>
          ) : <Text style={[styles.body, { color: colors.profileMuted }]}>Add photos in Edit profile.</Text>}
        </View>
        <ProfileReelsSection profileId={user.id} returnTo="/(tabs)/profile" />
        <ProfileLikedReelsSection profileId={user.id} returnTo="/(tabs)/profile" />
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
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  retry: { borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 16, justifyContent: "flex-start" },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pill: { height: 36, borderRadius: 18, paddingHorizontal: 13, flexDirection: "row", gap: 6, alignItems: "center" },
  pillText: { fontSize: 13, fontWeight: "700" },
  card: { borderRadius: 24, paddingHorizontal: 16, alignItems: "center" },
  portrait: { borderWidth: 3, borderRadius: 999, overflow: "hidden" },
  name: { fontWeight: "800", textAlign: "center", letterSpacing: -0.5, marginTop: 6, maxWidth: "100%" },
  identity: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, maxWidth: "100%" },
  city: { fontSize: 14, marginTop: 2, textAlign: "center", maxWidth: "100%" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4, maxWidth: "100%" },
  genderRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  meta: { fontSize: 12, fontWeight: "600" },
  travelBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, flexShrink: 1 },
  travelBadgeText: { fontSize: 11, fontWeight: "700", flexShrink: 1 },
  editButton: { flexDirection: "row", gap: 8, borderRadius: 26, alignSelf: "stretch", marginHorizontal: 20, alignItems: "center", justifyContent: "center" },
  editText: { fontSize: 16, fontWeight: "700" },
  twoCol: { flexDirection: "row" },
  half: { flex: 1, minWidth: 0 },
  sectionCard: { borderRadius: 18, paddingHorizontal: 13, paddingVertical: 10 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 6 },
  sectionHeadRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionIcon: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4 },
  body: { fontSize: 13, lineHeight: 18 },
  tags: { flexDirection: "row", flexWrap: "nowrap", gap: 6, overflow: "hidden" },
  tag: { overflow: "hidden", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, fontSize: 12, fontWeight: "600", maxWidth: 120 },
  photoHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  managePhotos: { flexDirection: "row", gap: 5, alignItems: "center", borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5, marginBottom: 6 },
  managePhotosText: { fontSize: 11, fontWeight: "700" },
  mediaRow: { flexDirection: "row", gap: 5 },
  mediaThumb: { flex: 1, aspectRatio: 1, borderRadius: 10, alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" },
  mediaImage: { width: "100%", height: "100%" },
  mainPhotoBadge: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", paddingVertical: 1 },
  mainPhotoBadgeText: { fontSize: 8, fontWeight: "800" },
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
