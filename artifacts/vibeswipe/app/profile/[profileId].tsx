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
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { profileImageSource } from "@/lib/media";
import { useColors } from "@/hooks/useColors";

export default function PublicProfileScreen() {
  const colors = useColors();
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  const { getToken } = useAuth();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [activePhoto, setActivePhoto] = useState(0);
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
      Alert.alert("Daily like limit reached", "Come back in 24 hours to send more likes.");
      return;
    }
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
      Alert.alert("Like not sent", "Your like did not go through. Please try again.");
    }
  }

  async function passProfile() {
    const user = profile.data;
    if (!user || reaction.isPending || likeConfirmation || matchResult) return;
    try {
      await reaction.mutateAsync({ data: { toUserId: user.id, type: "pass" } });
      router.back();
    } catch {
      Alert.alert("Pass not saved", "That action did not go through. Please try again.");
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
  const galleryWidth = Math.max(280, width - 48);
  const occupation = user.occupation === "Other"
    ? user.occupationOther || "Other"
    : user.occupation || "Prefer not to say";
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.container, { paddingBottom: 145 }]}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={21} color={colors.foreground} />
        </Pressable>
        {photos.length ? (
          <View style={[styles.galleryFrame, { width: galleryWidth, borderColor: colors.border }]}>
            <ScrollView
              horizontal
              pagingEnabled
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) => setActivePhoto(Math.round(event.nativeEvent.contentOffset.x / galleryWidth))}
            >
              {photos.map((photo, index) => {
                const source = profileImageSource(photo, token);
                return source ? (
                  <Image
                    key={`${photo}-${index}`}
                    source={source}
                    style={{ width: galleryWidth, height: 430, backgroundColor: colors.card }}
                    resizeMode="cover"
                    accessibilityLabel={`${user.name}'s photo ${index + 1}`}
                  />
                ) : null;
              })}
            </ScrollView>
            {photos.length > 1 ? (
              <View style={styles.photoCount}>
                <Text style={styles.photoCountText}>{activePhoto + 1} / {photos.length}</Text>
              </View>
            ) : null}
          </View>
        ) : <ProfileAvatar profile={user} size={190} />}
        <Text style={[styles.name, { color: colors.foreground }]}>{user.name}, {user.age}</Text>
        <Text style={[styles.city, { color: colors.mutedForeground }]}>{[user.city, user.state, user.country].filter(Boolean).join(", ")} · {user.gender}</Text>
        <Text style={[styles.section, { color: colors.foreground }]}>Looking for</Text>
        <Text style={[styles.bio, { color: colors.mutedForeground }]}>{user.lookingFor || "Not specified"}</Text>
        <Text style={[styles.section, { color: colors.foreground }]}>About</Text>
        <Text style={[styles.bio, { color: colors.mutedForeground }]}>{user.bio || "No bio added yet."}</Text>
        <Text style={[styles.section, { color: colors.foreground }]}>Work / occupation</Text>
        <Text style={[styles.bio, { color: colors.mutedForeground }]}>{occupation}</Text>
        <Text style={[styles.section, { color: colors.foreground }]}>Hobbies and interests</Text>
        <View style={styles.tags}>
          {user.interests.map((item) => <Text key={item} style={[styles.tag, { backgroundColor: colors.accent, color: colors.accentForeground }]}>{item}</Text>)}
        </View>
      </ScrollView>
      <View style={[styles.actionBar, { bottom: Math.max(insets.bottom, 8), backgroundColor: colors.background, borderColor: colors.border }]}>
        <Pressable
          testID="public-profile-pass"
          accessibilityRole="button"
          accessibilityLabel={`Pass on ${user.name}`}
          disabled={reaction.isPending || !!likeConfirmation || !!matchResult}
          onPress={() => void passProfile()}
          style={[styles.passButton, { borderColor: colors.border, opacity: reaction.isPending ? 0.5 : 1 }]}
        >
          <Feather name="x" size={24} color="#ff7188" />
        </Pressable>
        <Pressable
          testID="public-profile-like"
          accessibilityRole="button"
          accessibilityLabel={`Like ${user.name}`}
          disabled={reaction.isPending || !!likeConfirmation || !!matchResult || dailyLikeStatus.isLoading || dailyLikeStatus.data?.remaining === 0}
          onPress={() => void likeProfile()}
          style={[styles.likeButton, { backgroundColor: colors.primary, opacity: reaction.isPending || dailyLikeStatus.data?.remaining === 0 ? 0.55 : 1 }]}
        >
          <Feather name="heart" size={24} color={colors.accentForeground} />
          <Text style={[styles.likeButtonText, { color: colors.accentForeground }]}>{reaction.isPending ? "Saving…" : "Like"}</Text>
        </Pressable>
      </View>
      {likeConfirmation ? (
        <View style={[styles.confirmation, { top: Math.max(insets.top, 18) + 8, backgroundColor: colors.card, borderColor: colors.primary }]} accessibilityRole="alert" accessibilityLiveRegion="polite" testID="public-profile-like-confirmation">
          <Feather name="heart" size={16} color={colors.primary} />
          <Text style={[styles.confirmationText, { color: colors.foreground }]}>{likeConfirmation}</Text>
        </View>
      ) : null}
      <Modal visible={!!matchResult} transparent animationType="fade" onRequestClose={() => setMatchResult(null)}>
        <View style={styles.matchScrim}>
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
              <Text style={[styles.matchPrimaryText, { color: colors.accentForeground }]}>{matchResult?.matchId ? "Start chatting" : "View matches"}</Text>
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
  container: { minHeight: "100%", alignItems: "center", padding: 24, paddingTop: 55 },
  back: { alignSelf: "flex-start", width: 40, height: 42, justifyContent: "center", marginBottom: 20 },
  galleryFrame: { height: 430, borderWidth: 1, borderRadius: 22, overflow: "hidden", position: "relative" },
  photoCount: { position: "absolute", right: 12, bottom: 12, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.65)", paddingHorizontal: 10, paddingVertical: 6 },
  photoCountText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  name: { fontSize: 25, fontWeight: "800", marginTop: 18 },
  city: { fontSize: 13, marginTop: 5 },
  section: { alignSelf: "stretch", fontSize: 16, fontWeight: "700", marginTop: 28, marginBottom: 9 },
  bio: { alignSelf: "stretch", fontSize: 14, lineHeight: 21 },
  tags: { alignSelf: "stretch", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { overflow: "hidden", borderRadius: 18, paddingHorizontal: 11, paddingVertical: 7, fontSize: 12, fontWeight: "600" },
  actionBar: { position: "absolute", left: 0, right: 0, borderTopWidth: 1, paddingHorizontal: 22, paddingTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 22 },
  passButton: { width: 52, height: 52, borderWidth: 1, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(36,31,42,0.95)" },
  likeButton: { minWidth: 138, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, paddingHorizontal: 22 },
  likeButtonText: { fontSize: 15, fontWeight: "800" },
  confirmation: { position: "absolute", alignSelf: "center", zIndex: 10, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 24, paddingHorizontal: 17, paddingVertical: 12, elevation: 8 },
  confirmationText: { fontSize: 14, fontWeight: "700" },
  matchScrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", justifyContent: "center", padding: 22 },
  matchCard: { width: "100%", maxWidth: 380, alignItems: "center", borderWidth: 1, borderRadius: 26, padding: 24 },
  matchIcon: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  matchTitle: { fontSize: 29, fontWeight: "800", marginTop: 15 },
  matchCopy: { fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 8 },
  matchPrimary: { width: "100%", minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 22 },
  matchPrimaryText: { fontSize: 14, fontWeight: "800" },
  matchSecondary: { width: "100%", minHeight: 46, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 9 },
  matchSecondaryText: { fontSize: 13, fontWeight: "700" },
});
