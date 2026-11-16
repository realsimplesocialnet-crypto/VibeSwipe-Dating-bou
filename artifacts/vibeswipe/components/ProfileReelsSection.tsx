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
}: {
  profileId: string;
  returnTo: string;
}) {
  const colors = usePremiumColors();
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const reelsQuery = useInfiniteQuery({
    queryKey: getGetProfileReelsQueryKey({ profileId }),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      getProfileReels({ profileId, ...(pageParam ? { cursor: pageParam } : {}) }, { signal }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: Boolean(profileId),
    staleTime: 60_000,
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
    <View testID="profile-reels-section" style={[styles.section, { backgroundColor: colors.profileCard }]}>
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
        <FlatList
          horizontal
          data={reels}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ReelThumbnail
              reel={item}
              token={token}
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
      ) : (
        <Text testID="profile-reels-empty" style={[styles.empty, { color: colors.profileMuted }]}>No reels yet.</Text>
      )}
    </View>
  );
}

function ReelThumbnail({
  reel,
  token,
  onPress,
}: {
  reel: Reel;
  token: string | null;
  onPress: () => void;
}) {
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
      accessibilityLabel={`Play Reel${reel.caption ? `: ${reel.caption}` : ""}`}
      onPress={onPress}
      style={({ pressed }) => [styles.thumbnail, { opacity: pressed ? 0.82 : 1 }]}
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
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.08)", paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  heading: { flexDirection: "row", alignItems: "center", gap: 8 },
  icon: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, flex: 1 },
  count: { fontSize: 12, fontWeight: "600" },
  row: { gap: 8, paddingBottom: 2 },
  thumbnail: { width: 74, aspectRatio: 9 / 16, borderRadius: 12, overflow: "hidden", backgroundColor: "#100f12" },
  videoFrame: { flex: 1, overflow: "hidden" },
  videoFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  playBadge: { position: "absolute", left: "50%", top: "50%", width: 30, height: 30, marginLeft: -15, marginTop: -15, borderRadius: 15, backgroundColor: "rgba(0,0,0,0.52)", alignItems: "center", justifyContent: "center" },
  empty: { fontSize: 13, lineHeight: 19, paddingVertical: 2 },
  loading: { alignSelf: "flex-start", marginVertical: 14, marginLeft: 4 },
  more: { width: 34 },
});
