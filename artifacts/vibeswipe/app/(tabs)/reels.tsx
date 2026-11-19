import {
  getGetReelsFeedQueryKey,
  getReelsFeed,
  useLikeReel,
  useRecordReelView,
  useSaveReel,
  useUnlikeReel,
  useUnsaveReel,
  type Reel,
} from "@workspace/api-client-react";
import { useAuth } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import { Image as CachedImage } from "expo-image";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { LinearGradient } from "expo-linear-gradient";
import { VideoView, useVideoPlayer } from "expo-video";
import { router, useIsFocused } from "expo-router";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useColors } from "@/hooks/useColors";
import { mediaUri } from "@/lib/media";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const FEED_PARAMS = { feed: "reels" as const, limit: 12 };
const PRELOAD_AHEAD = 2;
type VisibleToken = { index?: number; isViewable: boolean };

function compactCount(value: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(value);
}

type ReelPatch = Partial<Reel>;

function NativeReelCard({
  reel,
  width,
  height,
  token,
  isActive,
  shouldLoad,
  onLike,
  onComment,
  onSave,
  onShare,
  onCreatorPress,
  actionError,
}: {
  reel: Reel;
  width: number;
  height: number;
  token: string | null;
  isActive: boolean;
  shouldLoad: boolean;
  onLike: (reel: Reel) => void;
  onComment: (reel: Reel) => void;
  onSave: (reel: Reel) => void;
  onShare: (reel: Reel) => void;
  onCreatorPress: (reel: Reel) => void;
  actionError: string;
}) {
  const colors = useColors();
  const slideshow = reel.mediaType === "slides" && reel.slideReferences.length > 0;
  const [slideIndex, setSlideIndex] = useState(0);
  const [videoFailed, setVideoFailed] = useState(false);
  const viewRecorded = useRef(false);
  const activeRef = useRef(isActive);
  activeRef.current = isActive;
  const recordView = useRecordReelView();

  const videoUrl = !slideshow && shouldLoad ? mediaUri(reel.videoReference) : null;
  const videoSource = useMemo(
    () =>
      videoUrl && token
        ? {
            uri: videoUrl,
            headers: { Authorization: `Bearer ${token}` },
            // The feed endpoint only returns public Reels, so these can be safely
            // cached by the device for repeat playback.
            useCaching: reel.audience === "public",
          }
        : null,
    [reel.audience, token, videoUrl],
  );
  const player = useVideoPlayer(videoSource, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.showNowPlayingNotification = false;
  });

  const soundtrack = reel.soundtrack;
  const soundtrackSource = useMemo(
    () => (isActive && soundtrack ? { uri: soundtrack.audioUrl, name: soundtrack.title } : null),
    [isActive, soundtrack?.audioUrl, soundtrack?.title],
  );
  const soundtrackPlayer = useAudioPlayer(soundtrackSource, { updateInterval: 1000 });
  const soundtrackStatus = useAudioPlayerStatus(soundtrackPlayer);

  useEffect(() => {
    if (slideshow && isActive && !reel.isOwner && !viewRecorded.current) {
      viewRecorded.current = true;
      recordView.mutate({ reelId: reel.id });
    }
  }, [isActive, recordView.mutate, reel.id, reel.isOwner, slideshow]);

  useEffect(() => {
    if (!slideshow || !token) return;
    const neighbors = [slideIndex - 1, slideIndex + 1, slideIndex + 2]
      .filter((position) => position >= 0 && position < reel.slideReferences.length)
      .map((position) => mediaUri(reel.slideReferences[position]))
      .filter((uri): uri is string => Boolean(uri));
    if (!neighbors.length) return;
    void CachedImage.prefetch(neighbors, {
      cachePolicy: "memory-disk",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
  }, [reel.slideReferences, slideIndex, slideshow, token]);

  useEffect(() => {
    setVideoFailed(false);
    viewRecorded.current = false;
    setSlideIndex(0);
  }, [reel.id]);

  useEffect(() => {
    player.loop = true;
    player.muted = !isActive || Boolean(soundtrack);
    if (!isActive || slideshow || !videoSource) {
      player.pause();
      return;
    }

    const markViewed = () => {
      if (activeRef.current && !reel.isOwner && !viewRecorded.current) {
        viewRecorded.current = true;
        recordView.mutate({ reelId: reel.id });
      }
    };
    const playWhenReady = () => {
      if (activeRef.current && player.status === "readyToPlay") {
        player.play();
        markViewed();
      }
    };
    const subscription = player.addListener("statusChange", (event) => {
      if (event.status === "error") setVideoFailed(true);
      if (event.status === "readyToPlay") playWhenReady();
    });
    if (player.status === "error") setVideoFailed(true);
    playWhenReady();

    return () => {
      subscription.remove();
      player.pause();
    };
  }, [isActive, player, recordView.mutate, reel.id, reel.isOwner, slideshow, soundtrack, videoSource]);

  useEffect(() => {
    if (!isActive || !soundtrack || !soundtrackStatus.isLoaded) {
      soundtrackPlayer.pause();
      return;
    }
    void setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
    soundtrackPlayer.loop = true;
    soundtrackPlayer.volume = 1;
    soundtrackPlayer.play();
    return () => soundtrackPlayer.pause();
  }, [isActive, soundtrack?.id, soundtrackPlayer, soundtrackStatus.isLoaded]);

  const actions = [
    {
      key: "like",
      icon: "heart" as const,
      count: reel.likeCount,
      active: reel.likedByMe,
      onPress: () => onLike(reel),
      label: reel.likedByMe ? "Unlike Reel" : "Like Reel",
      testID: "native-reel-like",
    },
    {
      key: "comment",
      icon: "message-circle" as const,
      count: reel.commentCount,
      active: false,
      onPress: () => onComment(reel),
      label: "Comments",
      testID: "native-reel-comments",
    },
    {
      key: "save",
      icon: "bookmark" as const,
      count: reel.saveCount,
      active: reel.savedByMe,
      onPress: () => onSave(reel),
      label: reel.savedByMe ? "Remove saved Reel" : "Save Reel",
      testID: "native-reel-save",
    },
    {
      key: "share",
      icon: "corner-up-right" as const,
      count: reel.shareCount,
      active: false,
      onPress: () => onShare(reel),
      label: "Share Reel",
      testID: "native-reel-share",
    },
  ];

  return (
    <View style={[styles.card, { width, height, backgroundColor: colors.discoverBackground }]}>
      {slideshow ? (
        <ScrollView
          horizontal
          pagingEnabled
          directionalLockEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          style={StyleSheet.absoluteFill}
          contentContainerStyle={{ width: width * reel.slideReferences.length }}
          onMomentumScrollEnd={(event) =>
            setSlideIndex(Math.min(
              reel.slideReferences.length - 1,
              Math.round(event.nativeEvent.contentOffset.x / Math.max(1, width)),
            ))
          }
          testID="native-reel-photo-slides"
        >
          {reel.slideReferences.map((reference, position) => {
            const uri = mediaUri(reference);
            return (
              <CachedImage
                key={`${reference}-${position}`}
                source={token && uri ? { uri, headers: { Authorization: `Bearer ${token}` } } : undefined}
                style={{ width, height }}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={0}
                priority={position === slideIndex ? "high" : "normal"}
                accessibilityLabel={`Photo ${position + 1} of ${reel.slideReferences.length}`}
              />
            );
          })}
        </ScrollView>
      ) : videoSource ? (
        <>
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
          />
          {videoFailed ? (
            <View pointerEvents="none" style={styles.videoError}>
              <Text style={styles.videoErrorText}>Video unavailable</Text>
            </View>
          ) : null}
        </>
      ) : null}

      <LinearGradient
        pointerEvents="none"
        colors={["transparent", "rgba(0,0,0,0.28)", "rgba(0,0,0,0.84)"]}
        locations={[0.48, 0.73, 1]}
        style={styles.bottomShade}
      />
      <LinearGradient
        pointerEvents="none"
        colors={["transparent", "rgba(0,0,0,0.24)"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.actionShade}
      />

      <View style={styles.actionRail}>
        {actions.map((action) => (
          <Pressable
            key={action.key}
            accessibilityRole="button"
            accessibilityLabel={`${action.label}, ${compactCount(action.count)}`}
            testID={action.testID}
            onPress={action.onPress}
            style={({ pressed }) => [styles.actionButton, pressed ? styles.actionPressed : null]}
          >
            <Feather
              name={action.icon}
              size={32}
              color={action.active ? colors.primary : colors.discoverForeground}
              strokeWidth={action.active ? 2.2 : 2}
            />
            <Text style={[styles.actionCount, { color: colors.discoverForeground }]}>
              {compactCount(action.count)}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.creatorDetails}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${reel.creatorName}'s profile`}
          testID="native-reel-creator"
          onPress={() => onCreatorPress(reel)}
          style={styles.creatorRow}
        >
          <View style={[styles.avatarRing, { borderColor: colors.primary }]}>
            <ProfileAvatar
              profile={{
                name: reel.creatorName,
                photos: reel.creatorPhoto ? [reel.creatorPhoto] : [],
                isVerified: reel.creatorVerified,
              }}
              size={42}
            />
          </View>
          <View style={styles.creatorCopy}>
            <Text numberOfLines={1} style={[styles.creatorName, { color: colors.discoverForeground }]}>
              {reel.creatorName}
            </Text>
            {reel.creatorLocation ? (
              <Text numberOfLines={1} style={[styles.creatorLocation, { color: colors.discoverMuted }]}>
                {reel.creatorLocation}
              </Text>
            ) : null}
          </View>
        </Pressable>
        {reel.caption ? (
          <Text numberOfLines={3} style={[styles.caption, { color: colors.discoverForeground }]}>
            {reel.caption}
          </Text>
        ) : null}
        {soundtrack ? (
          <View style={styles.soundtrackRow}>
            <Feather name="music" size={14} color={colors.discoverForeground} />
            <Text numberOfLines={1} style={[styles.soundtrackText, { color: colors.discoverForeground }]}>
              {soundtrack.title} · {soundtrack.artist}
            </Text>
          </View>
        ) : null}
        {actionError ? (
          <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.discoverForeground }]}>
            {actionError}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function NativeReelsScreen() {
  const colors = useColors();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const isFocused = useIsFocused();
  const [token, setToken] = useState<string | null>(null);
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const [activeIndex, setActiveIndex] = useState(0);
  const [patches, setPatches] = useState<Record<string, ReelPatch>>({});
  const [actionError, setActionError] = useState<{ reelId: string; message: string } | null>(null);
  const likeReel = useLikeReel();
  const unlikeReel = useUnlikeReel();
  const saveReel = useSaveReel();
  const unsaveReel = useUnsaveReel();

  useEffect(() => {
    let mounted = true;
    void getToken().then((value) => {
      if (mounted) setToken(value);
    }).catch(() => {
      if (mounted) setToken(null);
    });
    return () => {
      mounted = false;
    };
  }, [getToken]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setAppActive(state === "active");
    });
    return () => subscription.remove();
  }, []);

  const feed = useInfiniteQuery({
    queryKey: getGetReelsFeedQueryKey(FEED_PARAMS),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      getReelsFeed(
        { ...FEED_PARAMS, ...(pageParam ? { cursor: pageParam } : {}) },
        { signal },
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isFocused && Boolean(token),
    staleTime: 60_000,
    retry: 1,
  });
  const reels = useMemo(
    () => feed.data?.pages.flatMap((page) => page.items) ?? [],
    [feed.data],
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: VisibleToken[] }) => {
      const visibleIndex = viewableItems.find((item) => item.isViewable && typeof item.index === "number")?.index;
      if (typeof visibleIndex === "number") setActiveIndex(visibleIndex);
    },
  ).current;

  function mergedReel(reel: Reel): Reel {
    return patches[reel.id] ? { ...reel, ...patches[reel.id] } : reel;
  }

  async function toggleLike(reel: Reel) {
    if (likeReel.isPending || unlikeReel.isPending) return;
    const current = mergedReel(reel);
    const wasLiked = current.likedByMe;
    const count = current.likeCount;
    setActionError(null);
    setPatches((previous) => ({
      ...previous,
      [reel.id]: { ...previous[reel.id], likedByMe: !wasLiked, likeCount: Math.max(0, count + (wasLiked ? -1 : 1)) },
    }));
    try {
      const updated = await (wasLiked ? unlikeReel : likeReel).mutateAsync({ reelId: reel.id });
      setPatches((previous) => ({ ...previous, [reel.id]: { ...previous[reel.id], ...updated } }));
      void queryClient.invalidateQueries({ queryKey: getGetReelsFeedQueryKey() });
    } catch {
      setPatches((previous) => ({
        ...previous,
        [reel.id]: { ...previous[reel.id], likedByMe: wasLiked, likeCount: count },
      }));
      setActionError({ reelId: reel.id, message: "Your like did not save." });
    }
  }

  async function toggleSave(reel: Reel) {
    if (saveReel.isPending || unsaveReel.isPending) return;
    const current = mergedReel(reel);
    const wasSaved = current.savedByMe;
    const count = current.saveCount;
    setActionError(null);
    setPatches((previous) => ({
      ...previous,
      [reel.id]: { ...previous[reel.id], savedByMe: !wasSaved, saveCount: Math.max(0, count + (wasSaved ? -1 : 1)) },
    }));
    try {
      const updated = await (wasSaved ? unsaveReel : saveReel).mutateAsync({ reelId: reel.id });
      setPatches((previous) => ({ ...previous, [reel.id]: { ...previous[reel.id], ...updated } }));
      void queryClient.invalidateQueries({ queryKey: getGetReelsFeedQueryKey() });
    } catch {
      setPatches((previous) => ({
        ...previous,
        [reel.id]: { ...previous[reel.id], savedByMe: wasSaved, saveCount: count },
      }));
      setActionError({ reelId: reel.id, message: "Saving did not work." });
    }
  }

  function openComments(reel: Reel) {
    router.push({
      pathname: "/reels/[reelId]",
      params: { reelId: reel.id, returnTo: "/(tabs)/reels", openComments: "1" },
    } as never);
  }

  function openShare(reel: Reel) {
    router.push({
      pathname: "/reels/[reelId]",
      params: { reelId: reel.id, returnTo: "/(tabs)/reels", openShare: "1" },
    } as never);
  }

  function openCreator(reel: Reel) {
    router.push({ pathname: "/profile/[profileId]", params: { profileId: reel.creatorId } });
  }

  function loadNextPage() {
    if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
  }

  const emptyState = feed.isError ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Retry loading Reels"
      testID="native-reels-retry"
      onPress={() => void feed.refetch()}
      style={[styles.emptyState, { height, paddingTop: insets.top }]}
    >
      <Text style={[styles.emptyText, { color: colors.discoverForeground }]}>Couldn’t load Reels. Tap to retry.</Text>
    </Pressable>
  ) : feed.data ? (
    <View style={[styles.emptyState, { height, paddingTop: insets.top }]}>
      <Text style={[styles.emptyText, { color: colors.discoverForeground }]}>No Reels yet.</Text>
    </View>
  ) : undefined;

  return (
    <View style={[styles.screen, { backgroundColor: colors.discoverBackground }]}>
      <FlatList
        testID="native-reels-feed"
        data={reels}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <NativeReelCard
            reel={mergedReel(item)}
            width={width}
            height={height}
            token={token}
            isActive={index === activeIndex && isFocused && appActive}
            shouldLoad={index >= activeIndex && index <= activeIndex + PRELOAD_AHEAD}
            onLike={(value) => void toggleLike(value)}
            onComment={openComments}
            onSave={(value) => void toggleSave(value)}
            onShare={openShare}
            onCreatorPress={openCreator}
            actionError={actionError?.reelId === item.id ? actionError.message : ""}
          />
        )}
        extraData={{ activeIndex, patches, isFocused, appActive, actionError }}
        pagingEnabled
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        scrollEnabled={reels.length > 0}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
        removeClippedSubviews={false}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        onEndReached={loadNextPage}
        onEndReachedThreshold={1.5}
        getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
        ListEmptyComponent={emptyState}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  card: { overflow: "hidden" },
  bottomShade: {
    ...StyleSheet.absoluteFill,
  },
  actionShade: {
    position: "absolute",
    right: 0,
    top: "40%",
    bottom: 126,
    width: 92,
  },
  actionRail: {
    position: "absolute",
    right: 13,
    bottom: 164,
    alignItems: "center",
    gap: 19,
  },
  actionButton: {
    minWidth: 46,
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  actionPressed: { opacity: 0.75, transform: [{ scale: 0.94 }] },
  actionCount: {
    fontSize: 13,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
  },
  creatorDetails: {
    position: "absolute",
    left: 16,
    right: 82,
    bottom: 101,
    gap: 9,
  },
  creatorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatarRing: {
    width: 50,
    height: 50,
    borderWidth: 2,
    borderRadius: 25,
    padding: 2,
  },
  creatorCopy: { flex: 1, gap: 2 },
  creatorName: {
    fontSize: 16,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
  },
  creatorLocation: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 12,
    textShadowColor: "rgba(0,0,0,0.75)",
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
  },
  caption: {
    fontSize: 14,
    lineHeight: 20,
    textShadowColor: "rgba(0,0,0,0.85)",
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
  },
  soundtrackRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  soundtrackText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
  },
  errorText: {
    fontSize: 12,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowRadius: 3,
  },
  videoError: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  videoErrorText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyState: { alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  emptyText: { fontSize: 15, fontWeight: "600", textAlign: "center" },
});
