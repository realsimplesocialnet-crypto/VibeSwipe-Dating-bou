import {
  getGetDailyLikeStatusQueryKey,
  getGetMatchesQueryKey,
  getGetNotificationsQueryKey,
  useBlockProfile,
  useCreateReaction,
  useGetDailyLikeStatus,
  useGetProfileById,
  useRecordProfileView,
  useReportProfile,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { ComponentProps, ReactNode } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { profileImageSource } from "@/lib/media";
import palette from "@/constants/colors";

// This screen always renders in the dark palette, independent of the saved app theme.
const colors = palette.dark;

function Row({ icon, title, children, testID }: { icon: ComponentProps<typeof Feather>["name"]; title: string; children: ReactNode; testID: string }) {
  return (
    <View testID={testID} style={[styles.card, styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.iconDisc, { backgroundColor: colors.primary }]}><Feather name={icon} size={20} color={colors.card} /></View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, { color: colors.primary }]}>{title}</Text>
        {children}
      </View>
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmSafety, setConfirmSafety] = useState<"block" | "report" | null>(null);
  const [safetyError, setSafetyError] = useState("");
  const [reported, setReported] = useState(false);
  const block = useBlockProfile();
  const report = useReportProfile();
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
        router.back();
      } else {
        await report.mutateAsync({ data: { targetUserId: user.id, reason: "other" } });
        setReported(true);
        setConfirmSafety(null);
      }
    } catch (error) {
      setSafetyError(error instanceof Error && error.message ? error.message : kind === "block" ? "Could not block this profile. Please try again." : "Could not send the report. Please try again.");
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
  const galleryWidth = Math.max(240, Math.min(width, 720) - 32 - 26);
  const occupation = user.occupation === "Other"
    ? user.occupationOther || "Other"
    : user.occupation || "Prefer not to say";
  const fullLocation = [user.city, user.state, user.country].filter(Boolean).join(", ");
  const headerLocation = [user.city, user.state].filter(Boolean).join(", ") || fullLocation;
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const likeDisabled = reaction.isPending || !!likeConfirmation || !!matchResult || dailyLikeStatus.isLoading || dailyLikeStatus.data?.remaining === 0;
  const toast = actionError || (dailyLikeStatus.data?.remaining === 0 ? "Your daily likes are used up." : "");
  const actionButtons = (
        <View pointerEvents="box-none" style={styles.actionRow} testID="public-profile-actions">
          <Pressable
            testID="public-profile-pass"
            accessibilityRole="button"
            accessibilityLabel={`Pass on ${user.name}`}
            disabled={reaction.isPending || !!likeConfirmation || !!matchResult}
            onPress={() => void passProfile()}
            style={({ pressed }) => [styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.background, opacity: reaction.isPending ? 0.5 : 1, transform: [{ scale: pressed ? 0.92 : 1 }] }]}
          >
            <Feather name="x" size={30} color={colors.primary} />
          </Pressable>
          <Pressable
            testID="public-profile-like"
            accessibilityRole="button"
            accessibilityLabel={`Like ${user.name}`}
            disabled={likeDisabled}
            onPress={() => void likeProfile()}
            style={({ pressed }) => [styles.actionButton, { backgroundColor: colors.primary, borderColor: colors.primary, shadowColor: colors.primary, opacity: likeDisabled && !likeConfirmation ? 0.55 : 1, transform: [{ scale: pressed ? 0.92 : 1 }] }]}
          >
            {reaction.isPending ? <ActivityIndicator color={colors.primaryForeground} /> : <Feather name="heart" size={30} color={colors.primaryForeground} />}
          </Pressable>
        </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content, { paddingTop: topInset + 8 }]}>
        <View style={styles.topRow}>
          <Pressable testID="public-profile-back" accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={[styles.round, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="arrow-left" size={20} color={colors.primary} />
          </Pressable>
          <Pressable
            testID="public-profile-more"
            accessibilityRole="button"
            accessibilityLabel={`More actions for ${user.name}`}
            onPress={() => { setSafetyError(""); setConfirmSafety(null); setMenuOpen(true); }}
            style={[styles.round, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Feather name="more-horizontal" size={20} color={colors.primary} />
          </Pressable>
        </View>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text testID="public-profile-name" style={[styles.name, { color: colors.foreground }]}>
            {user.name}{user.age !== null ? <Text style={{ color: colors.mutedForeground }}>, {user.age}</Text> : null}
          </Text>
          <View style={styles.locationRow}>
            <Feather name="map-pin" size={16} color={colors.primary} />
            <Text style={[styles.city, { color: colors.mutedForeground }]}>{headerLocation || "Location not shared"}</Text>
          </View>
        </View>
        <View style={styles.sections}>
          <Row icon="user" title="About" testID="public-profile-about">
            <Text style={[styles.value, { color: colors.foreground }]}>{user.bio || "No bio added yet."}</Text>
          </Row>
          <Row icon="briefcase" title="Work" testID="public-profile-work">
            <Text style={[styles.value, { color: colors.foreground }]}>{occupation}</Text>
          </Row>
          <Row icon="users" title="Gender" testID="public-profile-gender">
            <Text style={[styles.value, { color: colors.foreground }]}>{user.gender || "Not shared"}</Text>
          </Row>
          <Row icon="heart" title="Looking for" testID="public-profile-looking-for">
            <Text style={[styles.value, { color: colors.foreground }]}>{user.lookingFor || "Not shared"}</Text>
          </Row>
          <Row icon="map-pin" title="Location" testID="public-profile-location">
            <Text style={[styles.value, { color: colors.foreground }]}>{fullLocation || "Not shared"}</Text>
          </Row>
          <View testID="public-profile-interests" style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.labelRow}>
              <Feather name="star" size={17} color={colors.primary} />
              <Text style={[styles.label, { color: colors.primary }]}>Hobbies and interests</Text>
            </View>
            <View style={styles.tags}>
              {user.interests.length ? user.interests.map((item) => (
                <Text key={item} style={[styles.tag, { color: colors.foreground, borderColor: colors.primary }]}>{item}</Text>
              )) : <Text style={[styles.value, { color: colors.mutedForeground }]}>No interests added yet.</Text>}
            </View>
          </View>
          <View testID="public-profile-more-photos" style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.labelRow}>
              <Feather name="image" size={17} color={colors.primary} />
              <Text style={[styles.label, { color: colors.primary, flex: 1 }]}>More photos</Text>
              {photos.length > 1 ? <Text style={[styles.count, { color: colors.mutedForeground }]}>{Math.min(activePhoto + 1, photos.length)} / {photos.length}</Text> : null}
            </View>
            {photos.length ? (
              <View style={[styles.galleryFrame, { width: galleryWidth, backgroundColor: colors.muted }]}>
                <ScrollView
                  horizontal
                  pagingEnabled
                  nestedScrollEnabled
                  showsHorizontalScrollIndicator={false}
                  scrollEventThrottle={32}
                  onScroll={(event) => setActivePhoto(Math.round(event.nativeEvent.contentOffset.x / galleryWidth))}
                >
                  {photos.map((photo, index) => {
                    const source = profileImageSource(photo, token);
                    return source ? (
                      <Image
                        key={`${photo}-${index}`}
                        source={source}
                        style={{ width: galleryWidth, height: galleryWidth * 1.2 }}
                        resizeMode="cover"
                        accessibilityLabel={`${user.name}'s photo ${index + 1}`}
                      />
                    ) : null;
                  })}
                </ScrollView>
                <View pointerEvents="box-none" style={styles.galleryActions}>{actionButtons}</View>
              </View>
            ) : <Text style={[styles.value, { color: colors.mutedForeground }]}>No photos shared yet.</Text>}
          </View>
          {photos.length ? null : <View style={styles.inlineActions}>{actionButtons}</View>}
        </View>
      </ScrollView>
      <View pointerEvents="box-none" style={[styles.toastHost, { bottom: Math.max(insets.bottom, 12) + (Platform.OS === "web" ? 34 : 8) }]}>
        {toast ? (
          <Text accessibilityRole="alert" testID="public-profile-action-error" style={[styles.toast, { backgroundColor: colors.publicToast, color: colors.foreground, borderColor: colors.border }]}>{toast}</Text>
        ) : null}
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
                <Pressable
                  testID="public-profile-confirm-safety"
                  accessibilityRole="button"
                  disabled={block.isPending || report.isPending}
                  onPress={() => void runSafety(confirmSafety)}
                  style={[styles.matchPrimary, { backgroundColor: colors.destructive, opacity: block.isPending || report.isPending ? 0.6 : 1 }]}
                >
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

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { width: "100%", maxWidth: 720, alignSelf: "center", paddingHorizontal: 16, paddingBottom: 40 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  round: { width: 42, height: 42, borderRadius: 21, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  header: { marginTop: 12, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  name: { fontSize: 36, fontWeight: "900", letterSpacing: -0.4, textTransform: "uppercase" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  city: { fontSize: 15, fontWeight: "500" },
  sections: { paddingTop: 12, gap: 8 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 10, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  iconDisc: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { fontSize: 13, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  value: { fontSize: 15, lineHeight: 21, marginTop: 1 },
  count: { fontSize: 12, fontWeight: "600" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { overflow: "hidden", borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6, fontSize: 14, fontWeight: "500" },
  galleryFrame: { borderRadius: 12, overflow: "hidden", alignSelf: "center" },
  toastHost: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  galleryActions: { position: "absolute", left: 0, right: 0, bottom: 12, alignItems: "center" },
  inlineActions: { paddingTop: 6, alignItems: "center" },
  actionRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24 },
  actionButton: { width: 64, height: 64, borderRadius: 32, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center", shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  toast: { overflow: "hidden", maxWidth: "88%", borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, fontSize: 12, fontWeight: "600", textAlign: "center" },
  menuTitle: { fontSize: 19, fontWeight: "800", marginBottom: 6 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, marginTop: 9 },
  safetyError: { fontSize: 13, fontWeight: "600", marginTop: 10 },
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
