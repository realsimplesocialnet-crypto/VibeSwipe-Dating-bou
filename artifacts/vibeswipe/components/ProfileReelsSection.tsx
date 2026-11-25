import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from "expo-video";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import {
  getGetMyReelsQueryKey,
  getGetProfileReelsQueryKey,
  getGetSavedReelsQueryKey,
  getMyReels,
  getProfileReels,
  getSavedReels,
  type Reel,
} from "@workspace/api-client-react";
import { usePremiumColors } from "@/hooks/useColors";
import { mediaUri } from "@/lib/media";

type MediaTab = "reels" | "saved";

export function ProfileReelsSection({
  profileId,
  returnTo,
  own = false,
}: {
  profileId: string;
  returnTo: string;
  own?: boolean;
}) {
  const colors = usePremiumColors();
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [sectionWidth, setSectionWidth] = useState(0);
  const [activeTab, setActiveTab] = useState<MediaTab>("reels");
  const myReels = useInfiniteQuery({
    queryKey: getGetMyReelsQueryKey(),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => getMyReels(pageParam ? { cursor: pageParam } : undefined, { signal }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: own && activeTab === "reels",
    staleTime: 30_000,
  });
  const profileReels = useInfiniteQuery({
    queryKey: getGetProfileReelsQueryKey({ profileId }),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => getProfileReels({ profileId, ...(pageParam ? { cursor: pageParam } : {}) }, { signal }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: Boolean(profileId) && !own && activeTab === "reels",
    staleTime: 30_000,
  });
  const saved = useInfiniteQuery({
    queryKey: getGetSavedReelsQueryKey(),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => getSavedReels(pageParam ? { cursor: pageParam } : undefined, { signal }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: own && activeTab === "saved",
    staleTime: 30_000,
  });
  const current = activeTab === "saved" ? saved : own ? myReels : profileReels;
  const allItems: Reel[] = current.data?.pages.flatMap((page) => page.items) ?? [];
  const items = activeTab === "reels"
    ? allItems.filter((item) => item.mediaType !== "slides")
    : allItems;
  const tileWidth = Math.max(72, Math.floor((sectionWidth - 8) / 3));
  const tabs: { id: MediaTab; label: string; icon: "grid" | "video" | "bookmark" }[] = [
    { id: "reels", label: "Reels", icon: "video" },
    ...(own ? [{ id: "saved" as const, label: "Saved", icon: "bookmark" as const }] : []),
  ];

  useEffect(() => {
    let active = true;
    void getToken().then((value) => {
      if (active) setToken(value);
    });
    return () => {
      active = false;
    };
  }, [getToken]);

  function openReel(reel: Reel) {
    router.push({ pathname: "/reels/[reelId]", params: { reelId: reel.id, returnTo } });
  }

  return (
    <View
      testID={own ? "profile-media-tabs" : "public-profile-media-tabs"}
      onLayout={(event) => setSectionWidth(event.nativeEvent.layout.width)}
      style={styles.section}
    >
      <View style={[styles.tabs, { borderBottomColor: colors.profileRule }]} accessibilityRole="tablist" accessibilityLabel="Profile Reels">
        {tabs.map((tab) => (
          <Pressable
            key={tab.id}
            testID={`profile-media-tab-${tab.id}`}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: activeTab === tab.id }}
            onPress={() => setActiveTab(tab.id)}
            style={[styles.tab, activeTab === tab.id && { borderBottomColor: colors.profileEdit }]}
          >
            <Feather name={tab.icon} size={19} color={activeTab === tab.id ? colors.profileEdit : colors.profileMuted} />
            <Text style={[styles.tabLabel, { color: activeTab === tab.id ? colors.profileLabel : colors.profileMuted }]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>

      {current.isLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} accessibilityLabel={`Loading ${activeTab}`} />
      ) : current.isError && !items.length ? (
        <Pressable
          testID="button-retry-profile-videos"
          accessibilityRole="button"
          onPress={() => void current.refetch()}
          style={styles.state}
        >
          <Feather name="alert-circle" size={18} color={colors.profileMuted} />
          <Text style={[styles.empty, { color: colors.profileMuted }]}>
            "Posts could not load. Tap to retry."
          </Text>
        </Pressable>
      ) : items.length ? (
        <>
          <View style={styles.grid} testID={`profile-${activeTab}-grid`}>
            {items.map((item) => (
              <ReelThumbnail
                key={`${activeTab}-${item.id}`}
                reel={item}
                token={token}
                tileWidth={tileWidth}
                onPress={() => openReel(item)}
              />
            ))}
          </View>
        </>
      ) : (
        <View style={styles.state} testID={`empty-profile-${activeTab}`}>
          <Text style={[styles.empty, { color: colors.profileMuted }]}>{emptyCopy(activeTab, own)}</Text>
        </View>
      )}
      {current.hasNextPage ? (
        <Pressable
          testID={`button-load-more-profile-${activeTab}`}
          accessibilityRole="button"
          disabled={current.isFetchingNextPage}
          onPress={() => void current.fetchNextPage()}
          style={[styles.loadMore, { borderColor: colors.border }]}
        >
          {current.isFetchingNextPage ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={{ color: colors.profileEdit, fontWeight: "700", fontSize: 13 }}>
              {items.length ? (current.isFetchNextPageError ? "Try again" : "Load more") : "Find older posts"}
            </Text>
          )}
        </Pressable>
      ) : null}
      {current.isFetchNextPageError ? (
        <Text accessibilityRole="alert" style={[styles.pageError, { color: colors.destructive }]}>More posts could not load.</Text>
      ) : null}
    </View>
  );
}

function ReelThumbnail({
  reel,
  token,
  tileWidth,
  onPress,
}: {
  reel: Reel;
  token: string | null;
  tileWidth: number;
  onPress: () => void;
}) {
  const colors = usePremiumColors();
  const viewCount = Number(reel.viewCount ?? 0);
  const viewLabel = `${formatViewCount(viewCount)} ${viewCount === 1 ? "view" : "views"}`;
  const slideshow = reel.mediaType === "slides" && reel.slideReferences.length > 0;
  const uri = mediaUri(slideshow ? reel.slideReferences[0] : reel.videoReference);
  const source = useMemo(
    () => uri && token && !slideshow ? { uri, headers: { Authorization: `Bearer ${token}` } } : null,
    [token, uri, slideshow],
  );
  const imageSource = slideshow && uri && token ? { uri, headers: { Authorization: `Bearer ${token}` } } : null;
  const player = useVideoPlayer(source, (instance) => {
    instance.muted = true;
    instance.loop = false;
  });

  return (
    <Pressable
      testID={`profile-reel-${reel.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${slideshow ? "View post" : "Play Reel"}${reel.caption ? `: ${reel.caption}` : ""}, ${viewLabel}`}
      onPress={onPress}
      style={({ pressed }) => [styles.thumbnail, { width: tileWidth, opacity: pressed ? 0.82 : 1 }]}
    >
      <View style={styles.videoFrame}>
        {imageSource ? (
          <Image source={imageSource} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : source ? (
          <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} pointerEvents="none" />
        ) : (
          <View style={[styles.videoFallback, { backgroundColor: colors.profileChip }]}><Feather name="film" size={21} color={colors.profileMuted} /></View>
        )}
        <View pointerEvents="none" style={styles.playBadge}>
          <Feather name="play" size={14} color="#fff" />
        </View>
        <View pointerEvents="none" style={styles.viewCount}>
          <Feather name="eye" size={10} color="#fff" />
          <Text numberOfLines={1} style={styles.viewCountText} testID={`text-profile-reel-views-${reel.id}`}>{formatViewCount(viewCount)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { width: "100%", paddingTop: 2, paddingBottom: 10 },
  tabs: { flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  tab: { flex: 1, minHeight: 52, gap: 3, alignItems: "center", justifyContent: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  thumbnail: { aspectRatio: 1, overflow: "hidden", backgroundColor: "#111111" },
  videoFrame: { flex: 1, overflow: "hidden" },
  videoFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  playBadge: { position: "absolute", left: "50%", top: "50%", width: 30, height: 30, marginLeft: -15, marginTop: -15, borderRadius: 15, backgroundColor: "rgba(0,0,0,0.48)", alignItems: "center", justifyContent: "center" },
  viewCount: { position: "absolute", left: 4, right: 4, bottom: 4, minHeight: 20, paddingHorizontal: 4, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.72)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 },
  viewCountText: { color: "#fff", fontSize: 9, lineHeight: 12, fontWeight: "700", flexShrink: 1 },
  tabLabel: { fontSize: 11, fontWeight: "600" },
  empty: { fontSize: 13, lineHeight: 19, textAlign: "center" },
  state: { minHeight: 76, alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 12 },
  loading: { minHeight: 76 },
  pageError: { textAlign: "center", fontSize: 12, marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 4, paddingTop: 4, justifyContent: "flex-start" },
  loadMore: { minHeight: 40, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 8 },
});

function emptyCopy(tab: MediaTab, own: boolean): string {
  if (tab === "reels") return own ? "Your first Reel will appear here." : "No Reels to show yet.";
  return "Saved Reels are private to you.";
}

function formatViewCount(value: number): string {
  if (value < 1_000) return String(value);
  if (value < 1_000_000) return `${(value / 1_000).toFixed(value < 10_000 ? 1 : 0).replace(/\.0$/, "")}k`;
  return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
}
