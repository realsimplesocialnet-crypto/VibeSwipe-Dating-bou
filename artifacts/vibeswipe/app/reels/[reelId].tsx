import { useAuth } from "@clerk/expo";
import {
  getGetMatchesQueryKey,
  getGetMyReelsQueryKey,
  getGetProfileReelsQueryKey,
  getGetReelQueryKey,
  getGetReelCommentsQueryKey,
  getGetReelsFeedQueryKey,
  getDownloadReelUrl,
  useMarkReelNotInterested,
  useCreateReelComment,
  useGetMatches,
  useGetReel,
  useGetReelComments,
  useLikeReel,
  useRecordReelShare,
  useRecordReelView,
  useSaveReel,
  useSendMessage,
  useUnlikeReel,
  useUnsaveReel,
  type Reel,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { Image as CachedImage } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { VideoView, useVideoPlayer } from "expo-video";
import { File, Paths } from "expo-file-system";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { usePremiumColors } from "@/hooks/useColors";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Stop } from "react-native-svg";

type ReelIconName = "like" | "comment" | "share" | "save";

function formatReelCount(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", compactDisplay: "short", maximumFractionDigits: 1 }).format(value);
}

function ReelActionIcon({ name, filled = false }: { name: ReelIconName; filled?: boolean }) {
  const gradientId = `native-reel-${useId().replace(/:/g, "")}`;
  const stroke = `url(#${gradientId})`;
  return (
      <Svg width={34} height={34} viewBox="0 0 24 24" fill="none">
      <Defs>
        <SvgLinearGradient id={gradientId} x1="3" y1="2" x2="21" y2="22">
          <Stop offset="0" stopColor="#ff63aa" />
          <Stop offset="1" stopColor="#a875ff" />
        </SvgLinearGradient>
      </Defs>
      {name === "like" ? <Path d="M20.8 4.7a5.4 5.4 0 0 0-7.7 0L12 5.8l-1.1-1.1a5.4 5.4 0 0 0-7.7 7.7l1.1 1.1L12 21l7.7-7.5 1.1-1.1a5.4 5.4 0 0 0 0-7.7Z" stroke={filled ? stroke : "#fff"} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" fill={filled ? stroke : "#fff"} /> : null}
      {name === "comment" ? <>
        <Path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M8.5 11.5h.01M12.5 11.5h.01M16.5 11.5h.01" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" />
      </> : null}
      {name === "share" ? <Path d="M22 2 11 13M22 2 15 22l-4-9-9-4 20-7Z" stroke="#fff" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" /> : null}
      {name === "save" ? <Path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4V4.5Z" stroke={filled ? stroke : "#fff"} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" fill={filled ? stroke : "none"} /> : null}
    </Svg>
  );
}
import { mediaUri } from "@/lib/media";
import { ProfileAvatar } from "@/components/ProfileAvatar";

export default function ProfileReelScreen() {
  const { reelId, returnTo } = useLocalSearchParams<{ reelId: string; returnTo?: string }>();
  const colors = usePremiumColors();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [token, setToken] = useState<string | null>(null);
  const [shareVisible, setShareVisible] = useState(false);
  const [moreVisible, setMoreVisible] = useState(false);
  const [downloadPending, setDownloadPending] = useState(false);
  const [androidShareTargetsVisible, setAndroidShareTargetsVisible] = useState(false);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [commentVideoPaused, setCommentVideoPaused] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [slideViewportWidth, setSlideViewportWidth] = useState(0);
  const [commentDraft, setCommentDraft] = useState("");
  const [pendingMatchId, setPendingMatchId] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<Record<string, boolean>>({});
  const [shareError, setShareError] = useState("");
  const [actionError, setActionError] = useState("");
  const externalSharePending = useRef(false);
  const recordView = useRecordReelView();
  const recordShare = useRecordReelShare();
  const likeReel = useLikeReel();
  const unlikeReel = useUnlikeReel();
  const saveReel = useSaveReel();
  const unsaveReel = useUnsaveReel();
  const markNotInterested = useMarkReelNotInterested();
  const createComment = useCreateReelComment();
  const matches = useGetMatches({
    query: { queryKey: getGetMatchesQueryKey(), enabled: shareVisible },
  });
  const sendMessage = useSendMessage();
  const viewRecorded = useRef(false);
  const reelQuery = useGetReel(reelId ?? "", { query: { enabled: Boolean(reelId), refetchInterval: 5_000 } });
  const commentsQuery = useGetReelComments(reelId ?? "", {
    query: { enabled: commentsVisible && Boolean(reelId), refetchInterval: commentsVisible ? 5_000 : false },
  });

  useEffect(() => {
    let active = true;
    void getToken().then((value) => {
      if (active) setToken(value);
    });
    return () => {
      active = false;
    };
  }, [getToken]);

  const slideshow = reelQuery.data?.mediaType === "slides" && reelQuery.data.slideReferences.length > 1;
  const slideReferences = reelQuery.data?.slideReferences ?? [];
  const uri = reelQuery.data && !slideshow ? mediaUri(reelQuery.data.videoReference) : null;
  useEffect(() => { setSlideIndex(0); }, [reelId]);
  useEffect(() => {
    if (!slideshow || !token) return;
    const neighbors = [slideIndex - 1, slideIndex + 1, slideIndex + 2]
      .filter(position => position >= 0 && position < slideReferences.length)
      .map(position => mediaUri(slideReferences[position]))
      .filter((value): value is string => Boolean(value));
    if (!neighbors.length) return;
    void CachedImage.prefetch(neighbors, {
      cachePolicy: "memory-disk",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
  }, [slideIndex, slideReferences, slideshow, token]);
  const source = useMemo(
    () => uri && token ? { uri, headers: { Authorization: `Bearer ${token}` } } : null,
    [token, uri],
  );
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = false;
  });

  useEffect(() => {
    if (!source) return;
    const update = (status: string) => {
      if (status === "readyToPlay") {
        player.play();
        if (reelQuery.data && !reelQuery.data.isOwner && !viewRecorded.current) {
          viewRecorded.current = true;
          recordView.mutate({ reelId: reelId ?? "" }, {
            onSuccess: () => {
              void queryClient.invalidateQueries({
                queryKey: getGetProfileReelsQueryKey({ profileId: reelQuery.data!.creatorId }),
              });
            },
          });
        }
      }
    };
    update(player.status);
    const subscription = player.addListener("statusChange", (event) => update(event.status));
    return () => subscription.remove();
  }, [player, source, reelQuery.data, recordView, reelId, queryClient]);

  function goBack() {
    if (returnTo) {
      router.replace(returnTo as never);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/profile");
    }
  }

  function refreshReelLists(creatorId: string) {
    void queryClient.invalidateQueries({ queryKey: getGetProfileReelsQueryKey({ profileId: creatorId }) });
    void queryClient.invalidateQueries({ queryKey: getGetMyReelsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetReelsFeedQueryKey() });
  }

  function recordCompletedShare(reel: Reel, destination: "apps" | "chat") {
    void recordShare.mutateAsync({ reelId: reel.id }).then((updated) => {
      queryClient.setQueryData<Reel>(getGetReelQueryKey(reel.id), (current) =>
        current ? { ...current, shareCount: updated.shareCount } : current,
      );
      refreshReelLists(reel.creatorId);
    }).catch(() => {
      const message = "The Reel was shared, but its count did not sync. Reopen it while online.";
      if (destination === "apps") setActionError(message);
      else setShareError(message);
    });
  }

  async function toggleLike() {
    const reel = reelQuery.data;
    if (!reel || likeReel.isPending || unlikeReel.isPending) return;
    setActionError("");
    try {
      const result = await (reel.likedByMe ? unlikeReel : likeReel).mutateAsync({ reelId: reel.id });
      queryClient.setQueryData<Reel>(getGetReelQueryKey(reel.id), (current) => current ? { ...current, ...result } : current);
      refreshReelLists(reel.creatorId);
    } catch {
      setActionError("Your like did not save. Try again.");
    }
  }

  async function toggleSave() {
    const reel = reelQuery.data;
    if (!reel || saveReel.isPending || unsaveReel.isPending) return;
    setActionError("");
    try {
      const result = await (reel.savedByMe ? unsaveReel : saveReel).mutateAsync({ reelId: reel.id });
      queryClient.setQueryData<Reel>(getGetReelQueryKey(reel.id), (current) => current ? { ...current, ...result } : current);
      refreshReelLists(reel.creatorId);
    } catch {
      setActionError("Saving did not work. Try again.");
    }
  }

  async function postComment() {
    const reel = reelQuery.data;
    const content = commentDraft.trim();
    if (!reel || !content || createComment.isPending) return;
    setActionError("");
    try {
      const comment = await createComment.mutateAsync({ reelId: reel.id, data: { content } });
      queryClient.setQueryData(getGetReelCommentsQueryKey(reel.id), (current: typeof commentsQuery.data) => [...(current ?? []), comment]);
      queryClient.setQueryData<Reel>(getGetReelQueryKey(reel.id), (current) => current ? { ...current, commentCount: current.commentCount + 1 } : current);
      setCommentDraft("");
      refreshReelLists(reel.creatorId);
    } catch {
      setActionError("Your comment did not post. Try again.");
    }
  }

  async function shareToApps() {
    const reel = reelQuery.data;
    if (Platform.OS !== "ios" || !reel || externalSharePending.current) return;
    externalSharePending.current = true;
    setShareError("");
    setActionError("");
    setShareVisible(false);
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, Platform.OS === "ios" ? 320 : 120));
      const origin = (process.env.EXPO_PUBLIC_WEB_URL
        || (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "https://myage.beauty")
      ).replace(/\/+$/, "");
      const url = `${origin}/reels/${reel.id}`;
      const message = `${reel.caption || `${reel.creatorName} on Myage Reels`}\n\n${url}`;
      const result = await Share.share(
        { title: `${reel.creatorName} on Reels`, message, url },
        { dialogTitle: "Share Reel" },
      );
      if (result.action !== Share.sharedAction) return;
      recordCompletedShare(reel, "apps");
    } catch {
      setActionError("Could not open the share menu. Try again.");
    } finally {
      externalSharePending.current = false;
    }
  }

  async function shareToExternalApp(target: "whatsapp" | "telegram" | "messages" | "email") {
    const reel = reelQuery.data;
    if (Platform.OS !== "android" || !reel || externalSharePending.current) return;
    externalSharePending.current = true;
    setShareError("");
    setActionError("");
    setShareVisible(false);
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 120));
      const origin = (process.env.EXPO_PUBLIC_WEB_URL
        || (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "https://myage.beauty")
      ).replace(/\/+$/, "");
      const url = `${origin}/reels/${reel.id}`;
      const message = `${reel.caption || `${reel.creatorName} on Myage Reels`}\n\n${url}`;
      const encodedUrl = encodeURIComponent(url);
      const encodedMessage = encodeURIComponent(message);
      const encodedSubject = encodeURIComponent(`${reel.creatorName} on Myage Reels`);
      const targetUrl = target === "whatsapp"
        ? `https://wa.me/?text=${encodedMessage}`
        : target === "telegram"
          ? `https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(reel.caption || "Watch this Reel")}`
          : target === "messages"
            ? `sms:?body=${encodedMessage}`
            : `mailto:?subject=${encodedSubject}&body=${encodedMessage}`;
      await Linking.openURL(targetUrl);
      recordCompletedShare(reel, "apps");
    } catch {
      setActionError("Could not open that app. Try another share option.");
    } finally {
      externalSharePending.current = false;
    }
  }

  async function shareToMatch(matchId: string) {
    const reel = reelQuery.data;
    if (!reel || pendingMatchId || sentTo[matchId]) return;
    setPendingMatchId(matchId);
    setShareError("");
    try {
      await sendMessage.mutateAsync({
        matchId,
        data: { content: `Shared a Reel: /reels/${reel.id}` },
      });
      setSentTo((current) => ({ ...current, [matchId]: true }));
      void queryClient.invalidateQueries({ queryKey: getGetMatchesQueryKey() });
      recordCompletedShare(reel, "chat");
    } catch {
      setShareError("That Reel did not send. Try again.");
    } finally {
      setPendingMatchId(null);
    }
  }

  const shareChats = (matches.data ?? []).filter((match) => !match.blockedByMe && !match.blockedMe);

  function openComments() {
    setCommentVideoPaused(false);
    setCommentsVisible(true);
  }

  async function markCurrentNotInterested() {
    const reel = reelQuery.data;
    if (!reel || markNotInterested.isPending) return;
    try {
      await markNotInterested.mutateAsync({ reelId: reel.id });
      await queryClient.invalidateQueries({ queryKey: getGetReelsFeedQueryKey() });
      setMoreVisible(false);
      Alert.alert("Updated your recommendations", "We’ll show you fewer Reels like this.");
      goBack();
    } catch {
      Alert.alert("Could not update your feed", "Please check your connection and try again.");
    }
  }

  async function downloadCurrentReel() {
    const reel = reelQuery.data;
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    if (!reel || !reel.canDownload || reel.mediaType !== "video" || !token || !domain || downloadPending) return;
    setDownloadPending(true);
    try {
      const url = `https://${domain}${getDownloadReelUrl(reel.id)}`;
      const file = await File.downloadFileAsync(url, new File(Paths.document, `myage-reel-${reel.id}.mp4`), { headers: { Authorization: `Bearer ${token}` }, idempotent: true });
      setMoreVisible(false);
      await File.preview(file);
    } catch {
      Alert.alert("Download failed", "This Reel could not be downloaded. Please try again.");
    } finally {
      setDownloadPending(false);
    }
  }

  function toggleVideoWhileCommenting() {
    if (commentVideoPaused) player.play();
    else player.pause();
    setCommentVideoPaused((paused) => !paused);
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back to profile" onPress={goBack} style={styles.back}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Reels</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="More Reel options" onPress={()=>setMoreVisible(true)} style={styles.back} testID="button-reel-more-options"><Feather name="more-horizontal" size={22} color={colors.foreground}/></Pressable>
        </View>
        <View style={styles.videoStage}>
          {reelQuery.isLoading || !token ? (
            <ActivityIndicator color={colors.primary} />
          ) : slideshow ? (
            <View style={StyleSheet.absoluteFill} onLayout={(event) => setSlideViewportWidth(event.nativeEvent.layout.width)}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                style={StyleSheet.absoluteFill}
                contentContainerStyle={{ width: (slideViewportWidth || screenWidth) * slideReferences.length }}
                onMomentumScrollEnd={(event) => setSlideIndex(Math.min(slideReferences.length - 1, Math.round(event.nativeEvent.contentOffset.x / Math.max(1, slideViewportWidth || screenWidth))))}
                testID="reel-photo-slides"
              >
                {slideReferences.map((reference, position) => {
                  const slideUri = mediaUri(reference);
                  return <CachedImage
                    key={`${reference}-${position}`}
                    source={token && slideUri ? { uri: slideUri, headers: { Authorization: `Bearer ${token}` } } : undefined}
                    style={{ width: slideViewportWidth || screenWidth, height: "100%" }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={0}
                    priority={position === slideIndex ? "high" : "normal"}
                    accessibilityLabel={`Photo slide ${position + 1} of ${slideReferences.length}`}
                  />;
                })}
              </ScrollView>
              <View pointerEvents="none" style={styles.slideCount}><Text style={styles.slideCountText}>{slideIndex + 1}/{slideReferences.length}</Text></View>
              <View pointerEvents="none" style={styles.slideDots}>{slideReferences.map((_, position) => <View key={position} style={[styles.slideDot, position === slideIndex && styles.slideDotActive]} />)}</View>
            </View>
          ) : source ? (
            <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls />
          ) : reelQuery.isError ? (
            <View style={styles.message}><ActivityIndicator size="large" color={colors.primary} /></View>
          ) : null}
          {reelQuery.data ? (
            <View style={styles.actionRail}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${reelQuery.data.likedByMe ? "Unlike" : "Like"}, ${reelQuery.data.likeCount}`}
                accessibilityState={{ selected: reelQuery.data.likedByMe, disabled: likeReel.isPending || unlikeReel.isPending }}
                testID="button-like-reel"
                disabled={likeReel.isPending || unlikeReel.isPending}
                onPress={() => void toggleLike()}
                style={styles.actionButton}
              >
                <ReelActionIcon name="like" filled={reelQuery.data.likedByMe} />
                <Text style={styles.actionCount}>{formatReelCount(reelQuery.data.likeCount)}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Comments, ${reelQuery.data.commentCount}`}
                testID="button-comments-reel"
                onPress={openComments}
                style={styles.actionButton}
              >
                <ReelActionIcon name="comment" />
                <Text style={styles.actionCount}>{formatReelCount(reelQuery.data.commentCount)}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Share Reel, ${reelQuery.data.shareCount} shares`}
                testID="button-share-reel"
                onPress={() => {
                  setShareError("");
                  setAndroidShareTargetsVisible(false);
                  setShareVisible(true);
                }}
                style={styles.actionButton}
              >
                <ReelActionIcon name="share" />
                <Text style={styles.actionCount}>{formatReelCount(reelQuery.data.shareCount)}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${reelQuery.data.savedByMe ? "Remove from saved" : "Save"}, ${reelQuery.data.saveCount}`}
                accessibilityState={{ selected: reelQuery.data.savedByMe, disabled: saveReel.isPending || unsaveReel.isPending }}
                testID="button-save-reel"
                disabled={saveReel.isPending || unsaveReel.isPending}
                onPress={() => void toggleSave()}
                style={styles.actionButton}
              >
                <ReelActionIcon name="save" filled={reelQuery.data.savedByMe} />
                <Text style={styles.actionCount}>{formatReelCount(reelQuery.data.saveCount)}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
        {reelQuery.data ? (
          <View style={styles.caption}>
            <View style={styles.creatorRow}>
              <LinearGradient colors={["#ff63aa", "#a875ff"]} style={styles.creatorAvatarRing}>
                <ProfileAvatar
                  profile={{
                    name: reelQuery.data.creatorName,
                    photos: reelQuery.data.creatorPhoto ? [reelQuery.data.creatorPhoto] : [],
                    isVerified: reelQuery.data.creatorVerified,
                  }}
                  size={34}
                />
              </LinearGradient>
              <View style={styles.creatorDetails}>
                <Text style={[styles.creator, { color: colors.foreground }]}>{reelQuery.data.creatorName}</Text>
                {reelQuery.data.creatorLocation ? (
                  <Text style={[styles.creatorLocation, { color: colors.mutedForeground }]}>{reelQuery.data.creatorLocation}</Text>
                ) : null}
              </View>
            </View>
            {reelQuery.data.caption ? <Text style={[styles.captionText, { color: colors.mutedForeground }]}>{reelQuery.data.caption}</Text> : null}
            {actionError ? <Text accessibilityRole="alert" style={[styles.shareError, { color: colors.destructive }]}>{actionError}</Text> : null}
          </View>
        ) : null}
      </View>
      <Modal transparent visible={shareVisible} animationType="slide" onRequestClose={() => setShareVisible(false)}>
        <View style={styles.shareBackdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close Reel sharing"
            onPress={() => setShareVisible(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.shareSheet, { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 18) }]}>
            <View style={styles.shareHeading}>
              <Text style={[styles.shareTitle, { color: colors.foreground }]}>Share Reel</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setShareVisible(false)} style={styles.closeShare}>
                <Feather name="x" size={20} color={colors.foreground} />
              </Pressable>
            </View>
            {shareError ? <Text accessibilityRole="alert" style={[styles.shareError, { color: colors.destructive }]}>{shareError}</Text> : null}
            {Platform.OS === "android" ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={androidShareTargetsVisible ? "Hide share apps" : "Choose an app to share this Reel"}
                  testID="button-share-to-apps"
                  onPress={() => setAndroidShareTargetsVisible((visible) => !visible)}
                  style={[styles.shareAppsButton, { backgroundColor: colors.background, borderColor: colors.primary }]}
                >
                  <View style={[styles.shareAppsIcon, { backgroundColor: colors.primary }]}>
                    <Feather name="share-2" size={18} color={colors.primaryForeground} />
                  </View>
                  <View style={styles.shareAppsCopy}>
                    <Text style={[styles.shareAppsTitle, { color: colors.foreground }]}>Share to apps</Text>
                    <Text style={[styles.shareAppsSubtitle, { color: colors.mutedForeground }]}>WhatsApp, Telegram, Messages, Email</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                </Pressable>
                {androidShareTargetsVisible ? (
                  <View style={styles.shareAppTargets}>
                    {([
                      ["whatsapp", "WhatsApp", "message-circle"],
                      ["telegram", "Telegram", "send"],
                      ["messages", "Messages", "message-square"],
                      ["email", "Email", "mail"],
                    ] as const).map(([target, label, icon]) => (
                      <Pressable
                        key={target}
                        accessibilityRole="button"
                        accessibilityLabel={`Share Reel with ${label}`}
                        testID={`button-share-reel-${target}`}
                        onPress={() => void shareToExternalApp(target)}
                        style={[styles.shareAppTarget, { backgroundColor: colors.background }]}
                      >
                        <View style={[styles.shareAppTargetIcon, { backgroundColor: colors.primary }]}>
                          <Feather name={icon} size={18} color={colors.primaryForeground} />
                        </View>
                        <Text style={[styles.shareAppTargetLabel, { color: colors.foreground }]}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Share Reel to another app"
                testID="button-share-to-apps"
                onPress={() => void shareToApps()}
                style={[styles.shareAppsButton, { backgroundColor: colors.background, borderColor: colors.primary }]}
              >
                <View style={[styles.shareAppsIcon, { backgroundColor: colors.primary }]}>
                  <Feather name="share-2" size={18} color={colors.primaryForeground} />
                </View>
                <View style={styles.shareAppsCopy}>
                  <Text style={[styles.shareAppsTitle, { color: colors.foreground }]}>Share to apps</Text>
                  <Text style={[styles.shareAppsSubtitle, { color: colors.mutedForeground }]}>Messages, WhatsApp, and more</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </Pressable>
            )}
            <Text style={[styles.shareSectionTitle, { color: colors.mutedForeground }]}>SEND IN A CHAT</Text>
            {matches.isLoading ? (
              <ActivityIndicator color={colors.primary} style={styles.shareLoading} />
            ) : matches.isError ? (
              <Pressable accessibilityRole="button" onPress={() => void matches.refetch()} style={styles.shareEmpty}>
                <Text style={[styles.shareEmptyText, { color: colors.mutedForeground }]}>Chats could not load. Tap to retry.</Text>
              </Pressable>
            ) : !shareChats.length ? (
              <Text style={[styles.shareEmptyText, { color: colors.mutedForeground }]}>Only mutual matches can receive a Reel in chat.</Text>
            ) : (
              <ScrollView style={styles.shareList} keyboardShouldPersistTaps="handled">
                {shareChats.map((match) => {
                  const sent = sentTo[match.id];
                  const pending = pendingMatchId === match.id;
                  return (
                    <Pressable
                      key={match.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${sent ? "Sent to" : "Send Reel to"} ${match.profile.name}`}
                      testID={`button-share-to-${match.id}`}
                      disabled={Boolean(pendingMatchId) || sent}
                      onPress={() => void shareToMatch(match.id)}
                      style={[styles.shareRecipient, { backgroundColor: colors.background }, sent && styles.shareRecipientSent]}
                    >
                      <ProfileAvatar profile={match.profile} size={42} />
                      <Text numberOfLines={1} style={[styles.shareRecipientName, { color: colors.foreground }]}>{match.profile.name}</Text>
                      <View style={[styles.sendPill, { backgroundColor: sent ? colors.secondary : colors.primary }]}>
                        {sent ? <Feather name="check" size={14} color={colors.secondaryForeground} /> : null}
                        <Text style={[styles.sendPillText, { color: sent ? colors.secondaryForeground : colors.primaryForeground }]}>
                          {sent ? "Sent" : pending ? "Sending" : "Send"}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
      <Modal transparent visible={moreVisible} animationType="fade" onRequestClose={()=>setMoreVisible(false)}>
        <View style={styles.moreBackdrop}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close Reel options" onPress={()=>setMoreVisible(false)} style={StyleSheet.absoluteFill}/>
          <View style={[styles.moreSheet,{backgroundColor:colors.card,borderColor:colors.border}]}>
            <View style={styles.shareHeading}><Text style={[styles.shareTitle,{color:colors.foreground}]}>Reel options</Text><Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={()=>setMoreVisible(false)} style={styles.closeShare}><Feather name="x" size={20} color={colors.foreground}/></Pressable></View>
            {reelQuery.data?.canDownload && reelQuery.data.mediaType==="video" ? <Pressable accessibilityRole="button" testID="button-download-reel" disabled={downloadPending} onPress={()=>void downloadCurrentReel()} style={[styles.moreAction,{borderColor:colors.border}]}><Feather name="download" size={18} color={colors.primary}/><Text style={[styles.moreActionText,{color:colors.foreground}]}>{downloadPending?"Downloading…":"Download Reel"}</Text></Pressable>:null}
            {reelQuery.data && !reelQuery.data.isOwner ? <Pressable accessibilityRole="button" testID="button-not-interested-reel" disabled={markNotInterested.isPending} onPress={()=>void markCurrentNotInterested()} style={[styles.moreAction,{borderColor:colors.border}]}><Feather name="eye-off" size={18} color={colors.primary}/><Text style={[styles.moreActionText,{color:colors.foreground}]}>Not interested</Text></Pressable>:null}
            {reelQuery.data?.isOwner && !reelQuery.data.canDownload ? <Text style={[styles.shareError,{color:colors.mutedForeground}]}>Downloads are turned off for your Reels.</Text>:null}
          </View>
        </View>
      </Modal>
      <Modal transparent visible={commentsVisible} animationType="slide" onRequestClose={() => setCommentsVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.commentBackdrop}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close comments" onPress={() => setCommentsVisible(false)} style={StyleSheet.absoluteFill} />
          <View style={[styles.commentSheet, { backgroundColor: colors.card }]}>
            <View style={styles.shareHeading}>
              <Text style={[styles.shareTitle, { color: colors.foreground }]}>Comments <Text style={{ color: colors.mutedForeground }}>{reelQuery.data?.commentCount ?? 0}</Text></Text>
              <View style={styles.commentHeadingActions}>
                {reelQuery.data?.mediaType === "video" && <Pressable accessibilityRole="button" accessibilityLabel={commentVideoPaused ? "Play video" : "Pause video"} onPress={toggleVideoWhileCommenting} style={styles.commentPlayback}>
                  <Feather name={commentVideoPaused ? "play" : "pause"} size={16} color={colors.foreground} />
                  <Text style={[styles.commentPlaybackText, { color: colors.foreground }]}>{commentVideoPaused ? "Play" : "Pause"}</Text>
                </Pressable>}
                <Pressable accessibilityRole="button" accessibilityLabel="Close comments" onPress={() => setCommentsVisible(false)} style={styles.closeShare}>
                  <Feather name="x" size={20} color={colors.foreground} />
                </Pressable>
              </View>
            </View>
            {commentsQuery.isLoading ? (
              <ActivityIndicator color={colors.primary} style={styles.shareLoading} />
            ) : commentsQuery.isError ? (
              <Pressable accessibilityRole="button" onPress={() => void commentsQuery.refetch()} style={styles.shareEmpty}>
                <Text style={[styles.shareEmptyText, { color: colors.mutedForeground }]}>Comments could not load. Tap to retry.</Text>
              </Pressable>
            ) : (
              <ScrollView style={styles.commentList} keyboardShouldPersistTaps="handled">
                {(commentsQuery.data ?? []).map((comment) => (
                  <View key={comment.id} style={styles.commentRow}>
                    <ProfileAvatar profile={{ name: comment.authorName, photos: comment.authorPhoto ? [comment.authorPhoto] : [] } as never} size={34} />
                    <View style={styles.commentCopy}>
                      <Text style={[styles.commentAuthor, { color: colors.foreground }]}>{comment.authorName}</Text>
                      <Text style={[styles.commentText, { color: colors.mutedForeground }]}>{comment.content}</Text>
                    </View>
                  </View>
                ))}
                {!commentsQuery.data?.length ? <Text style={[styles.shareEmptyText, { color: colors.mutedForeground }]}>{reelQuery.data?.commentCount ? "Comments aren’t available right now." : "No comments yet. Say something kind."}</Text> : null}
              </ScrollView>
            )}
            {actionError ? <Text accessibilityRole="alert" style={[styles.shareError, { color: colors.destructive }]}>{actionError}</Text> : null}
            {reelQuery.data?.canComment !== false ? <View style={[styles.commentComposer, { borderColor: colors.border }]}>
              <TextInput
                accessibilityLabel="Add a comment"
                testID="input-reel-comment"
                value={commentDraft}
                onChangeText={setCommentDraft}
                maxLength={500}
                placeholder="Add a comment"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.commentInput, { color: colors.foreground }]}
                returnKeyType="send"
                onSubmitEditing={() => void postComment()}
              />
              <Pressable accessibilityRole="button" accessibilityLabel="Post comment" testID="button-post-reel-comment" disabled={!commentDraft.trim() || createComment.isPending} onPress={() => void postComment()} style={[styles.commentSend, { backgroundColor: colors.primary }, (!commentDraft.trim() || createComment.isPending) && styles.disabled]}>
                {createComment.isPending ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <Feather name="arrow-up" size={19} color={colors.primaryForeground} />}
              </Pressable>
            </View> : <Text style={[styles.commentUnavailable,{color:colors.mutedForeground}]}>The creator has turned off new comments.</Text>}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  page: { flex: 1 },
  header: { height: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 },
  headerSpacer: { width: 42 },
  back: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 19, fontWeight: "800" },
  videoStage: { flex: 1, minHeight: 200, overflow: "hidden", backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  actionRail: { position: "absolute", right: 10, bottom: 16, alignItems: "center", gap: 13 },
  actionButton: { width: 60, minWidth: 60, minHeight: 78, alignItems: "center", justifyContent: "flex-start", gap: 7 },
  actionCount: { color: "#fff", fontSize: 12, fontWeight: "900", letterSpacing: 0.2, textShadowColor: "#000", textShadowRadius: 5 },
  caption: { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  creatorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  creatorAvatarRing: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, padding: 2 },
  creatorDetails: { flex: 1, minWidth: 0, gap: 3 },
  creator: { fontSize: 15, fontWeight: "700" },
  creatorLocation: { fontSize: 12 },
  captionText: { fontSize: 14, lineHeight: 20 },
  message: { alignItems: "center", gap: 10 },
  messageText: { fontSize: 15 },
  retry: { fontWeight: "700" },
  shareBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" },
  moreBackdrop: { flex: 1, alignItems: "flex-end", paddingTop: 58, paddingHorizontal: 12, backgroundColor: "rgba(0,0,0,0.25)" },
  moreSheet: { width: 250, borderWidth: 1, borderRadius: 18, padding: 10, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 16, elevation: 10 },
  moreAction: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8 },
  moreActionText: { fontSize: 14, fontWeight: "700" },
  shareSheet: { maxHeight: "72%", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 12 },
  shareHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  shareTitle: { fontSize: 18, fontWeight: "800" },
  closeShare: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  shareError: { marginTop: 3, fontSize: 12, fontWeight: "600" },
  shareSectionTitle: { marginTop: 10, marginBottom: 6, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  shareAppsButton: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 17, paddingHorizontal: 12, marginTop: 8 },
  shareAppsIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 13 },
  shareAppsCopy: { flex: 1, gap: 3 },
  shareAppsTitle: { fontSize: 14, fontWeight: "800" },
  shareAppsSubtitle: { fontSize: 11, fontWeight: "600" },
  shareAppTargets: { flexDirection: "row", justifyContent: "space-between", gap: 4, marginTop: 12 },
  shareAppTarget: { flex: 1, minHeight: 72, alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 14 },
  shareAppTargetIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17 },
  shareAppTargetLabel: { fontSize: 10, fontWeight: "700" },
  shareLoading: { paddingVertical: 28 },
  shareEmpty: { minHeight: 76, justifyContent: "center" },
  shareEmptyText: { paddingVertical: 15, fontSize: 13, lineHeight: 19 },
  shareList: { marginBottom: 4 },
  commentBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" },
  commentSheet: { maxHeight: "68%", minHeight: "46%", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  commentHeadingActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  commentPlayback: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: 10 },
  commentPlaybackText: { fontSize: 11, fontWeight: "700" },
  commentList: { flexGrow: 1, marginVertical: 8 },
  commentRow: { flexDirection: "row", gap: 10, paddingVertical: 9 },
  commentCopy: { flex: 1, gap: 3 },
  commentAuthor: { fontSize: 12, fontWeight: "800" },
  commentText: { fontSize: 13, lineHeight: 18 },
  commentComposer: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 26, paddingLeft: 14, paddingRight: 4 },
  commentUnavailable: { textAlign: "center", paddingVertical: 14, fontSize: 12 },
  commentInput: { minWidth: 0, flex: 1, paddingVertical: 8, fontSize: 15 },
  commentSend: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  slideCount: { position: "absolute", top: 12, right: 12, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 10, paddingVertical: 5 },
  slideCountText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  slideDots: { position: "absolute", left: 0, right: 0, bottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  slideDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.48)" },
  slideDotActive: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#fff" },
  disabled: { opacity: 0.45 },
  shareRecipient: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 11, borderRadius: 16, paddingHorizontal: 10, marginVertical: 3 },
  shareRecipientSent: { opacity: 0.76 },
  shareRecipientName: { flex: 1, fontSize: 14, fontWeight: "700" },
  sendPill: { minWidth: 68, minHeight: 34, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 18, paddingHorizontal: 11 },
  sendPillText: { fontSize: 12, fontWeight: "800" },
});
