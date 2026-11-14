import {
  getGetDailyLikeStatusQueryKey,
  getGetMatchesQueryKey,
  getGetNotificationsQueryKey,
  useCreateReaction,
  useGetDailyLikeStatus,
  useGetProfileById,
  useRecordProfileView,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { ComponentProps, ReactNode } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { profileImageSource } from "@/lib/media";
import palette from "@/constants/colors";

// This screen always renders in the dark palette, independent of the saved app theme.
const colors = palette.dark;

function Section({ icon, title, children, testID }: { icon: ComponentProps<typeof Feather>["name"]; title: string; children: ReactNode; testID: string }) {
  return (
    <View testID={testID} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.labelRow}>
        <View style={[styles.iconChip, { backgroundColor: colors.accent }]}><Feather name={icon} size={14} color={colors.primary} /></View>
        <Text style={[styles.label, { color: colors.foreground }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export default function PublicProfileScreen() {
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  const { getToken } = useAuth();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [activePhoto, setActivePhoto] = useState(0);
  const [actionError, setActionError] = useState("");
  const [likeConfirmation, setLikeConfirmation] = useState("");
  const [matchResult, setMatchResult] = useState<{ name: string; matchId: string | null } | null>(null);
  const reaction = useCreateReaction();
  const dailyLikeStatus = useGetDailyLikeStatus();
  const profile = useGetProfileById(profileId);
  const recordView = useRecordProfileView();
  const confirmationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (profileId) recordView.mutate({ profileId });
  }, [profileId]);
  useEffect(() => {
    let active = true;
    void getToken().then((value) => {
      if (active) setToken(value);
    });
    return () => {
      active = false;
    };
  }, [getToken]);
  useEffect(() => setActivePhoto(0), [profileId]);
  useEffect(() => () => {
    if (confirmationTimer.current) clearTimeout(confirmationTimer.current);
  }, []);

  async function likeProfile() {
    const user = profile.data;
    if (!user || reaction.isPending || likeConfirmation || matchResult) return;
    if (dailyLikeStatus.data?.remaining === 0) {
      setActionError("You’ve reached today’s like limit. Come back in 24 hours.");
      return;
    }
    setActionError("");
    try {
      const result = await reaction.mutateAsync({ data: { toUserId: user.id, type: "like" } });
      void queryClient.invalidateQueries({ queryKey: getGetDailyLikeStatusQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetMatchesQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
      setLikeConfirmation(`You liked ${user.name}`);
      confirmationTimer.current = setTimeout(() => {
        setLikeConfirmation("");
        if (result.matched) setMatchResult({ name: user.name, matchId: result.matchId ?? null });
        else router.back();
      }, 1500);
    } catch {
      setActionError("Your like didn’t go through. Please try again.");
    }
  }

  async function passProfile() {
    const user = profile.data;
    if (!user || reaction.isPending || likeConfirmation || matchResult) return;
    setActionError("");
    try {
      await reaction.mutateAsync({ data: { toUserId: user.id, type: "pass" } });
      router.back();
    } catch {
      setActionError("That pass didn’t save. Please try again.");
    }
  }

  if (profile.isLoading) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  }
  if (!profile.data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground }}>This profile is unavailable.</Text>
      </View>
    );
  }
  const user = profile.data;
  const photos = user.photos ?? [];
  const morePhotos = photos.slice(1);
  const heroSource = photos[0] ? profileImageSource(photos[0], token) : null;
  const heroHeight = Math.min(620, Math.max(420, width * 1.22));
  const galleryWidth = Math.max(260, width - 32 - 36);
  const occupation = user.occupation === "Other"
    ? user.occupationOther || "Other"
    : user.occupation || "Prefer not to say";
  const fullLocation = [user.city, user.state, user.country].filter(Boolean).join(", ");
  const headerLocation = [user.city, user.state].filter(Boolean).join(", ") || fullLocation;
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const likeDisabled = reaction.isPending || !!likeConfirmation || !!matchResult || dailyLikeStatus.isLoading || dailyLikeStatus.data?.remaining === 0;
  const toast = actionError || (dailyLikeStatus.data?.remaining === 0 ? "Your daily likes are used up." : "");
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 170 }}>
        <View style={{ height: heroHeight, backgroundColor: colors.card }}>
          {heroSource ? (
            <Image source={heroSource} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel={`${user.name}'s main photo`} />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.center]}><ProfileAvatar profile={user} size={170} /></View>
          )}
          <LinearGradient
            colors={[colors.discoverGradientTop, colors.publicHeroFade, colors.background]}
            locations={[0.35, 0.65, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <Pressable
            testID="public-profile-back"
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={[styles.back, { top: topInset + 8, backgroundColor: colors.discoverControl, borderColor: colors.discoverControlBorder }]}
          >
            <Feather name="arrow-left" size={20} color={colors.discoverForeground} />
          </Pressable>
          <View style={styles.heroCopy}>
            <Text testID="public-profile-name" style={[styles.name, { color: colors.discoverForeground }]}>
              {user.name}{user.age !== null ? <Text style={styles.age}>, {user.age}</Text> : null}
            </Text>
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={15} color={colors.primary} />
              <Text style={[styles.city, { color: colors.discoverMuted }]}>{headerLocation || "Location not shared"}</Text>
            </View>
          </View>
        </View>
        <View style={styles.sections}>
          <Section icon="user" title="About" testID="public-profile-about">
            <Text style={[styles.body, { color: colors.foreground }]}>{user.bio || "No bio added yet."}</Text>
          </Section>
          <Section icon="briefcase" title="Work" testID="public-profile-work">
            <Text style={[styles.value, { color: colors.foreground }]}>{occupation}</Text>
          </Section>
          <Section icon="users" title="Gender" testID="public-profile-gender">
            <Text style={[styles.value, { color: colors.foreground }]}>{user.gender || "Not shared"}</Text>
          </Section>
          <Section icon="heart" title="Looking for" testID="public-profile-looking-for">
            <Text style={[styles.value, { color: colors.foreground }]}>{user.lookingFor || "Not shared"}</Text>
          </Section>
          <Section icon="map-pin" title="Location" testID="public-profile-location">
            <Text style={[styles.value, { color: colors.foreground }]}>{fullLocation || "Not shared"}</Text>
          </Section>
          <Section icon="star" title="Hobbies and interests" testID="public-profile-interests">
            <View style={styles.tags}>
              {user.interests.length ? user.interests.map((item) => (
                <Text key={item} style={[styles.tag, { backgroundColor: colors.accent, color: colors.accentForeground, borderColor: colors.border }]}>{item}</Text>
              )) : <Text style={[styles.body, { color: colors.mutedForeground }]}>No interests added yet.</Text>}
            </View>
          </Section>
          {morePhotos.length ? (
            <Section icon="camera" title="More photos" testID="public-profile-more-photos">
              <View style={[styles.galleryFrame, { width: galleryWidth, backgroundColor: colors.muted }]}>
                <ScrollView
                  horizontal
                  pagingEnabled
                  nestedScrollEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(event) => setActivePhoto(Math.round(event.nativeEvent.contentOffset.x / galleryWidth))}
                >
                  {morePhotos.map((photo, index) => {
                    const source = profileImageSource(photo, token);
                    return source ? (
                      <Image
                        key={`${photo}-${index}`}
                        source={source}
                        style={{ width: galleryWidth, height: galleryWidth * 1.25 }}
                        resizeMode="cover"
                        accessibilityLabel={`${user.name}'s photo ${index + 2}`}
                      />
                    ) : null;
                  })}
                </ScrollView>
                {morePhotos.length > 1 ? (
                  <View style={[styles.photoCount, { backgroundColor: colors.photoBadge }]}>
                    <Text style={[styles.photoCountText, { color: colors.photoBadgeForeground }]}>{Math.min(activePhoto + 1, morePhotos.length)} / {morePhotos.length}</Text>
                  </View>
                ) : null}
              </View>
            </Section>
          ) : null}
        </View>
      </ScrollView>
      <View pointerEvents="box-none" style={[styles.actionHost, { bottom: Math.max(insets.bottom, 12) + (Platform.OS === "web" ? 34 : 8) }]}>
        {toast ? (
          <Text accessibilityRole="alert" testID="public-profile-action-error" style={[styles.toast, { backgroundColor: colors.publicToast, color: colors.foreground, borderColor: colors.border }]}>{toast}</Text>
        ) : null}
        <View pointerEvents="box-none" style={styles.actionRow}>
          <Pressable
            testID="public-profile-pass"
            accessibilityRole="button"
            accessibilityLabel={`Pass on ${user.name}`}
            disabled={reaction.isPending || !!likeConfirmation || !!matchResult}
            onPress={() => void passProfile()}
            style={({ pressed }) => [styles.passButton, { backgroundColor: colors.publicPassSurface, shadowColor: colors.background, opacity: reaction.isPending ? 0.5 : 1, transform: [{ scale: pressed ? 0.92 : 1 }] }]}
          >
            <Feather name="x" size={26} color={colors.publicPassIcon} />
          </Pressable>
          <Pressable
            testID="public-profile-like"
            accessibilityRole="button"
            accessibilityLabel={`Like ${user.name}`}
            disabled={likeDisabled}
            onPress={() => void likeProfile()}
            style={({ pressed }) => [styles.likeButton, { backgroundColor: colors.primary, shadowColor: colors.primary, opacity: likeDisabled && !likeConfirmation ? 0.55 : 1, transform: [{ scale: pressed ? 0.92 : 1 }] }]}
          >
            {reaction.isPending ? <ActivityIndicator color={colors.primaryForeground} /> : <Feather name="heart" size={30} color={colors.primaryForeground} />}
          </Pressable>
        </View>
      </View>
      {likeConfirmation ? (
        <View style={[styles.confirmation, { top: Math.max(insets.top, 18) + 8, backgroundColor: colors.card, borderColor: colors.primary }]} accessibilityRole="alert" accessibilityLiveRegion="polite" testID="public-profile-like-confirmation">
          <Feather name="heart" size={16} color={colors.primary} />
          <Text style={[styles.confirmationText, { color: colors.foreground }]}>{likeConfirmation}</Text>
        </View>
      ) : null}
      <Modal visible={!!matchResult} transparent animationType="fade" onRequestClose={() => setMatchResult(null)}>
        <View style={[styles.matchScrim, { backgroundColor: colors.photoBadge }]}>
          <View style={[styles.matchCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.matchIcon, { backgroundColor: colors.accent }]}>
              <Feather name="heart" size={26} color={colors.primary} />
            </View>
            <Text style={[styles.matchTitle, { color: colors.foreground }]}>It’s a match!</Text>
            <Text style={[styles.matchCopy, { color: colors.mutedForeground }]}>You and {matchResult?.name} liked each other. You can start chatting now.</Text>
            <Pressable
              testID="public-profile-start-chat"
              accessibilityRole="button"
              onPress={() => {
                const matchId = matchResult?.matchId;
                setMatchResult(null);
                if (matchId) router.push({ pathname: "/chat/[matchId]", params: { matchId } });
                else router.push("/(tabs)/matches");
              }}
              style={[styles.matchPrimary, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.matchPrimaryText, { color: colors.primaryForeground }]}>{matchResult?.matchId ? "Start chatting" : "View matches"}</Text>
            </Pressable>
            <Pressable testID="public-profile-match-back" onPress={() => { setMatchResult(null); router.back(); }} style={[styles.matchSecondary, { borderColor: colors.border }]}>
              <Text style={[styles.matchSecondaryText, { color: colors.foreground }]}>Back</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  back: { position: "absolute", left: 16, width: 40, height: 40, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  heroCopy: { position: "absolute", left: 20, right: 20, bottom: 22 },
  name: { fontSize: 34, fontWeight: "800", letterSpacing: -0.8 },
  age: { fontWeight: "500" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  city: { fontSize: 15, fontWeight: "500" },
  sections: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 18, gap: 12 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconChip: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 2.2, textTransform: "uppercase" },
  body: { fontSize: 15, lineHeight: 23 },
  value: { fontSize: 15, fontWeight: "600" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { overflow: "hidden", borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 13, paddingVertical: 7, fontSize: 13, fontWeight: "600" },
  galleryFrame: { borderRadius: 16, overflow: "hidden", position: "relative" },
  photoCount: { position: "absolute", right: 10, bottom: 10, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  photoCountText: { fontSize: 12, fontWeight: "700" },
  actionHost: { position: "absolute", left: 0, right: 0, alignItems: "center", gap: 10 },
  actionRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 28 },
  passButton: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  likeButton: { width: 70, height: 70, borderRadius: 35, alignItems: "center", justifyContent: "center", shadowOpacity: 0.32, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  toast: { overflow: "hidden", maxWidth: "88%", borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, fontSize: 12, fontWeight: "600", textAlign: "center" },
  confirmation: { position: "absolute", alignSelf: "center", zIndex: 10, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 24, paddingHorizontal: 17, paddingVertical: 12, elevation: 8 },
  confirmationText: { fontSize: 14, fontWeight: "700" },
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
