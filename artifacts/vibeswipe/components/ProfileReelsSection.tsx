import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from "expo-video";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import {
  getGetProfileReelsQueryKey,
  getProfileReels,
  type Reel,
} from "@workspace/api-client-react";
import { usePremiumColors } from "@/hooks/useColors";
import { mediaUri } from "@/lib/media";

export function ProfileReelsSection({
  profileId,
  returnTo,
  layout = "carousel",
}: {
  profileId: string;
  returnTo: string;
  layout?: "carousel" | "grid";
}) {
  const colors = usePremiumColors();
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [sectionWidth, setSectionWidth] = useState(0);
  const reelsQuery = useInfiniteQuery({
    queryKey: getGetProfileReelsQueryKey({ profileId }),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      getProfileReels({ profileId, ...(pageParam ? { cursor: pageParam } : {}) }, { signal }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: Boolean(profileId),
    staleTime: 60_000,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  const reels = reelsQuery.data?.pages.flatMap((page) => page.items) ?? [];

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
    router.push({
      pathname: "/reels/[reelId]",
      params: { reelId: reel.id, returnTo },
    });
  }

  return (
    <View testID="profile-reels-section" onLayout={(event) => setSectionWidth(event.nativeEvent.layout.width)} style={[styles.section, { backgroundColor: colors.profileCard }]}>
      <View style={styles.heading}>
        <View style={[styles.icon, { backgroundColor: colors.profileChip }]}>
          <Feather name="film" size={13} color={colors.profileEdit} />
        </View>
        <Text style={[styles.title, { color: colors.profileLabel }]}>REELS</Text>
        {reels.length > 0 ? <Text style={[styles.count, { color: colors.profileMuted }]}>{reels.length}</Text> : null}
      </View>

      {reelsQuery.isLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : reelsQuery.isError && !reels.length ? (
        <Pressable accessibilityRole="button" onPress={() => void reelsQuery.refetch()}>
          <Text accessibilityRole="alert" style={[styles.empty, { color: colors.profileMuted }]}>Reels couldn’t load. Tap to retry.</Text>
        </Pressable>
      ) : reels.length ? (
        layout === "grid" ? (
          <>
            <View style={styles.grid} testID="profile-reels-grid">
              {reels.map((item) => (
                <ReelThumbnail
                  key={item.id}
                  reel={item}
                  token={token}
                  layout="grid"
                  tileWidth={Math.max(72, Math.floor((sectionWidth - 24 - 16) / 3))}
                  onPress={() => openReel(item)}
                />
              ))}
            </View>
            {reelsQuery.hasNextPage ? (
              <Pressable
                testID="button-load-more-profile-reels"
                accessibilityRole="button"
                disabled={reelsQuery.isFetchingNextPage}
                onPress={() => void reelsQuery.fetchNextPage()}
                style={[styles.loadMore, { borderColor: colors.border }]}
              >
                {reelsQuery.isFetchingNextPage
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <Text style={{ color: colors.profileEdit, fontWeight: "800", fontSize: 13 }}>Load more</Text>}
              </Pressable>
            ) : null}
          </>
        ) : (
          <FlatList
            horizontal
            data={reels}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ReelThumbnail
                reel={item}
                token={token}
                layout="carousel"
                onPress={() => openReel(item)}
              />
            )}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.row}
            onEndReached={() => {
              if (reelsQuery.hasNextPage && !reelsQuery.isFetchingNextPage) {
                void reelsQuery.fetchNextPage();
              }
            }}
            onEndReachedThreshold={0.5}
            initialNumToRender={4}
            maxToRenderPerBatch={4}
            windowSize={4}
            ListFooterComponent={reelsQuery.isFetchingNextPage ? <ActivityIndicator color={colors.primary} style={styles.more} /> : undefined}
            testID="profile-reels-carousel"
          />
        )
      ) : (
        <Text testID="profile-reels-empty" style={[styles.empty, { color: colors.profileMuted }]}>No reels yet.</Text>
      )}
    </View>
  );
}

function ReelThumbnail({
  reel,
  token,
  layout,
  tileWidth,
  onPress,
}: {
  reel: Reel;
  token: string | null;
  layout: "carousel" | "grid";
  tileWidth?: number;
  onPress: () => void;
}) {
  const viewCount = Number(reel.viewCount ?? 0);
  const viewLabel = `${formatViewCount(viewCount)} ${viewCount === 1 ? "view" : "views"}`;
  const uri = mediaUri(reel.videoReference);
  const source = useMemo(
    () => uri && token ? { uri, headers: { Authorization: `Bearer ${token}` } } : null,
    [token, uri],
  );
  const player = useVideoPlayer(source, (instance) => {
    instance.muted = true;
    instance.loop = false;
  });

  return (
    <Pressable
      testID={`profile-reel-${reel.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Play Reel${reel.caption ? `: ${reel.caption}` : ""}, ${viewLabel}`}
      onPress={onPress}
      style={({ pressed }) => [styles.thumbnail, { width: layout === "grid" ? tileWidth : 74, aspectRatio: layout === "grid" ? 3 / 4 : 9 / 16, opacity: pressed ? 0.82 : 1 }]}
    >
      <View style={styles.videoFrame}>
        {source ? (
          <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} pointerEvents="none" />
        ) : (
          <View style={styles.videoFallback}><Feather name="film" size={21} color="#ffffff80" /></View>
        )}
        <View pointerEvents="none" style={styles.playBadge}>
          <Feather name="play" size={14} color="#fff" />
        </View>
        <View pointerEvents="none" style={styles.viewCount}>
          <Feather name="eye" size={10} color="#fff" />
          <Text numberOfLines={1} style={styles.viewCountText} testID={`text-profile-reel-views-${reel.id}`}>{viewLabel}</Text>
        </View>
        {layout === "grid" ? (
          <View pointerEvents="none" style={styles.engagementCounts} testID={`text-profile-reel-interactions-${reel.id}`}>
            <Count icon="heart" value={reel.likeCount} />
            <Count icon="message-circle" value={reel.commentCount} />
            <Count icon="bookmark" value={reel.saveCount} />
            <Count icon="send" value={reel.shareCount} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function Count({ icon, value }: { icon: "heart" | "message-circle" | "bookmark" | "send"; value: number }) {
  return (
    <View style={styles.engagementItem}>
      <Feather name={icon} size={9} color="#fff" />
      <Text numberOfLines={1} style={styles.engagementText}>{formatViewCount(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.08)", paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  heading: { flexDirection: "row", alignItems: "center", gap: 8 },
  icon: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, flex: 1 },
  count: { fontSize: 12, fontWeight: "600" },
  row: { gap: 8, paddingBottom: 2 },
  thumbnail: { borderRadius: 12, overflow: "hidden", backgroundColor: "#100f12" },
  videoFrame: { flex: 1, overflow: "hidden" },
  videoFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  playBadge: { position: "absolute", left: "50%", top: "50%", width: 30, height: 30, marginLeft: -15, marginTop: -15, borderRadius: 15, backgroundColor: "rgba(0,0,0,0.52)", alignItems: "center", justifyContent: "center" },
  viewCount: { position: "absolute", left: 4, right: 4, bottom: 4, minHeight: 20, paddingHorizontal: 4, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.72)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 },
  viewCountText: { color: "#fff", fontSize: 9, lineHeight: 12, fontWeight: "700", flexShrink: 1 },
  engagementCounts: { position: "absolute", left: 4, right: 4, bottom: 28, minHeight: 19, flexDirection: "row", alignItems: "center", justifyContent: "space-around", gap: 2, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.78)", paddingHorizontal: 2 },
  engagementItem: { minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2 },
  engagementText: { maxWidth: 25, color: "#fff", fontSize: 8, lineHeight: 10, fontWeight: "800" },
  empty: { fontSize: 13, lineHeight: 19, paddingVertical: 2 },
  loading: { alignSelf: "flex-start", marginVertical: 14, marginLeft: 4 },
  more: { width: 34 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  loadMore: { minHeight: 42, borderWidth: 1, borderRadius: 13, alignItems: "center", justifyContent: "center", marginTop: 4 },
});

function formatViewCount(value: number): string {
  if (value < 1_000) return String(value);
  if (value < 1_000_000) return `${(value / 1_000).toFixed(value < 10_000 ? 1 : 0).replace(/\.0$/, "")}k`;
  return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
}
