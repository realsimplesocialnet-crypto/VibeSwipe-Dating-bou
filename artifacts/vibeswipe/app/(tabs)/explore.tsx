import { Feather } from "@expo/vector-icons";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getGetSocialFeedQueryKey, getSocialFeed, type Reel } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { authedSource, isPhotoPost, useMediaToken } from "@/components/social/PostCard";

export default function ExploreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const token = useMediaToken();
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => { const t = setTimeout(() => setQ(query.trim()), 300); return () => clearTimeout(t); }, [query]);
  const params = q.length >= 2 ? { mode: "explore" as const, q } : { mode: "explore" as const };
  const feed = useInfiniteQuery({
    queryKey: [...getGetSocialFeedQueryKey(params), "infinite"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => getSocialFeed({ ...params, limit: 24, ...(pageParam ? { cursor: pageParam } : {}) }, { signal }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 30_000,
  });
  const posts = useMemo(() => {
    const seen = new Set<string>();
    return (feed.data?.pages.flatMap((p) => p.items) ?? []).filter((r) => !seen.has(r.id) && seen.add(r.id));
  }, [feed.data]);
  const tile = Math.floor((width - 4) / 3);
  const top = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.head, { paddingTop: top + 8 }]}>
        <View style={[styles.search, { backgroundColor: colors.muted }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search posts" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground }]} returnKeyType="search" autoCorrect={false} testID="explore-search" />
          {query ? <Pressable onPress={() => setQuery("")} hitSlop={8} accessibilityLabel="Clear search"><Feather name="x-circle" size={16} color={colors.mutedForeground} /></Pressable> : null}
        </View>
        <Pressable onPress={() => router.push({ pathname: "/search", params: query.trim() ? { q: query.trim() } : {} })} style={[styles.people, { borderColor: colors.border }]} accessibilityRole="button" accessibilityLabel="Search people" testID="explore-people">
          <Feather name="users" size={17} color={colors.foreground} />
        </Pressable>
      </View>
      {feed.isLoading ? (
        <View style={styles.grid}>{Array.from({ length: 12 }).map((_, i) => <View key={i} style={{ width: tile, height: tile * 1.25, backgroundColor: colors.muted, opacity: 0.6 }} />)}</View>
      ) : feed.isError && !posts.length ? (
        <View style={styles.center}>
          <Text style={[styles.title, { color: colors.foreground }]}>Explore didn't load</Text>
          <Pressable onPress={() => void feed.refetch()} style={[styles.cta, { backgroundColor: colors.primary }]}><Text style={{ color: colors.primaryForeground, fontWeight: "800" }}>Try again</Text></Pressable>
        </View>
      ) : (
        <FlatList
          data={posts}
          numColumns={3}
          keyExtractor={(r) => r.id}
          columnWrapperStyle={{ gap: 2 }}
          contentContainerStyle={{ gap: 2, paddingBottom: insets.bottom + 90 }}
          renderItem={({ item }) => <Tile reel={item} token={token} size={tile} />}
          onEndReached={() => { if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage(); }}
          onEndReachedThreshold={0.7}
          refreshControl={<RefreshControl refreshing={feed.isRefetching && !feed.isFetchingNextPage} onRefresh={() => void feed.refetch()} tintColor={colors.primary} />}
          ListFooterComponent={feed.isFetchingNextPage ? <ActivityIndicator color={colors.primary} style={{ margin: 20 }} /> : undefined}
          ListEmptyComponent={
            <View style={styles.center}>
              <Feather name="compass" size={28} color={colors.primary} />
              <Text style={[styles.title, { color: colors.foreground }]}>{q ? `Nothing for "${q}" yet` : "No public posts yet"}</Text>
              <Text style={{ color: colors.mutedForeground, textAlign: "center" }}>Try another word, or look for people instead.</Text>
              <Pressable onPress={() => router.push("/search")} style={[styles.cta, { backgroundColor: colors.primary }]}><Text style={{ color: colors.primaryForeground, fontWeight: "800" }}>Search people</Text></Pressable>
            </View>
          }
        />
      )}
    </View>
  );
}

function Tile({ reel, token, size }: { reel: Reel; token: string | null; size: number }) {
  const colors = useColors();
  const photo = isPhotoPost(reel);
  const source = authedSource(photo ? reel.slideReferences[0] : null, token);
  return (
    <Pressable onPress={() => router.push({ pathname: "/reels/[reelId]", params: { reelId: reel.id, returnTo: "/(tabs)/explore" } } as never)} accessibilityRole="button" accessibilityLabel={`Post by ${reel.creatorName}${reel.caption ? `: ${reel.caption}` : ""}`} style={({ pressed }) => ({ width: size, height: size * 1.25, backgroundColor: colors.muted, opacity: pressed ? 0.8 : 1 })}>
      {source ? <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={reel.id} /> : (
        <View style={[StyleSheet.absoluteFill, styles.videoTile, { backgroundColor: colors.discoverBackground }]}>
          <Text numberOfLines={3} style={styles.videoCaption}>{reel.caption || reel.creatorName}</Text>
        </View>
      )}
      <View style={styles.badge} pointerEvents="none">
        <Feather name={photo ? (reel.slideReferences.length > 1 ? "copy" : "image") : "play"} size={13} color="#fff7fb" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  head: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingBottom: 10 },
  search: { flex: 1, height: 40, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 },
  input: { flex: 1, fontSize: 15, paddingVertical: 0 },
  people: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 2 },
  center: { alignItems: "center", gap: 10, padding: 32, paddingTop: 60 },
  title: { fontSize: 18, fontWeight: "800", textAlign: "center" },
  cta: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: 6 },
  badge: { position: "absolute", top: 6, right: 6 },
  videoTile: { alignItems: "center", justifyContent: "center", padding: 8 },
  videoCaption: { color: "#fff7fb", fontSize: 11, fontWeight: "700", textAlign: "center" },
});
