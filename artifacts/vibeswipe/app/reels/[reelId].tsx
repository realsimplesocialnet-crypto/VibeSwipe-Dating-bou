import { useAuth } from "@clerk/expo";
import {
  getGetMatchesQueryKey,
  getGetMyReelsQueryKey,
  getGetProfileLikedReelsQueryKey,
  getGetProfileReelsQueryKey,
  getGetProfileRepostedReelsQueryKey,
  getGetReelQueryKey,
  getGetReelCommentsQueryKey,
  getGetReelsFeedQueryKey,
  getGetSavedReelsQueryKey,
  getDownloadReelUrl,
  useMarkReelNotInterested,
  useCreateReelComment,
  useGetMatches,
  useGetMyProfile,
  useGetReel,
  useGetReelComments,
  useLikeReel,
  useRecordReelShare,
  useRecordReelView,
  useRepostReel,
  useRemoveRepost,
  useSaveReel,
  useSendMessage,
  useRequestProfileMediaUpload,
  useUnlikeReel,
  useUnsaveReel,
  type MediaUploadInputContentType,
  type Reel,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { Image as CachedImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { VideoView, useVideoPlayer } from "expo-video";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { File, Paths } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";
import * as Clipboard from "expo-clipboard";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Keyboard, Linking, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { KeyboardAvoidingView, useKeyboardState } from "react-native-keyboard-controller";
import Svg, { Circle, Path } from "react-native-svg";
import { useQueryClient } from "@tanstack/react-query";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { usePremiumColors } from "@/hooks/useColors";

type ReelIconName = "like" | "comment" | "share" | "save";

function formatReelCount(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", compactDisplay: "short", maximumFractionDigits: 1 }).format(value);
}

function ReelActionIcon({ name, filled = false, foreground, activeColor, cutoutColor }: { name: ReelIconName; filled?: boolean; foreground: string; activeColor: string; cutoutColor: string }) {
  const color = filled ? activeColor : foreground;
  return (
    <Svg width={36} height={36} viewBox="0 0 24 24">
      {name === "like" ? <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" fill={color} /> : null}
      {name === "comment" ? <>
        <Path d="M12 2.8c-5.15 0-9.3 3.7-9.3 8.25 0 2.3 1.1 4.43 3.04 5.96L5 21l4.42-2.12c.82.23 1.68.35 2.58.35 5.15 0 9.3-3.7 9.3-8.25S17.15 2.8 12 2.8Z" fill={foreground} />
        <Circle cx={8.2} cy={11.1} r={1.05} fill={cutoutColor} />
        <Circle cx={12} cy={11.1} r={1.05} fill={cutoutColor} />
        <Circle cx={15.8} cy={11.1} r={1.05} fill={cutoutColor} />
      </> : null}
      {name === "share" ? <Path d="M15.2 3.6 22 10l-6.8 6.4v-3.5c-5.5 0-9.1 1.8-11.1 6.6.4-7.3 4.3-11.3 11.1-11.3V3.6Z" fill={foreground} /> : null}
      {name === "save" ? <>
        <Path d="M6 3.5h12v17l-6-4-6 4v-17Z" fill={color} />
      </> : null}
    </Svg>
  );
}
import { mediaUri, profileImagePreviewSource, profileImageSource } from "@/lib/media";
import { ProfileAvatar } from "@/components/ProfileAvatar";

export default function ProfileReelScreen() {
  const { reelId, returnTo, openComments: openCommentsParam, openShare } = useLocalSearchParams<{
    reelId: string;
    returnTo?: string;
    openComments?: string;
    openShare?: string;
  }>();
  const colors = usePremiumColors();
  const { getToken, userId } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardState((state) => state.isVisible);
  const { width: screenWidth } = useWindowDimensions();
  const [token, setToken] = useState<string | null>(null);
  const [shareVisible, setShareVisible] = useState(false);
  const [moreVisible, setMoreVisible] = useState(false);
  const [downloadPending, setDownloadPending] = useState(false);
  const [androidShareTargetsVisible, setAndroidShareTargetsVisible] = useState(false);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [commentPhotoViewer, setCommentPhotoViewer] = useState<string | null>(null);
  const [commentVideoPaused, setCommentVideoPaused] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [slideViewportWidth, setSlideViewportWidth] = useState(0);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentPhoto, setCommentPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [commentPhotoBusy, setCommentPhotoBusy] = useState(false);
  const [pendingMatchId, setPendingMatchId] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<Record<string, boolean>>({});
  const [shareError, setShareError] = useState("");
  const [actionError, setActionError] = useState("");
  const externalSharePending = useRef(false);
  const uploadedCommentPhoto = useRef<{ uri: string; mediaId: string } | null>(null);
  const recordView = useRecordReelView();
  const recordShare = useRecordReelShare();
  const repostReel = useRepostReel();
  const removeRepost = useRemoveRepost();
  const likeReel = useLikeReel();
  const unlikeReel = useUnlikeReel();
  const saveReel = useSaveReel();
  const unsaveReel = useUnsaveReel();
  const markNotInterested = useMarkReelNotInterested();
  const createComment = useCreateReelComment();
  const requestCommentPhotoUpload = useRequestProfileMediaUpload();
  const matches = useGetMatches({
    query: { queryKey: getGetMatchesQueryKey(), enabled: shareVisible },
  });
  const sendMessage = useSendMessage();
  const me = useGetMyProfile();
  const viewRecorded = useRef(false);
  const reelQuery = useGetReel(reelId ?? "", { query: { enabled: Boolean(reelId), refetchInterval: 5_000 } });
  const commentsQuery = useGetReelComments(reelId ?? "", {
    query: { enabled: commentsVisible && Boolean(reelId), refetchInterval: commentsVisible ? 5_000 : false },
  });
  const routeActionOpened = useRef(false);

  useEffect(() => {
    routeActionOpened.current = false;
  }, [reelId]);

  useEffect(() => {
    if (!reelId || reelQuery.data?.id !== reelId || routeActionOpened.current) return;
    if (openCommentsParam === "1") {
      routeActionOpened.current = true;
      setCommentsVisible(true);
    } else if (openShare === "1") {
      routeActionOpened.current = true;
      setShareVisible(true);
    }
  }, [openCommentsParam, openShare, reelId, reelQuery.data?.id]);

  useEffect(() => {
    let active = true;
    void getToken().then((value) => {
      if (active) setToken(value);
    });
    return () => {
      active = false;
    };
  }, [getToken]);

  const slideshow = reelQuery.data?.mediaType === "slides" && reelQuery.data.slideReferences.length > 0;
  const slideReferences = reelQuery.data?.slideReferences ?? [];
  const uri = reelQuery.data && !slideshow ? mediaUri(reelQuery.data.videoReference) : null;
  const soundtrack = reelQuery.data?.soundtrack ?? null;
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
  const soundtrackSource = useMemo(
    () => soundtrack ? { uri: soundtrack.audioUrl, name: soundtrack.title } : null,
    [soundtrack?.audioUrl, soundtrack?.title],
  );
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = false;
  });
  const soundtrackPlayer = useAudioPlayer(soundtrackSource, { updateInterval: 1000 });
  const soundtrackStatus = useAudioPlayerStatus(soundtrackPlayer);
  const [reelVideoPlaying, setReelVideoPlaying] = useState(false);

  useEffect(() => {
    const subscription = player.addListener("playingChange", (event) => setReelVideoPlaying(event.isPlaying));
    setReelVideoPlaying(player.playing);
    return () => subscription.remove();
  }, [player]);

  useEffect(() => {
    if (!soundtrack) {
      soundtrackPlayer.pause();
      return;
    }
    void setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
    soundtrackPlayer.loop = true;
    soundtrackPlayer.volume = 1;
    player.muted = true;
    if ((slideshow || reelVideoPlaying) && soundtrackStatus.isLoaded) soundtrackPlayer.play();
    else soundtrackPlayer.pause();
  }, [player, soundtrackPlayer, soundtrack?.id, soundtrackStatus.isLoaded, slideshow, reelVideoPlaying]);

  useEffect(() => {
    if (!source) return;
    const update = (status: string) => {
      if (status === "readyToPlay") {
        if (soundtrack) player.muted = true;
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
  }, [player, source, reelQuery.data, recordView, reelId, queryClient, soundtrack?.id]);

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

  function refreshRepostLists(creatorId: string) {
    refreshReelLists(creatorId);
    void queryClient.invalidateQueries({ queryKey: getGetSavedReelsQueryKey() });
    const profileIds = new Set([creatorId, userId].filter((value): value is string => Boolean(value)));
    for (const profileId of profileIds) {
      void queryClient.invalidateQueries({ queryKey: getGetProfileLikedReelsQueryKey({ profileId }) });
      void queryClient.invalidateQueries({ queryKey: getGetProfileRepostedReelsQueryKey({ profileId }) });
    }
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

  async function toggleRepost() {
    const reel = reelQuery.data;
    if (!reel || reel.isOwner || repostReel.isPending || removeRepost.isPending) return;
    setShareError("");
    try {
      const result = await (reel.repostedByMe ? removeRepost : repostReel).mutateAsync({ reelId: reel.id });
      queryClient.setQueryData<Reel>(getGetReelQueryKey(reel.id), (current) => current ? { ...current, ...result } : current);
      refreshRepostLists(reel.creatorId);
    } catch {
      setShareError(reel.repostedByMe ? "Could not remove this repost. Try again." : "Could not repost this Reel. Try again.");
    }
  }

  async function postComment() {
    const reel = reelQuery.data;
    const content = commentDraft.trim();
    const selectedPhoto = commentPhoto;
    if (!reel || (!content && !selectedPhoto) || createComment.isPending || commentPhotoBusy) return;
    setActionError("");
    try {
      let mediaId: string | undefined;
      if (selectedPhoto) {
        setCommentPhotoBusy(true);
        const cached = uploadedCommentPhoto.current?.uri === selectedPhoto.uri ? uploadedCommentPhoto.current : null;
        if (cached) {
          mediaId = cached.mediaId;
        } else {
          const file = new File(selectedPhoto.uri);
          const size = selectedPhoto.fileSize ?? file.size;
          if (size <= 0 || size > 15 * 1024 * 1024) throw new Error("Choose a photo smaller than 15 MB.");
          const allowedTypes: MediaUploadInputContentType[] = ["image/jpeg", "image/png", "image/webp", "image/heic"];
          const contentType = allowedTypes.includes(selectedPhoto.mimeType as MediaUploadInputContentType)
            ? selectedPhoto.mimeType as MediaUploadInputContentType
            : "image/jpeg";
          const upload = await requestCommentPhotoUpload.mutateAsync({ data: {
            name: selectedPhoto.fileName ?? "reel-comment",
            size,
            contentType,
            mediaType: "image",
          } });
          const response = await expoFetch(upload.uploadURL, {
            method: "PUT",
            headers: { "Content-Type": contentType },
            body: file as unknown as BodyInit,
          });
          if (!response.ok) throw new Error("The photo could not be uploaded. Try again.");
          mediaId = upload.mediaId;
          uploadedCommentPhoto.current = { uri: selectedPhoto.uri, mediaId };
        }
        setCommentPhotoBusy(false);
      }
      const comment = await createComment.mutateAsync({
        reelId: reel.id,
        data: { ...(content ? { content } : {}), ...(mediaId ? { mediaId } : {}) },
      });
      queryClient.setQueryData(getGetReelCommentsQueryKey(reel.id), (current: typeof commentsQuery.data) => [...(current ?? []), comment]);
      queryClient.setQueryData<Reel>(getGetReelQueryKey(reel.id), (current) => current ? { ...current, commentCount: current.commentCount + 1 } : current);
      setCommentDraft("");
      setCommentPhoto(null);
      uploadedCommentPhoto.current = null;
      refreshReelLists(reel.creatorId);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Your comment did not post. Try again.");
    } finally {
      setCommentPhotoBusy(false);
    }
  }

  async function pickCommentPhoto() {
    if (commentPhotoBusy || createComment.isPending) return;
    setActionError("");
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setActionError("Allow photo access to attach a photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const size = asset.fileSize ?? new File(asset.uri).size;
    if (size <= 0 || size > 15 * 1024 * 1024) {
      setActionError("Choose a photo smaller than 15 MB.");
      return;
    }
    setCommentPhoto(asset);
    uploadedCommentPhoto.current = null;
  }

  function addToCommentDraft(value: string) {
    setCommentDraft((current) => `${current}${current && !current.endsWith(" ") ? " " : ""}${value}`);
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
      const message = `${reel.caption || `${reel.creatorName} on MyAgeBeauty Reels`}\n\n${url}`;
      const result = await Share.share(
        { title: `${reel.creatorName} on Reels`, message, url },
        { dialogTitle: "Send to" },
      );
      if (result.action !== Share.sharedAction) return;
      recordCompletedShare(reel, "apps");
    } catch {
      setActionError("Could not open the share menu. Try again.");
    } finally {
      externalSharePending.current = false;
    }
  }

  async function copyReelLink() {
    const reel = reelQuery.data;
    if (!reel) return;
    setShareError("");
    const origin = (process.env.EXPO_PUBLIC_WEB_URL
      || (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "https://myage.beauty")
    ).replace(/\/+$/, "");
    try {
      await Clipboard.setStringAsync(`${origin}/reels/${reel.id}`);
      setShareVisible(false);
    } catch {
      setShareError("Could not copy the Reel link.");
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
      const message = `${reel.caption || `${reel.creatorName} on MyAgeBeauty Reels`}\n\n${url}`;
      const encodedUrl = encodeURIComponent(url);
      const encodedMessage = encodeURIComponent(message);
      const encodedSubject = encodeURIComponent(`${reel.creatorName} on MyAgeBeauty Reels`);
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

  const shareChats = (matches.data ?? []).filter((match) => !match.blockedByMe && !match.blockedMe && match.profile.id !== userId);

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
    if (!reel || !reel.canDownload || !token || !domain || downloadPending) return;
    setDownloadPending(true);
    try {
      const url = `https://${domain}${getDownloadReelUrl(reel.id)}`;
      const fileName = `vibeswipes-reel-${reel.id}${reel.mediaType === "slides" ? "-photos.zip" : ".mp4"}`;
      const file = await File.downloadFileAsync(url, new File(Paths.document, fileName), { headers: { Authorization: `Bearer ${token}` }, idempotent: true });
      setShareVisible(false);
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
                directionalLockEnabled
                bounces={false}
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
                <ReelActionIcon name="like" filled={reelQuery.data.likedByMe} foreground={colors.foreground} activeColor={colors.primary} cutoutColor={colors.background} />
                <Text style={styles.actionCount}>{formatReelCount(reelQuery.data.likeCount)}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Comments, ${reelQuery.data.commentCount}`}
                testID="button-comments-reel"
                onPress={openComments}
                style={styles.actionButton}
              >
                <ReelActionIcon name="comment" foreground={colors.foreground} activeColor={colors.primary} cutoutColor={colors.background} />
                <Text style={styles.actionCount}>{formatReelCount(reelQuery.data.commentCount)}</Text>
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
                <ReelActionIcon name="save" filled={reelQuery.data.savedByMe} foreground={colors.foreground} activeColor={colors.primary} cutoutColor={colors.background} />
                <Text style={styles.actionCount}>{formatReelCount(reelQuery.data.saveCount)}</Text>
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
                <ReelActionIcon name="share" foreground={colors.foreground} activeColor={colors.primary} cutoutColor={colors.background} />
                <Text style={styles.actionCount}>{formatReelCount(reelQuery.data.shareCount)}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
        {reelQuery.data ? (
          <View style={styles.caption}>
            <View style={styles.creatorRow}>
              <LinearGradient colors={["#FFFFFF", "#777777"]} style={styles.creatorAvatarRing}>
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
            {soundtrack ? <View style={styles.soundtrackCredit}>
              <Feather name="music" size={14} color={colors.primary}/>
              <Pressable accessibilityRole="link" accessibilityLabel={`Music source: ${soundtrack.title} by ${soundtrack.artist}`} onPress={() => void Linking.openURL(soundtrack.sourceUrl).catch(() => undefined)} style={styles.soundtrackTitle}>
                <Text numberOfLines={1} style={[styles.soundtrackText, { color: colors.foreground }]}>{soundtrack.title} · {soundtrack.artist}</Text>
              </Pressable>
              <Pressable accessibilityRole="link" accessibilityLabel={`Open ${soundtrack.license} license`} onPress={() => void Linking.openURL(soundtrack.licenseUrl).catch(() => undefined)}>
                <Text style={[styles.soundtrackLicense, { color: colors.mutedForeground }]}>{soundtrack.license}</Text>
              </Pressable>
            </View> : null}
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
            <View style={[styles.shareHeading, styles.sendToHeading]}>
              <Text style={[styles.shareTitle, styles.sendToTitle, { color: colors.foreground }]}>Send to</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setShareVisible(false)} style={[styles.closeShare, styles.sendToClose]}>
                <Feather name="x" size={20} color={colors.foreground} />
              </Pressable>
            </View>
            {shareError ? <Text accessibilityRole="alert" style={[styles.shareError, { color: colors.destructive }]}>{shareError}</Text> : null}
            {matches.isLoading ? (
              <ActivityIndicator color={colors.primary} style={styles.shareLoading} />
            ) : matches.isError ? (
              <Pressable accessibilityRole="button" onPress={() => void matches.refetch()} style={styles.shareEmpty}>
                <Text style={[styles.shareEmptyText, { color: colors.mutedForeground }]}>Chats could not load. Tap to retry.</Text>
              </Pressable>
            ) : !shareChats.length ? (
              <Text testID="text-no-share-chats" style={[styles.shareEmptyText, { color: colors.mutedForeground }]}>Your matches will appear here.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shareList} contentContainerStyle={styles.shareRecipientRow} keyboardShouldPersistTaps="handled" accessibilityLabel="Send to a match">
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
                      style={[styles.shareRecipient, sent && styles.shareRecipientSent]}
                    >
                      <View style={styles.shareRecipientAvatarWrap}>
                        <ProfileAvatar profile={match.profile} size={56} />
                        <View style={[styles.shareRecipientSendMark, { backgroundColor: colors.primary }]}>
                          {pending ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : sent ? <Feather name="check" size={12} color={colors.primaryForeground} /> : <Feather name="send" size={11} color={colors.primaryForeground} />}
                        </View>
                      </View>
                      <Text numberOfLines={1} style={[styles.shareRecipientName, { color: colors.foreground }]}>{match.profile.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
            <View style={styles.shareDestinationRow}>
              {reelQuery.data && !reelQuery.data.isOwner ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={reelQuery.data.repostedByMe ? "Remove repost" : "Repost Reel"}
                  accessibilityState={{ selected: reelQuery.data.repostedByMe, disabled: repostReel.isPending || removeRepost.isPending }}
                  testID="button-toggle-repost"
                  disabled={repostReel.isPending || removeRepost.isPending}
                  onPress={() => void toggleRepost()}
                  style={styles.shareDestination}
                >
                  <View style={[styles.shareDestinationIcon, { backgroundColor: colors.profileChip }]}>
                    {repostReel.isPending || removeRepost.isPending
                      ? <ActivityIndicator size="small" color={colors.primary} />
                      : <Feather name="repeat" size={21} color={colors.profileEdit} />}
                  </View>
                  <Text style={[styles.shareDestinationLabel, { color: colors.foreground }]}>
                    {reelQuery.data.repostedByMe ? "Remove repost" : "Repost"}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable accessibilityRole="button" accessibilityLabel="Copy Reel link" testID="button-copy-reel-link" onPress={() => void copyReelLink()} style={styles.shareDestination}>
                <View style={[styles.shareDestinationIcon, { backgroundColor: colors.primary }]}><Feather name="link" size={21} color={colors.primaryForeground} /></View>
                <Text style={[styles.shareDestinationLabel, { color: colors.foreground }]}>Copy link</Text>
              </Pressable>
              {reelQuery.data?.canDownload ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Download Reel"
                  testID="button-download-reel-from-share"
                  disabled={downloadPending}
                  onPress={() => void downloadCurrentReel()}
                  style={styles.shareDestination}
                >
                  <View style={[styles.shareDestinationIcon, { backgroundColor: colors.primary }]}>
                    {downloadPending ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <Feather name="download" size={21} color={colors.primaryForeground} />}
                  </View>
                  <Text style={[styles.shareDestinationLabel, { color: colors.foreground }]}>Download</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={Platform.OS === "android" && androidShareTargetsVisible ? "Hide share apps" : "Share to apps"}
                testID="button-share-to-apps"
                onPress={() => Platform.OS === "android" ? setAndroidShareTargetsVisible((visible) => !visible) : void shareToApps()}
                style={styles.shareDestination}
              >
                <View style={[styles.shareDestinationIcon, { backgroundColor: colors.primary }]}><Feather name="share-2" size={21} color={colors.primaryForeground} /></View>
                <Text style={[styles.shareDestinationLabel, { color: colors.foreground }]}>More apps</Text>
              </Pressable>
            </View>
            {Platform.OS === "android" && androidShareTargetsVisible ? (
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
          </View>
        </View>
      </Modal>
      <Modal transparent visible={moreVisible} animationType="fade" onRequestClose={()=>setMoreVisible(false)}>
        <View style={styles.moreBackdrop}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close Reel options" onPress={()=>setMoreVisible(false)} style={StyleSheet.absoluteFill}/>
          <View style={[styles.moreSheet,{backgroundColor:colors.card,borderColor:colors.border}]}>
            <View style={styles.shareHeading}><Text style={[styles.shareTitle,{color:colors.foreground}]}>Reel options</Text><Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={()=>setMoreVisible(false)} style={styles.closeShare}><Feather name="x" size={20} color={colors.foreground}/></Pressable></View>
            {reelQuery.data?.canDownload ? <Pressable accessibilityRole="button" testID="button-download-reel" disabled={downloadPending} onPress={()=>void downloadCurrentReel()} style={[styles.moreAction,{borderColor:colors.border}]}><Feather name="download" size={18} color={colors.primary}/><Text style={[styles.moreActionText,{color:colors.foreground}]}>{downloadPending?"Downloading…":reelQuery.data.mediaType==="slides"?"Download photos":"Download Reel"}</Text></Pressable>:null}
            {reelQuery.data && !reelQuery.data.isOwner ? <Pressable accessibilityRole="button" testID="button-not-interested-reel" disabled={markNotInterested.isPending} onPress={()=>void markCurrentNotInterested()} style={[styles.moreAction,{borderColor:colors.border}]}><Feather name="eye-off" size={18} color={colors.primary}/><Text style={[styles.moreActionText,{color:colors.foreground}]}>Not interested</Text></Pressable>:null}
            {reelQuery.data?.isOwner && !reelQuery.data.canDownload ? <Text style={[styles.shareError,{color:colors.mutedForeground}]}>Downloads are turned off for your Reels.</Text>:null}
          </View>
        </View>
      </Modal>
      <Modal transparent visible={commentsVisible} animationType="slide" onRequestClose={() => setCommentsVisible(false)}>
        <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={0} style={styles.commentBackdrop}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close comments" onPress={() => setCommentsVisible(false)} style={StyleSheet.absoluteFill} />
          <View style={[styles.commentSheet, { backgroundColor: colors.card, paddingBottom: keyboardVisible ? 4 : Math.max(insets.bottom, 12) }]}>
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
                      {comment.content ? <Text style={[styles.commentText, { color: colors.mutedForeground }]}>{comment.content}</Text> : null}
                      {comment.mediaReference && token ? <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Open photo comment"
                        testID="button-open-reel-comment-photo"
                        onPress={() => {
                          Keyboard.dismiss();
                          setCommentPhotoViewer(comment.mediaReference);
                        }}
                        style={styles.commentPhotoButton}
                      >
                        <CachedImage
                          source={profileImagePreviewSource(comment.mediaReference, token)}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          accessibilityLabel="Photo comment"
                          style={styles.commentPhoto}
                        />
                      </Pressable> : null}
                    </View>
                  </View>
                ))}
                {!commentsQuery.data?.length ? <Text style={[styles.shareEmptyText, { color: colors.mutedForeground }]}>{reelQuery.data?.commentCount ? "Comments aren’t available right now." : "No comments yet. Say something kind."}</Text> : null}
              </ScrollView>
            )}
            {actionError ? <Text accessibilityRole="alert" style={[styles.shareError, { color: colors.destructive }]}>{actionError}</Text> : null}
            {reelQuery.data?.canComment !== false ? <View style={styles.commentComposer}>
              <View style={styles.commentReactions} accessibilityLabel="Comment reactions">
                {["😂", "🤣", "🥰", "😁", "😳", "😉"].map((emoji) => (
                  <Pressable key={emoji} accessibilityRole="button" accessibilityLabel={`Add ${emoji}`} onPress={() => addToCommentDraft(emoji)} style={styles.commentReaction}>
                    <Text style={styles.commentReactionText}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>
                {commentPhoto ? <View style={styles.commentPhotoPreview}>
                  <CachedImage source={{ uri: commentPhoto.uri }} contentFit="cover" style={StyleSheet.absoluteFill} accessibilityLabel="Selected comment photo" />
                  <Pressable accessibilityRole="button" accessibilityLabel="Remove photo" disabled={commentPhotoBusy || createComment.isPending} onPress={() => { setCommentPhoto(null); uploadedCommentPhoto.current = null; }} style={styles.commentPhotoRemove}>
                    <Feather name="x" size={14} color="#fff" />
                  </Pressable>
                </View> : null}
              <View style={styles.commentComposeRow}>
                <View style={styles.commentAvatar}><ProfileAvatar profile={{ name: me.data?.name ?? "Your profile", photos: me.data?.photos ?? [] } as never} size={36} /></View>
                <View style={[styles.commentInputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
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
                  <View style={styles.commentTools}>
                    <Pressable accessibilityRole="button" accessibilityLabel="Add photo" testID="button-add-reel-comment-photo" disabled={commentPhotoBusy || createComment.isPending} onPress={() => void pickCommentPhoto()} style={styles.commentTool}>
                      {commentPhotoBusy && !commentPhoto ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name="image" size={20} color={colors.foreground} />}
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel="Add emoji" onPress={() => addToCommentDraft("😊")} style={styles.commentTool}><Feather name="smile" size={20} color={colors.foreground} /></Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel="Mention someone" onPress={() => addToCommentDraft("@")} style={styles.commentTool}><Feather name="at-sign" size={20} color={colors.foreground} /></Pressable>
                  </View>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Post comment" testID="button-post-reel-comment" disabled={(!commentDraft.trim() && !commentPhoto) || createComment.isPending || commentPhotoBusy} onPress={() => void postComment()} style={[styles.commentSend, { backgroundColor: colors.primary }, ((!commentDraft.trim() && !commentPhoto) || createComment.isPending || commentPhotoBusy) && styles.disabled]}>
                  {createComment.isPending || commentPhotoBusy ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <Feather name="arrow-up" size={19} color={colors.primaryForeground} />}
                </Pressable>
              </View>
            </View> : <Text style={[styles.commentUnavailable,{color:colors.mutedForeground}]}>The creator has turned off new comments.</Text>}
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal transparent visible={Boolean(commentPhotoViewer)} animationType="fade" onRequestClose={() => setCommentPhotoViewer(null)} statusBarTranslucent>
        <View style={[styles.commentPhotoViewer, { backgroundColor: colors.background }]}>
          {commentPhotoViewer && token ? <CachedImage
            source={profileImageSource(commentPhotoViewer, token)}
            contentFit="contain"
            cachePolicy="memory-disk"
            accessibilityLabel="Full-size photo comment"
            style={styles.commentPhotoViewerImage}
          /> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close photo"
            testID="button-close-reel-comment-photo"
            onPress={() => setCommentPhotoViewer(null)}
            style={[styles.commentPhotoViewerClose, { top: Math.max(insets.top, 12) }]}
          >
            <Feather name="x" size={25} color={colors.foreground} />
          </Pressable>
        </View>
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
  actionRail: { position: "absolute", right: 12, bottom: 24, alignItems: "center", gap: 20 },
  actionButton: { minWidth: 44, minHeight: 54, alignItems: "center", justifyContent: "flex-start", gap: 4 },
  actionCount: { color: "#fff", fontSize: 14, fontWeight: "700", textShadowColor: "#000", textShadowRadius: 5 },
  caption: { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  creatorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  creatorAvatarRing: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, padding: 2 },
  creatorDetails: { flex: 1, minWidth: 0, gap: 3 },
  creator: { fontSize: 15, fontWeight: "700" },
  creatorLocation: { fontSize: 12 },
  captionText: { fontSize: 14, lineHeight: 20 },
  soundtrackCredit: { maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: 7, marginTop: 8, alignSelf: "flex-start", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", borderRadius: 18, backgroundColor: "rgba(12,10,15,0.72)", paddingHorizontal: 10, paddingVertical: 7 },
  soundtrackTitle: { minWidth: 0, flex: 1 },
  soundtrackText: { fontSize: 11, fontWeight: "700" },
  soundtrackLicense: { fontSize: 10, fontWeight: "700", textDecorationLine: "underline" },
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
  sendToHeading: { position: "relative", justifyContent: "center", minHeight: 40 },
  sendToTitle: { textAlign: "center" },
  sendToClose: { position: "absolute", right: 0 },
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
  shareList: { minHeight: 100, maxHeight: 104, marginBottom: 4 },
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
  commentPhotoButton: { width: 132, height: 180, maxWidth: "100%", marginTop: 5, overflow: "hidden", borderRadius: 12, backgroundColor: "rgba(255,255,255,0.08)" },
  commentPhoto: { width: "100%", height: "100%" },
  commentPhotoViewer: { flex: 1, alignItems: "center", justifyContent: "center" },
  commentPhotoViewerImage: { width: "100%", height: "100%" },
  commentPhotoViewerClose: { position: "absolute", right: 14, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  commentComposer: { paddingTop: 4, paddingBottom: 4 },
  commentReactions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 6, paddingBottom: 6 },
  commentReaction: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  commentReactionText: { fontSize: 23, lineHeight: 28 },
  commentPhotoPreview: { width: 72, height: 72, marginLeft: 44, marginBottom: 7, overflow: "hidden", borderRadius: 12, backgroundColor: "rgba(255,255,255,0.08)" },
  commentPhotoRemove: { position: "absolute", top: 4, right: 4, width: 23, height: 23, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "rgba(16,12,18,0.82)" },
  commentComposeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  commentAvatar: { width: 36, height: 36 },
  commentInputWrap: { minWidth: 0, flex: 1, borderWidth: 1, borderRadius: 22, paddingHorizontal: 12, paddingTop: 5, paddingBottom: 3 },
  commentTools: { minHeight: 26, flexDirection: "row", alignItems: "center", gap: 9 },
  commentTool: { width: 26, height: 26, alignItems: "center", justifyContent: "center" },
  commentUnavailable: { textAlign: "center", paddingVertical: 14, fontSize: 12 },
  commentInput: { minWidth: 0, paddingVertical: 3, fontSize: 16, lineHeight: 22 },
  commentSend: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  slideCount: { position: "absolute", top: 12, right: 12, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 10, paddingVertical: 5 },
  slideCountText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  slideDots: { position: "absolute", left: 0, right: 0, bottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  slideDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.48)" },
  slideDotActive: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#fff" },
  disabled: { opacity: 0.45 },
  shareRecipientRow: { alignItems: "flex-start", gap: 14, paddingHorizontal: 2 },
  shareRecipient: { width: 64, minHeight: 88, alignItems: "center", gap: 5, paddingHorizontal: 0 },
  shareRecipientSent: { opacity: 0.76 },
  shareRecipientAvatarWrap: { position: "relative", width: 56, height: 56 },
  shareRecipientSendMark: { position: "absolute", right: -2, bottom: -2, width: 21, height: 21, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#111111", borderRadius: 11 },
  shareRecipientName: { maxWidth: 64, fontSize: 11, fontWeight: "700", textAlign: "center" },
  shareDestinationRow: { flexDirection: "row", gap: 22, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.12)", marginHorizontal: -18, marginTop: 8, paddingHorizontal: 18, paddingTop: 14 },
  shareDestination: { minWidth: 66, alignItems: "center", gap: 6 },
  shareDestinationIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 24 },
  shareDestinationLabel: { fontSize: 11, fontWeight: "700" },
});
