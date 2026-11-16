import {
  getGetDailyLikeStatusQueryKey,
  getGetDiscoverProfilesQueryKey,
  getGetMatchesQueryKey,
  getGetNotificationsQueryKey,
  getGetProfileByIdQueryKey,
  getGetSuperLikeStatusQueryKey,
  getGetWhoLikedYouQueryKey,
  useBlockProfile,
  useCreateReaction,
  useGetDailyLikeStatus,
  useGetMyProfile,
  useGetProfileById,
  useGetSuperLikeStatus,
  useRecordProfileView,
  useReportProfile,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { MatchCelebration } from "@/components/MatchCelebration";
import { ProfileReelsSection } from "@/components/ProfileReelsSection";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { ComponentProps } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { profileImageSource } from "@/lib/media";
import { usePremiumColors } from "@/hooks/useColors";

type ReactionKind = "pass" | "like" | "super";

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
  const [confirmation, setConfirmation] = useState<{ kind: "like" | "super"; text: string } | null>(null);
  const [matchResult, setMatchResult] = useState<{ name: string; matchId: string | null } | null>(null);
  const block = useBlockProfile();
  const report = useReportProfile();
  const reaction = useCreateReaction();
  const dailyLikeStatus = useGetDailyLikeStatus({ query: { queryKey: getGetDailyLikeStatusQueryKey() } });
  const superStatus = useGetSuperLikeStatus({ query: { queryKey: getGetSuperLikeStatusQueryKey() } });
  const profile = useGetProfileById(id, { query: { queryKey: getGetProfileByIdQueryKey(id), enabled: !!id } });
  const recordView = useRecordProfileView();
  const confirmationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const currentId = useRef(id);
  currentId.current = id;
  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace((fromLikes ? "/(tabs)/activity/likes" : "/(tabs)/activity") as never);
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
    setViewer(null);
    setAvatarError(false);
  }, [id]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (confirmationTimer.current) clearTimeout(confirmationTimer.current);
    };
  }, []);

  const likeOut = dailyLikeStatus.data?.remaining === 0;
  const superOut = superStatus.data?.remaining === 0;
  const locked = reaction.isPending || !!confirmation || !!matchResult;

  async function react(type: ReactionKind) {
    const user = profile.data;
    if (!user || busy.current || locked) return;
    if (type === "like" && likeOut) { setActionError("You have used all of today’s likes. They reset in 24 hours."); return; }
    if (type === "super" && superOut) { setActionError("You have used today’s Super Like. It resets in 24 hours."); return; }
    const targetId = user.id;
    const name = user.name;
    busy.current = true;
    setActionError("");
    try {
      const result = await reaction.mutateAsync({ data: { toUserId: targetId, type } });
      if (!mounted.current || currentId.current !== targetId) { busy.current = false; return; }
      void queryClient.invalidateQueries({ queryKey: getGetDiscoverProfilesQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetWhoLikedYouQueryKey() });
      if (type === "pass") { busy.current = false; goBack(); return; }
      void queryClient.invalidateQueries({ queryKey: type === "like" ? getGetDailyLikeStatusQueryKey() : getGetSuperLikeStatusQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetMatchesQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
      setConfirmation({ kind: type, text: type === "like" ? `You liked ${name}` : `You super liked ${name}` });
      confirmationTimer.current = setTimeout(() => {
        confirmationTimer.current = null;
        busy.current = false;
        if (!mounted.current || currentId.current !== targetId) return;
        setConfirmation(null);
        if (result.matched) setMatchResult({ name, matchId: result.matchId ?? null });
        else goBack();
      }, 1500);
    } catch (error) {
      busy.current = false;
      if (!mounted.current || currentId.current !== targetId) return;
      const message = error instanceof Error ? error.message : "";
      const capped = /limit|429|remaining|already/i.test(message);
      setActionError(
        type === "pass" ? "That pass didn’t save. Please try again."
          : capped ? (type === "super" ? "Your Super Like for today is already used." : "You have reached today’s like limit.")
          : type === "super" ? "That Super Like didn’t go through. Please try again." : "Your like didn’t go through. Please try again.",
      );
      if (type === "like") void dailyLikeStatus.refetch();
      if (type === "super") void superStatus.refetch();
    }
  }

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
    { icon: "heart", label: "Looking for", value: user.lookingFor || "Not shared", testID: "public-profile-looking-for" },
    { icon: "user", label: "Gender", value: user.gender || "Not shared", testID: "public-profile-gender" },
  ];
  const avatarSource = photos.length ? profileImageSource(photos[0], token) : undefined;
  const narrow = width < 360;
  const toast = actionError || (likeOut && superOut ? "Today’s likes and Super Like are used up." : "");
  const viewerWidth = Math.min(width, 900);
  const heroHeight = Math.min(Math.max(height * 0.42, 280), 420);

  const fab = (
    key: ReactionKind,
    size: number,
    label: string,
    disabled: boolean,
    testID: string,
    a11y: string,
  ) => {
    const pink = key === "like";
    return (
      <Pressable key={key} testID={testID} accessibilityRole="button" accessibilityLabel={a11y} accessibilityState={{ disabled }} disabled={disabled} onPress={() => void react(key)} style={[styles.action, { opacity: disabled && !confirmation ? 0.5 : 1 }]}>
        {({ pressed }) => (
          <>
            <View style={[styles.fab, { width: size, height: size, borderRadius: size / 2, backgroundColor: pink ? colors.profileEdit : colors.profileCard, shadowColor: pink ? colors.profileEdit : colors.profileChipForeground, transform: [{ scale: pressed ? 0.93 : 1 }] }]}>
              {pink && reaction.isPending ? <ActivityIndicator color={colors.profileEditForeground} /> : (
                <Feather name={key === "pass" ? "x" : key === "like" ? "heart" : "star"} size={pink ? 32 : 25} color={pink ? colors.profileEditForeground : key === "super" ? colors.discoverSuperLike : colors.profileMuted} />
              )}
            </View>
            <Text numberOfLines={1} style={[styles.cap, { color: colors.profileLabel, backgroundColor: colors.profileCard }]}>{label}</Text>
          </>
        )}
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content, { paddingTop: topInset + 8, paddingBottom: bottomInset + (fromLikes ? 124 : 170) }]}>
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
            {avatarSource && !avatarError ? <Image source={avatarSource} onError={() => setAvatarError(true)} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel={`${user.name}'s main photo`} /> : <Text style={[styles.heroInitial, { color: colors.profileEdit }]}>{user.name.trim().slice(0, 1).toUpperCase()}</Text>}
          </Pressable>
        ) : null}

        <View style={[styles.header, fromLikes && { marginTop: 12, marginBottom: 18 }]}>
          {!fromLikes ? (
            <Pressable testID="public-profile-avatar" accessibilityRole="imagebutton" accessibilityLabel={`Open ${user.name}'s main photo`} disabled={!photos.length} onPress={() => setViewer(0)} style={[styles.avatarRing, { borderColor: colors.profileEdit, backgroundColor: colors.profileCard, shadowColor: colors.profileChipForeground }]}>
              {avatarSource && !avatarError ? (
                <Image source={avatarSource} onError={() => setAvatarError(true)} style={styles.avatar} resizeMode="cover" accessibilityLabel={`${user.name}'s main photo`} />
              ) : (
                <Text style={[styles.initial, { color: colors.profileEdit }]}>{user.name.trim().slice(0, 1).toUpperCase()}</Text>
              )}
            </Pressable>
          ) : null}
          <Text testID="public-profile-name" style={[styles.name, { color: colors.foreground }]}>
            {user.name}{showAge ? <Text style={{ color: colors.profileMuted, fontWeight: "600" }}>, {user.age}</Text> : null}
            {user.isVerified && <Feather name="check-circle" size={21} color="#2997e8" accessibilityLabel="Verified profile"/>}
          </Text>
          <View style={styles.locationRow}>
            <Feather name="map-pin" size={14} color={colors.profileEdit} />
            <Text testID="public-profile-location" style={[styles.city, { color: colors.profileMuted }]}>{headerLocation || "Location not shared"}</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.profileCard, shadowColor: colors.profileChipForeground, paddingVertical: 4 }]}>
          {facts.map((f, i) => (
            <View key={f.label} testID={f.testID} style={[styles.factRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.profileRule }]}>
              <View style={[styles.factIcon, { backgroundColor: colors.profileChip }]}><Feather name={f.icon} size={16} color={colors.profileEdit} /></View>
              <Text style={[styles.factLabel, { color: colors.profileMuted }]}>{f.label}</Text>
              <Text style={[styles.factValue, { color: colors.foreground }]}>{f.value}</Text>
            </View>
          ))}
        </View>

        <View testID="public-profile-about" style={[styles.card, { backgroundColor: colors.profileCard, shadowColor: colors.profileChipForeground, marginTop: 14 }]}>
          <Text style={[styles.label, { color: colors.profileEdit }]}>ABOUT ME</Text>
          <Text style={[styles.value, { color: colors.foreground, marginTop: 8 }]}>{user.bio || "No bio added yet."}</Text>
          {user.interests.length ? (
            <View testID="public-profile-interests" style={styles.tags}>
              {user.interests.map((item) => (
                <Text key={item} style={[styles.tag, { color: colors.profileChipForeground, backgroundColor: colors.profileChip }]}>{item}</Text>
              ))}
            </View>
          ) : null}
          {fullLocation && fullLocation !== headerLocation ? <Text style={[styles.small, { color: colors.profileMuted }]}>Based in {fullLocation}</Text> : null}
        </View>

        <View testID="public-profile-more-photos" style={{ marginTop: 22 }}>
          <View style={styles.photosHead}>
            <Text style={[styles.label, { color: colors.profileEdit }]}>PHOTOS</Text>
            <Text style={[styles.small, { color: colors.profileMuted, marginTop: 0 }]}>{photos.length}</Text>
          </View>
          {photos.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRow}>
              {photos.map((photo, index) => {
                const source = profileImageSource(photo, token);
                return (
                  <Pressable key={`${photo}-${index}`} testID={`public-profile-photo-${index}`} accessibilityRole="imagebutton" accessibilityLabel={`Open photo ${index + 1} of ${photos.length}`} onPress={() => setViewer(index)} style={({ pressed }) => [styles.thumb, { backgroundColor: colors.profileChip, transform: [{ scale: pressed ? 0.96 : 1 }] }]}>
                    {source ? <Image source={source} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : <Text style={[styles.value, { color: colors.profileMuted, marginTop: 8 }]}>No photos shared yet.</Text>}
        </View>
        <ProfileReelsSection profileId={id} returnTo={reelReturnTo} />
      </ScrollView>

        <View pointerEvents="box-none" style={[styles.actionHost, { bottom: bottomInset + 12 }]}>
        {toast ? (
          <Text accessibilityRole="alert" testID="public-profile-action-error" style={[styles.toast, { backgroundColor: colors.profileCard, color: colors.foreground, shadowColor: colors.profileChipForeground }]}>{toast}</Text>
        ) : null}
        {fromLikes ? (
          <View pointerEvents="box-none" style={styles.likeBackRow} testID="public-profile-actions">
            <Pressable testID="public-profile-pass" accessibilityRole="button" accessibilityLabel={`Pass on ${user.name}`} accessibilityState={{ disabled: locked }} disabled={locked} onPress={() => void react("pass")} style={({ pressed }) => [styles.likeBackButton, { backgroundColor: colors.premiumPass, opacity: locked ? 0.56 : pressed ? 0.82 : 1 }]}>
              <Feather name="x" size={19} color={colors.premiumBackground} />
              <Text style={[styles.likeBackText, { color: colors.premiumBackground }]}>Pass</Text>
            </Pressable>
            <Pressable testID="public-profile-like" accessibilityRole="button" accessibilityLabel={`Like ${user.name} back`} accessibilityState={{ disabled: locked || dailyLikeStatus.isLoading || likeOut }} disabled={locked || dailyLikeStatus.isLoading || likeOut} onPress={() => void react("like")} style={({ pressed }) => [styles.likeBackButton, { backgroundColor: colors.premiumAccent, opacity: locked || dailyLikeStatus.isLoading || likeOut ? 0.56 : pressed ? 0.82 : 1 }]}>
              {reaction.isPending ? <ActivityIndicator color={colors.premiumAccentForeground} /> : <Feather name="heart" size={18} color={colors.premiumAccentForeground} />}
              <Text style={[styles.likeBackText, { color: colors.premiumAccentForeground }]}>{likeOut ? "No likes left" : "Like Back"}</Text>
            </Pressable>
          </View>
        ) : (
          <View pointerEvents="box-none" style={[styles.actionRow, { gap: narrow ? 14 : 28 }]} testID="public-profile-actions">
            {fab("pass", 58, "Pass", locked, "public-profile-pass", `Pass on ${user.name}`)}
            {fab("like", 74, likeOut ? "No likes left" : "Like to match", locked || dailyLikeStatus.isLoading || likeOut, "public-profile-like", `Like ${user.name}`)}
            {fab("super", 58, superOut ? "Used today" : "Super Like", locked || superStatus.isLoading || superOut, "public-profile-super-like", `Super Like ${user.name}`)}
          </View>
        )}
      </View>

      {confirmation ? (
        <View style={[styles.confirmation, { top: topInset + 64, backgroundColor: colors.profileCard, shadowColor: colors.profileChipForeground }]} accessibilityRole="alert" accessibilityLiveRegion="polite" testID="public-profile-like-confirmation">
          <Feather name={confirmation.kind === "super" ? "star" : "heart"} size={16} color={confirmation.kind === "super" ? colors.discoverSuperLike : colors.profileEdit} />
          <Text style={[styles.confirmationText, { color: colors.foreground }]}>{confirmation.text}</Text>
        </View>
      ) : null}

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
                  {source ? <Image source={source} style={{ width: viewerWidth, height: height * 0.78 }} resizeMode="contain" accessibilityLabel={`${user.name}'s photo ${index + 1}`} /> : null}
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

      <MatchCelebration visible={!!matchResult} self={me.data ?? null} other={profile.data ?? null} canMessage={!!matchResult?.matchId}
        onMessage={() => { const matchId = matchResult?.matchId; if (!matchId) return; setMatchResult(null); router.push({ pathname: "/chat/[matchId]", params: { matchId } }); }}
        onKeepSwiping={() => { setMatchResult(null); router.replace("/(tabs)"); }} />

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
  content: { width: "100%", maxWidth: 520, alignSelf: "center", paddingHorizontal: 20 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  round: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", ...shadow },
  header: { alignItems: "center", marginTop: 18, marginBottom: 24 },
  likesHero: { width: "100%", borderRadius: 24, overflow: "hidden", alignItems: "center", justifyContent: "center", marginTop: 16, borderWidth: 1, ...shadow },
  heroInitial: { fontSize: 64, fontWeight: "800" },
  likeBackRow: { width: "100%", maxWidth: 520, flexDirection: "row", gap: 12, paddingHorizontal: 8 },
  likeBackButton: { flex: 1, minHeight: 54, borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 16 },
  likeBackText: { fontSize: 15, fontWeight: "800" },
  avatarRing: { width: 136, height: 136, borderRadius: 68, borderWidth: 2, padding: 4, alignItems: "center", justifyContent: "center", ...shadow, shadowOpacity: 0.2 },
  avatar: { width: "100%", height: "100%", borderRadius: 64 },
  initial: { fontSize: 48, fontWeight: "800" },
  name: { fontSize: 28, fontWeight: "800", letterSpacing: -0.4, marginTop: 14, textAlign: "center" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  city: { fontSize: 14, fontWeight: "500" },
  card: { borderRadius: 22, paddingHorizontal: 18, paddingVertical: 16, ...shadow, shadowOpacity: 0.08 },
  factRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  factIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  factLabel: { fontSize: 13, fontWeight: "600" },
  factValue: { flex: 1, textAlign: "right", fontSize: 15, fontWeight: "600" },
  label: { fontSize: 12, fontWeight: "800", letterSpacing: 1.4 },
  value: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13, marginTop: 12 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  tag: { overflow: "hidden", borderRadius: 16, paddingHorizontal: 13, paddingVertical: 6, fontSize: 13, fontWeight: "600" },
  photosHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingHorizontal: 4 },
  thumbRow: { gap: 12, paddingTop: 12, paddingBottom: 4, paddingHorizontal: 2 },
  thumb: { width: 84, height: 104, borderRadius: 16, overflow: "hidden" },
  actionHost: { position: "absolute", left: 0, right: 0, alignItems: "center", gap: 10, paddingHorizontal: 12 },
  actionRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center" },
  action: { alignItems: "center", gap: 6 },
  fab: { alignItems: "center", justifyContent: "center", shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  cap: { overflow: "hidden", fontSize: 11, fontWeight: "700", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  toast: { overflow: "hidden", maxWidth: "92%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, fontSize: 12, fontWeight: "600", textAlign: "center", ...shadow },
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
