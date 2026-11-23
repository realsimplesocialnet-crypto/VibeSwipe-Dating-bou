import {
  getGetMatchesQueryKey,
  getGetProfileByIdQueryKey,
  useBlockProfile,
  useStartDirectChat,
  useGetMyProfile,
  useGetProfileById,
  useRecordProfileView,
  useReportProfile,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { ProfileReelsSection } from "@/components/ProfileReelsSection";
import { ProfileFollowStats } from "@/components/ProfileFollow";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { ComponentProps } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { profileImagePreviewSource, profileImageSource } from "@/lib/media";
import { usePremiumColors } from "@/hooks/useColors";

export default function PublicProfileScreen() {
  const me = useGetMyProfile();
  const { profileId, returnTo } = useLocalSearchParams<{ profileId: string; returnTo?: string }>();
  const id = profileId ?? "";
  const fromLikes = returnTo === "likes";
  const reelReturnTo = `/profile/${encodeURIComponent(id)}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`;
  const colors = usePremiumColors();
  const { getToken } = useAuth();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);
  const [avatarError, setAvatarError] = useState(false);
  const [actionError, setActionError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmSafety, setConfirmSafety] = useState<"block" | "report" | null>(null);
  const [safetyError, setSafetyError] = useState("");
  const [reported, setReported] = useState(false);
  const block = useBlockProfile();
  const report = useReportProfile();
  const startChat = useStartDirectChat();
  const profile = useGetProfileById(id, { query: { queryKey: getGetProfileByIdQueryKey(id), enabled: !!id, staleTime: 10 * 60_000, gcTime: 30 * 60_000 } });
  const recordView = useRecordProfileView();
  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace((fromLikes ? "/(tabs)/activity/likes" : "/(tabs)/activity") as never);
  }
  async function openDirectChat() {
    setActionError("");
    try {
      const conversation = await startChat.mutateAsync({ data: { recipientId: id } });
      router.push({ pathname: "/direct-chat/[conversationId]", params: { conversationId: conversation.id } } as never);
    } catch (error) {
      const status = (error as { status?: number }).status;
      setActionError(status === 403 ? "This member only accepts messages from people they allow." : "Couldn't open a chat. Try again.");
    }
  }

  useEffect(() => {
    if (id) recordView.mutate({ profileId: id });
  }, [id]);
  useEffect(() => {
    let active = true;
    void getToken().then((value) => {
      if (active) setToken(value);
    });
    return () => {
      active = false;
    };
  }, [getToken]);
  useEffect(() => {
    if (!token) return;
    const references = (profile.data?.photos ?? []).slice(0, 2);
    const sources = references
      .map((reference) => profileImagePreviewSource(reference, token))
      .filter((source): source is { uri: string; headers?: Record<string, string> } =>
        typeof source === "object" && source !== null && "uri" in source && typeof source.uri === "string",
      );
    if (sources.length) {
      void ExpoImage.prefetch(sources.map((source) => source.uri), {
        cachePolicy: "memory-disk",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  }, [profile.data?.id, profile.data?.photos?.[0], profile.data?.photos?.[1], token]);
  useEffect(() => {
    setViewer(null);
    setAvatarError(false);
  }, [id]);

  async function runSafety(kind: "block" | "report") {
    const user = profile.data;
    if (!user) return;
    setSafetyError("");
    try {
      if (kind === "block") {
        await block.mutateAsync({ data: { targetUserId: user.id } });
        void queryClient.invalidateQueries({ queryKey: getGetMatchesQueryKey() });
        setConfirmSafety(null);
        setMenuOpen(false);
        goBack();
      } else {
        await report.mutateAsync({ data: { targetUserId: user.id, reason: "other" } });
        setReported(true);
        setConfirmSafety(null);
      }
    } catch (error) {
      setSafetyError(error instanceof Error && error.message ? error.message : kind === "block" ? "Could not block this profile. Please try again." : "Could not send the report. Please try again.");
    }
  }

  const bg = colors.messagesBackground;
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  if (profile.isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: bg }]}>
        <View style={[styles.skelAvatar, { backgroundColor: colors.profileChip }]} />
        <View style={[styles.skelLine, { backgroundColor: colors.profileChip }]} />
        <View style={[styles.skelCard, { backgroundColor: colors.profileCard }]} />
      </View>
    );
  }
  if (!profile.data) {
    return (
      <View style={[styles.center, { backgroundColor: bg, padding: 24 }]}>
        <Text style={[styles.value, { color: colors.foreground, textAlign: "center" }]}>This profile is unavailable.</Text>
        <Pressable testID="public-profile-retry" accessibilityRole="button" onPress={() => void profile.refetch()} style={[styles.pillButton, { backgroundColor: colors.profileEdit }]}>
          <Text style={[styles.pillButtonText, { color: colors.profileEditForeground }]}>Try again</Text>
        </Pressable>
        <Pressable testID="public-profile-back" accessibilityRole="button" onPress={goBack} style={[styles.pillButton, { backgroundColor: colors.profileCard }]}>
          <Text style={[styles.pillButtonText, { color: colors.foreground }]}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const user = profile.data;
  const photos = user.photos ?? [];
  const work = user.occupation === "Other" ? user.occupationOther || "Other" : user.occupation || "Not shared";
  const fullLocation = [user.city, user.state, user.country].filter(Boolean).join(", ");
  const headerLocation = [user.city, user.state].filter(Boolean).join(", ") || fullLocation;
  const showAge = user.showAge && user.age !== null;
  const facts: { icon: ComponentProps<typeof Feather>["name"]; label: string; value: string; testID: string }[] = [
    ...(showAge ? [{ icon: "calendar" as const, label: "Age", value: String(user.age), testID: "public-profile-age" }] : []),
    { icon: "briefcase", label: "Work", value: work, testID: "public-profile-work" },
    { icon: "user", label: "Gender", value: user.gender || "Not shared", testID: "public-profile-gender" },
  ];
  const avatarSource = photos.length ? profileImagePreviewSource(photos[0], token) : undefined;
  const viewerWidth = Math.min(width, 900);
  const heroHeight = Math.min(Math.max(height * 0.42, 280), 420);
  const mediaColumnWidth = width >= 820 ? Math.min(360, Math.floor((Math.min(width, 900) - 48) * 0.44)) : Math.max(0, Math.min(width, 900) - (width < 380 ? 32 : 48));
  const photoTileWidth = Math.max(72, Math.floor((mediaColumnWidth - 16) / 3));
  const socialAction = (
    <View style={{ flex: 1, minWidth: 0, alignItems: "stretch" }}>
      <Pressable
        testID="public-profile-message"
        accessibilityRole="button"
        accessibilityLabel={`Message ${user.name}`}
        disabled={startChat.isPending}
        onPress={() => void openDirectChat()}
        style={({ pressed }) => [styles.profileActionButton, { backgroundColor: "transparent", borderColor: colors.profileEdit, opacity: startChat.isPending ? 0.58 : pressed ? 0.82 : 1 }]}
      >
        {startChat.isPending ? <ActivityIndicator size="small" color={colors.profileEdit} /> : <Feather name="send" size={16} color={colors.profileEdit} />}
        <Text style={{ color: colors.profileEdit, fontWeight: "800", fontSize: 13 }}>Message</Text>
      </Pressable>
      {actionError ? <Text accessibilityRole="alert" style={{ color: colors.destructive, fontSize: 10, textAlign: "center", marginTop: 3 }}>{actionError}</Text> : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content, { paddingTop: topInset, paddingBottom: bottomInset + 40, paddingHorizontal: width < 380 ? 16 : 24 }]}>
        <View style={styles.topRow}>
          <Pressable testID="public-profile-back" accessibilityRole="button" accessibilityLabel="Back to Likes" onPress={goBack} style={[styles.round, { backgroundColor: colors.profileCard, shadowColor: colors.profileChipForeground }]}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </Pressable>
          <Pressable testID="public-profile-more" accessibilityRole="button" accessibilityLabel={`More actions for ${user.name}`} onPress={() => { setSafetyError(""); setConfirmSafety(null); setMenuOpen(true); }} style={[styles.round, { backgroundColor: colors.profileCard, shadowColor: colors.profileChipForeground }]}>
            <Feather name="more-horizontal" size={20} color={colors.foreground} />
          </Pressable>
        </View>

        {fromLikes ? (
          <Pressable testID="public-profile-hero" accessibilityRole="imagebutton" accessibilityLabel={`Open ${user.name}'s main photo`} disabled={!photos.length} onPress={() => setViewer(0)} style={[styles.likesHero, { height: heroHeight, backgroundColor: colors.profileCard, shadowColor: colors.profileChipForeground }]}>
            {avatarSource && !avatarError ? <ExpoImage source={avatarSource} onError={() => setAvatarError(true)} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={150} priority="high" accessibilityLabel={`${user.name}'s main photo`} /> : <Text style={[styles.heroInitial, { color: colors.profileEdit }]}>{user.name.trim().slice(0, 1).toUpperCase()}</Text>}
          </Pressable>
        ) : null}

        {fromLikes ? (
          <View style={[styles.likesHeader, { marginTop: 12 }]}>
            <Text testID="public-profile-name" style={[styles.name, { color: colors.foreground, textAlign: "center" }]}>
              {user.name}{showAge ? <Text style={{ color: colors.profileMuted, fontWeight: "600" }}>, {user.age}</Text> : null}
              {user.isVerified && <Feather name="check-circle" size={21} color="#2997e8" accessibilityLabel="Verified profile" />}
            </Text>
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={14} color={colors.profileEdit} />
              <Text testID="public-profile-location" style={[styles.city, { color: colors.profileMuted }]}>{headerLocation || "Location not shared"}</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.identityPanel, { backgroundColor: colors.profileCard, borderColor: colors.border, shadowColor: colors.profileChipForeground }]}>
            <Pressable testID="public-profile-avatar" accessibilityRole="imagebutton" accessibilityLabel={`Open ${user.name}'s main photo`} disabled={!photos.length} onPress={() => setViewer(0)} style={[styles.avatarRing, { borderColor: colors.profileEdit, backgroundColor: colors.profileCard, shadowColor: colors.profileChipForeground }]}>
              {avatarSource && !avatarError
                ? <ExpoImage source={avatarSource} onError={() => setAvatarError(true)} style={styles.avatar} contentFit="cover" cachePolicy="memory-disk" transition={150} priority="high" accessibilityLabel={`${user.name}'s main photo`} />
                : <Text style={[styles.initial, { color: colors.profileEdit }]}>{user.name.trim().slice(0, 1).toUpperCase()}</Text>}
            </Pressable>
            <View style={styles.identityCopy}>
              <Text testID="public-profile-name" style={[styles.name, { color: colors.foreground }]}>
                {user.name}{showAge ? <Text style={{ color: colors.profileMuted, fontWeight: "600" }}>, {user.age}</Text> : null}
                {user.isVerified && <Feather name="check-circle" size={21} color="#2997e8" accessibilityLabel="Verified profile" />}
              </Text>
              <View style={styles.locationRow}>
                <Feather name="map-pin" size={14} color={colors.profileEdit} />
                <Text testID="public-profile-location" style={[styles.city, { color: colors.profileMuted }]}>{headerLocation || "Location not shared"}</Text>
              </View>
            </View>
          </View>
        )}
        <ProfileFollowStats profileId={user.id} viewerId={me.data?.id} socialAction={socialAction} />

        <View style={[styles.profileLayout, width >= 820 && styles.profileLayoutWide]}>
          <View style={[styles.detailColumn, width >= 820 && styles.detailColumnWide]}>
            <View testID="public-profile-about" style={[styles.card, { backgroundColor: colors.profileCard, shadowColor: colors.profileChipForeground }]}>
              <Text style={[styles.label, { color: colors.profileEdit }]}>ABOUT ME</Text>
              <Text style={[styles.value, { color: colors.foreground, marginTop: 8 }]}>{user.bio || "No bio added yet."}</Text>
              {user.interests.length ? (
                <View testID="public-profile-interests" style={styles.tags}>
                  {user.interests.map((item) => <Text key={item} style={[styles.tag, { color: colors.profileChipForeground, backgroundColor: colors.profileChip }]}>{item}</Text>)}
                </View>
              ) : null}
              {fullLocation && fullLocation !== headerLocation ? <Text style={[styles.small, { color: colors.profileMuted }]}>Based in {fullLocation}</Text> : null}
              <View testID="public-profile-facts" style={[styles.factGrid, { borderTopColor: colors.profileRule }]}>
                {facts.map((f) => (
                  <View key={f.label} testID={f.testID} style={[styles.compactFact, { backgroundColor: colors.profileChip }]}>
                    <View style={[styles.factIcon, { backgroundColor: colors.profileCard }]}><Feather name={f.icon} size={15} color={colors.profileEdit} /></View>
                    <View style={styles.compactFactCopy}>
                      <Text style={[styles.factLabel, { color: colors.profileMuted }]}>{f.label}</Text>
                      <Text style={[styles.factValue, { color: colors.foreground }]}>{f.value}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View style={[styles.mediaColumn, width >= 820 && { width: mediaColumnWidth }]}>
            <View testID="public-profile-more-photos" style={styles.mediaSection}>
              <View style={styles.photosHead}>
                <Text style={[styles.label, { color: colors.profileEdit }]}>PHOTOS</Text>
                <Text style={[styles.small, { color: colors.profileMuted, marginTop: 0 }]}>{photos.length}</Text>
              </View>
              {photos.length ? (
                <View testID="public-profile-photo-grid" style={styles.photoGrid}>
                  {photos.map((photo, index) => {
                    const source = profileImagePreviewSource(photo, token);
                    return (
                      <Pressable key={`${photo}-${index}`} testID={`public-profile-photo-${index}`} accessibilityRole="imagebutton" accessibilityLabel={`Open photo ${index + 1} of ${photos.length}`} onPress={() => setViewer(index)} style={({ pressed }) => [styles.thumb, { width: photoTileWidth, backgroundColor: colors.profileChip, transform: [{ scale: pressed ? 0.96 : 1 }] }]}>
                        {source ? <ExpoImage source={source} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={150} priority={index === 0 ? "high" : "normal"} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : <Text style={[styles.value, { color: colors.profileMuted, marginTop: 8 }]}>No photos shared yet.</Text>}
            </View>
            <ProfileReelsSection key={id} profileId={id} returnTo={reelReturnTo} />
          </View>
        </View>
      </ScrollView>

      <Modal visible={viewer !== null} animationType="fade" onRequestClose={() => setViewer(null)} supportedOrientations={["portrait", "landscape"]}>
        <View testID="public-profile-photo-viewer" style={{ flex: 1, backgroundColor: colors.chatMediaBackdrop }}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: (viewer ?? 0) * viewerWidth, y: 0 }}
            onMomentumScrollEnd={(e) => setViewer(Math.round(e.nativeEvent.contentOffset.x / viewerWidth))}
            style={{ flex: 1, alignSelf: "center", width: viewerWidth }}
          >
            {photos.map((photo, index) => {
                  const source = profileImageSource(photo, token);
              return (
                <View key={`${photo}-v-${index}`} style={{ width: viewerWidth, height, alignItems: "center", justifyContent: "center" }}>
                  {source ? <ExpoImage source={source} style={{ width: viewerWidth, height: height * 0.78 }} contentFit="contain" cachePolicy="memory-disk" transition={150} accessibilityLabel={`${user.name}'s photo ${index + 1}`} /> : null}
                </View>
              );
            })}
          </ScrollView>
          <View style={[styles.viewerTop, { top: topInset + 6 }]}>
            <Text style={[styles.viewerCount, { color: colors.photoBadgeForeground }]}>{(viewer ?? 0) + 1} / {photos.length}</Text>
            <Pressable testID="public-profile-photo-close" accessibilityRole="button" accessibilityLabel="Close photos" onPress={() => setViewer(null)} style={[styles.round, { backgroundColor: colors.chatMediaControl }]}>
              <Feather name="x" size={22} color={colors.photoBadgeForeground} />
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => { setMenuOpen(false); setConfirmSafety(null); }}>
        <Pressable style={[styles.matchScrim, { backgroundColor: colors.photoBadge }]} onPress={() => { setMenuOpen(false); setConfirmSafety(null); }}>
          <Pressable style={[styles.matchCard, { backgroundColor: colors.card, borderColor: colors.border, alignItems: "stretch" }]} onPress={() => undefined}>
            {confirmSafety ? (
              <>
                <Text style={[styles.menuTitle, { color: colors.foreground }]}>{confirmSafety === "block" ? `Block ${user.name}?` : `Report ${user.name}?`}</Text>
                <Text style={[styles.matchCopy, { color: colors.mutedForeground, textAlign: "left" }]}>
                  {confirmSafety === "block" ? "They won’t be able to see you or message you, and any match will end." : "Our safety team will review this profile. They won’t be told who reported them."}
                </Text>
                {safetyError ? <Text accessibilityRole="alert" testID="public-profile-safety-error" style={[styles.safetyError, { color: colors.destructive }]}>{safetyError}</Text> : null}
                <Pressable testID="public-profile-confirm-safety" accessibilityRole="button" disabled={block.isPending || report.isPending} onPress={() => void runSafety(confirmSafety)} style={[styles.matchPrimary, { backgroundColor: colors.destructive, opacity: block.isPending || report.isPending ? 0.6 : 1 }]}>
                  {block.isPending || report.isPending ? <ActivityIndicator color={colors.destructiveForeground} /> : <Text style={[styles.matchPrimaryText, { color: colors.destructiveForeground }]}>{confirmSafety === "block" ? "Block" : "Send report"}</Text>}
                </Pressable>
                <Pressable testID="public-profile-cancel-safety" onPress={() => { setConfirmSafety(null); setSafetyError(""); }} style={[styles.matchSecondary, { borderColor: colors.border }]}>
                  <Text style={[styles.matchSecondaryText, { color: colors.foreground }]}>Cancel</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={[styles.menuTitle, { color: colors.foreground }]}>{user.name}</Text>
                {reported ? <Text style={[styles.matchCopy, { color: colors.mutedForeground, textAlign: "left" }]}>Thanks, your report was sent.</Text> : null}
                <Pressable testID="public-profile-report" accessibilityRole="button" disabled={reported} onPress={() => setConfirmSafety("report")} style={[styles.menuItem, { borderColor: colors.border, opacity: reported ? 0.5 : 1 }]}>
                  <Feather name="flag" size={17} color={colors.primary} />
                  <Text style={[styles.matchSecondaryText, { color: colors.foreground }]}>{reported ? "Reported" : "Report profile"}</Text>
                </Pressable>
                <Pressable testID="public-profile-block" accessibilityRole="button" onPress={() => setConfirmSafety("block")} style={[styles.menuItem, { borderColor: colors.border }]}>
                  <Feather name="slash" size={17} color={colors.destructive} />
                  <Text style={[styles.matchSecondaryText, { color: colors.destructive }]}>Block {user.name}</Text>
                </Pressable>
                <Pressable testID="public-profile-menu-close" onPress={() => setMenuOpen(false)} style={[styles.matchSecondary, { borderColor: colors.border }]}>
                  <Text style={[styles.matchSecondaryText, { color: colors.foreground }]}>Close</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const shadow = { shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 };

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  skelAvatar: { width: 128, height: 128, borderRadius: 64 },
  skelLine: { width: 160, height: 22, borderRadius: 11 },
  skelCard: { width: "86%", maxWidth: 420, height: 160, borderRadius: 22 },
  pillButton: { minHeight: 46, minWidth: 160, borderRadius: 23, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  pillButtonText: { fontSize: 14, fontWeight: "700" },
  content: { width: "100%", maxWidth: 900, alignSelf: "center", paddingHorizontal: 20 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  round: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", ...shadow },
  identityPanel: { width: "100%", minHeight: 112, flexDirection: "row", alignItems: "center", gap: 14, borderWidth: StyleSheet.hairlineWidth, borderRadius: 24, padding: 12, ...shadow, shadowOpacity: 0.08 },
  identityCopy: { flex: 1, minWidth: 0 },
  likesHeader: { alignItems: "center", marginBottom: 18 },
  likesHero: { width: "100%", borderRadius: 24, overflow: "hidden", alignItems: "center", justifyContent: "center", marginTop: 16, borderWidth: 1, ...shadow },
  heroInitial: { fontSize: 64, fontWeight: "800" },
  profileActionButton: { width: "100%", minHeight: 42, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  avatarRing: { width: 92, height: 92, flexShrink: 0, borderRadius: 46, borderWidth: 2, padding: 3, alignItems: "center", justifyContent: "center", ...shadow, shadowOpacity: 0.2 },
  avatar: { width: "100%", height: "100%", borderRadius: 44 },
  initial: { fontSize: 36, fontWeight: "800" },
  name: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5, textAlign: "left" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  city: { minWidth: 0, flexShrink: 1, fontSize: 14, fontWeight: "600" },
  card: { borderRadius: 22, paddingHorizontal: 18, paddingVertical: 16, ...shadow, shadowOpacity: 0.08 },
  profileLayout: { width: "100%", gap: 16, marginTop: 16 },
  profileLayoutWide: { flexDirection: "row", alignItems: "flex-start", gap: 18 },
  detailColumn: { minWidth: 0 },
  detailColumnWide: { flex: 1 },
  mediaColumn: { minWidth: 0, gap: 18 },
  factGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 18, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14 },
  compactFact: { minWidth: 132, flex: 1, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, padding: 8 },
  compactFactCopy: { flex: 1, minWidth: 0 },
  factIcon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  factLabel: { fontSize: 11, fontWeight: "700" },
  factValue: { marginTop: 2, fontSize: 13, lineHeight: 17, fontWeight: "700" },
  label: { fontSize: 12, fontWeight: "800", letterSpacing: 1.4 },
  value: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13, marginTop: 12 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  tag: { overflow: "hidden", borderRadius: 16, paddingHorizontal: 13, paddingVertical: 6, fontSize: 13, fontWeight: "600" },
  photosHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingHorizontal: 4 },
  mediaSection: { width: "100%" },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  thumb: { aspectRatio: 1, borderRadius: 14, overflow: "hidden" },
  confirmation: { position: "absolute", alignSelf: "center", zIndex: 10, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 24, paddingHorizontal: 17, paddingVertical: 12, ...shadow, elevation: 8 },
  confirmationText: { fontSize: 14, fontWeight: "700" },
  viewerTop: { position: "absolute", left: 16, right: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  viewerCount: { fontSize: 14, fontWeight: "700" },
  menuTitle: { fontSize: 19, fontWeight: "800", marginBottom: 6 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, marginTop: 9 },
  safetyError: { fontSize: 13, fontWeight: "600", marginTop: 10 },
  matchScrim: { flex: 1, alignItems: "center", justifyContent: "center", padding: 22 },
  matchCard: { width: "100%", maxWidth: 380, alignItems: "center", borderWidth: 1, borderRadius: 26, padding: 24 },
  matchIcon: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  matchTitle: { fontSize: 29, fontWeight: "800", marginTop: 15 },
  matchCopy: { fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 8 },
  matchPrimary: { width: "100%", minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 22 },
  matchPrimaryText: { fontSize: 14, fontWeight: "800" },
  matchSecondary: { width: "100%", minHeight: 46, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 9 },
  matchSecondaryText: { fontSize: 13, fontWeight: "700" },
});
