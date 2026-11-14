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
import { LinearGradient } from "expo-linear-gradient";
import { Platform } from "react-native";
import { useAuth } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Alert } from "react-native";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useColors } from "@/hooks/useColors";
import { profileImageSource } from "@/lib/media";
import { useEffect, useState } from "react";

export default function ProfileScreen() {
  const colors = useColors();
  const { signOut, getToken } = useAuth();
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
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  }
  if (!profile.data) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={{ color: colors.foreground }}>Profile unavailable.</Text></View>;
  }
  const user = profile.data;
  const cityLine = [user.city, user.state].filter(Boolean).join(", ");
  const g = (user.gender || "").toLowerCase();
  const genderIcon = /^(man|male|men)\b/.test(g) ? "gender-male" : /^(woman|female|women)\b/.test(g) ? "gender-female" : "gender-non-binary";
  const work = user.occupation === "Other" ? user.occupationOther || "Other" : user.occupation || "Prefer not to say";
  const topPad = Platform.OS === "web" ? 67 : 16;
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ flex: 1, backgroundColor: colors.profileGradientMiddle }} contentContainerStyle={[styles.container, { paddingTop: topPad }]}>
      <LinearGradient colors={[colors.profileGradientStart, colors.profileGradientMiddle, colors.profileGradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.top}>
        <Pressable testID="profile-settings" accessibilityLabel="Settings" onPress={() => router.push("/settings")} style={({ pressed }) => [styles.settings, { backgroundColor: colors.profileCard, opacity: pressed ? 0.7 : 1 }]}>
          <Feather name="settings" size={18} color={colors.profileLabel} />
        </Pressable>
      </View>
      <View style={[styles.portrait, { borderColor: colors.profileCard }]}>
        <ProfileAvatar profile={user} size={160} />
      </View>
      <View style={[styles.card, { backgroundColor: colors.profileCard }]}>
        <Text style={[styles.name, { color: colors.profileLabel }]}>{user.name}{user.age !== null ? `, ${user.age}` : ""}</Text>
        {cityLine ? <Text style={[styles.city, { color: colors.profileMuted }]}>{cityLine}</Text> : null}
        {user.country ? <Text style={[styles.city, { color: colors.profileMuted }]}>{user.country}</Text> : null}
        {user.gender ? (
          <View style={styles.genderRow}>
            <MaterialCommunityIcons name={genderIcon} size={18} color={colors.profileMuted} />
            <Text style={[styles.city, { color: colors.profileMuted }]}>{user.gender}</Text>
          </View>
        ) : null}
        {settings.data?.travelMode && settings.data.travelCity ? (
          <View style={[styles.travelBadge, { backgroundColor: colors.profileChip }]}>
            <Feather name="navigation" size={12} color={colors.profileChipForeground} />
            <Text style={[styles.travelBadgeText, { color: colors.profileChipForeground }]}>Traveling · {settings.data.travelCity}</Text>
          </View>
        ) : null}
        <Pressable testID="edit-profile" onPress={() => router.push("/edit-profile")} style={({ pressed }) => [styles.editButton, { backgroundColor: colors.profileEdit, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
          <Text style={[styles.editText, { color: colors.profileEditForeground }]}>Edit profile</Text>
        </Pressable>
        <View style={styles.details}>
          <Text style={[styles.label, { color: colors.profileLabel }]}>A LITTLE ABOUT ME</Text>
          <Text style={[styles.bio, { color: colors.profileLabel }]}>{user.bio || "Add a bio so people can get to know you."}</Text>
          <View style={[styles.rule, { backgroundColor: colors.profileRule }]} />
          <Text style={[styles.label, { color: colors.profileLabel }]}>WORK / OCCUPATION</Text>
          <Text style={[styles.bio, { color: colors.profileLabel }]}>{work}</Text>
          <View style={[styles.rule, { backgroundColor: colors.profileRule }]} />
          <Text style={[styles.label, { color: colors.profileLabel }]}>HOBBIES</Text>
          <View style={styles.tags}>
            {user.interests.length ? user.interests.map((item) => <Text key={item} style={[styles.tag, { backgroundColor: colors.profileChip, color: colors.profileChipForeground }]}>{item}</Text>) : <Text style={[styles.bio, { color: colors.profileMuted }]}>Add a few interests to your profile.</Text>}
          </View>
          <View style={[styles.rule, { backgroundColor: colors.profileRule }]} />
          <View style={styles.photoHeading}>
            <View>
              <Text style={[styles.label, { color: colors.profileLabel }]}>PHOTOS</Text>
              <Text style={[styles.blockedHint, { color: colors.profileMuted }]}>{user.photos.length}/6 · first photo is your main photo</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Manage profile photos" onPress={() => router.push("/edit-profile")} style={[styles.managePhotos, { borderColor: colors.profileRule }]}>
              <Feather name="camera" size={14} color={colors.profileEdit} />
              <Text style={[styles.managePhotosText, { color: colors.profileEdit }]}>Manage</Text>
            </Pressable>
          </View>
          <View style={styles.mediaRow}>
            {user.photos.map((photo, index) => (
              <View key={`${photo}-${index}`} style={[styles.mediaThumb, { backgroundColor: colors.profileChip }]}>
                {profileImageSource(photo, mediaToken) ? <Image source={profileImageSource(photo, mediaToken)} style={styles.mediaImage} resizeMode="cover" /> : <Feather name="image" size={20} color={colors.profileMuted} />}
                {index === 0 ? <View style={[styles.mainPhotoBadge, { backgroundColor: colors.photoBadge }]}><Text style={[styles.mainPhotoBadgeText, { color: colors.photoBadgeForeground }]}>Main</Text></View> : null}
              </View>
            ))}
            {user.videoUrl ? <View style={[styles.mediaThumb, { backgroundColor: colors.profileChip }]}><Feather name="video" size={20} color={colors.profileEdit} /></View> : null}
          </View>
        </View>
      </View>
      <View style={[styles.blockedSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.section, { color: colors.foreground, marginTop: 0 }]}>Blocked profiles</Text>
        <Text style={[styles.blockedHint, { color: colors.mutedForeground }]}>Manage people you’ve blocked.</Text>
        {blockedProfiles.isLoading ? <ActivityIndicator color={colors.primary} style={styles.blockedLoading} /> : null}
        {blockedProfiles.isError ? (
          <Pressable onPress={() => void blockedProfiles.refetch()}>
            <Text style={[styles.blockedHint, { color: colors.destructive }]}>Couldn’t load blocked profiles. Tap to retry.</Text>
          </Pressable>
        ) : null}
        {!blockedProfiles.isLoading && !blockedProfiles.isError && !blockedProfiles.data?.length ? (
          <Text style={[styles.blockedHint, { color: colors.mutedForeground }]}>Profiles you block will appear here.</Text>
        ) : null}
        {blockedProfiles.data?.map(({ profile }) => (
          <View key={profile.id} style={[styles.blockedRow, { borderColor: colors.border }]}>
            <ProfileAvatar profile={profile} size={44} />
            <View style={styles.blockedCopy}>
              <Text numberOfLines={1} style={[styles.blockedName, { color: colors.foreground }]}>{profile.name}</Text>
              <Text style={[styles.blockedHint, { color: colors.destructive }]}>Blocked</Text>
            </View>
            <Pressable
              testID={`profile-unblock-${profile.id}`}
              disabled={unblockProfile.isPending}
              onPress={() => void unblock(profile.id)}
              style={[styles.unblockButton, { borderColor: colors.border, opacity: unblockProfile.isPending ? 0.6 : 1 }]}
            >
              <Text style={[styles.unblockText, { color: colors.primary }]}>Unblock</Text>
            </Pressable>
          </View>
        ))}
      </View>
      <Pressable onPress={() => void signOut().then(() => router.replace("/"))} style={[styles.signOut, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Feather name="log-out" size={17} color={colors.destructive} />
        <Text style={[styles.signOutText, { color: colors.destructive }]}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { paddingHorizontal: 16, paddingBottom: 120 },
  top: { flexDirection: "row", justifyContent: "flex-end" },
  settings: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  portrait: { alignSelf: "center", borderWidth: 5, borderRadius: 90, zIndex: 2, marginTop: 4 },
  card: { borderRadius: 30, marginTop: -80, paddingTop: 96, paddingHorizontal: 20, paddingBottom: 26, alignItems: "center" },
  name: { fontSize: 28, fontWeight: "800", textAlign: "center", letterSpacing: -0.5 },
  city: { fontSize: 16, marginTop: 4, textAlign: "center" },
  genderRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  travelBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, marginTop: 10 },
  travelBadgeText: { fontSize: 11, fontWeight: "700" },
  editButton: { height: 52, borderRadius: 26, alignSelf: "stretch", marginHorizontal: 24, alignItems: "center", justifyContent: "center", marginTop: 18 },
  editText: { fontSize: 17, fontWeight: "700" },
  details: { alignSelf: "stretch", marginTop: 26 },
  label: { fontSize: 12, fontWeight: "800", letterSpacing: 2.6, marginBottom: 8 },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: 16 },
  section: { fontSize: 15, fontWeight: "700", marginTop: 16, marginBottom: 9 },
  bio: { fontSize: 15, lineHeight: 22 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { overflow: "hidden", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, fontSize: 12, fontWeight: "600" },
  mediaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  photoHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  managePhotos: { flexDirection: "row", gap: 6, alignItems: "center", borderWidth: 1, borderRadius: 14, paddingHorizontal: 11, paddingVertical: 8 },
  managePhotosText: { fontSize: 11, fontWeight: "700" },
  mediaThumb: { width: "31.5%", aspectRatio: 0.8, borderRadius: 14, alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" },
  mediaImage: { width: "100%", height: "100%" },
  mainPhotoBadge: { position: "absolute", left: 5, bottom: 5, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  mainPhotoBadgeText: { fontSize: 9, fontWeight: "700" },
  blockedSection: { marginTop: 18, borderWidth: 1, borderRadius: 18, padding: 16 },
  blockedHint: { fontSize: 12, lineHeight: 18 },
  blockedLoading: { marginVertical: 12 },
  blockedRow: { minHeight: 62, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 10 },
  blockedCopy: { flex: 1, minWidth: 0 },
  blockedName: { fontSize: 13, fontWeight: "700" },
  unblockButton: { borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 9 },
  unblockText: { fontSize: 12, fontWeight: "700" },
  signOut: { height: 50, borderRadius: 14, borderWidth: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 30 },
  signOutText: { fontSize: 14, fontWeight: "700" },
});
