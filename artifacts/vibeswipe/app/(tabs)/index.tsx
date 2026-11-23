import { Feather } from "@expo/vector-icons";
import { useInfiniteQuery } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, AppState, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getGetSocialFeedQueryKey, getSocialFeed, type Reel } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { PostCard, PostSkeleton, useMediaToken } from "@/components/social/PostCard";
import { StoriesRow } from "@/components/social/Stories";

export default function HomeFeedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const token = useMediaToken();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [screenFocused, setScreenFocused] = useState(true);
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const screenActive = screenFocused && appActive;
  useFocusEffect(useCallback(() => {
    setScreenFocused(true);
    return () => setScreenFocused(false);
  }, []));
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setAppActive(state === "active"));
    return () => subscription.remove();
  }, []);
  const feed = useInfiniteQuery({
    queryKey: [...getGetSocialFeedQueryKey({ mode: "home" }), "infinite"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => getSocialFeed({ mode: "home", limit: 12, ...(pageParam ? { cursor: pageParam } : {}) }, { signal }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 20_000,
    enabled: screenActive,
  });
  const posts = useMemo(() => {
    const seen = new Set<string>();
    return (feed.data?.pages.flatMap((p) => p.items) ?? []).filter((r) => !removed.has(r.id) && !seen.has(r.id) && seen.add(r.id));
  }, [feed.data, removed]);
  const onViewable = useRef(({ viewableItems }: { viewableItems: Array<{ isViewable: boolean; item: Reel | null }> }) => {
    const first = viewableItems.find((v) => v.isViewable && v.item && v.item.mediaType !== "slides");
    setActiveId(first?.item?.id ?? null);
  }).current;
  const onRemoved = useCallback((id: string) => setRemoved((s) => new Set(s).add(id)), []);
  const header = (
    <View>
      <StoriesRow token={token} />
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader />
      {feed.isLoading ? (
        <View>{header}<PostSkeleton /><PostSkeleton /></View>
      ) : feed.isError && !posts.length ? (
        <View style={styles.center}>
          <Feather name="wifi-off" size={26} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Your feed didn't load</Text>
          <Pressable onPress={() => void feed.refetch()} style={[styles.cta, { backgroundColor: colors.primary }]}><Text style={[styles.ctaText, { color: colors.primaryForeground }]}>Try again</Text></Pressable>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(r) => r.id}
          ListHeaderComponent={header}
          renderItem={({ item }) => <PostCard reel={item} token={token} active={screenActive && activeId === item.id} onRemoved={onRemoved} />}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          onEndReached={() => { if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage(); }}
          onEndReachedThreshold={0.6}
          refreshControl={<RefreshControl refreshing={feed.isRefetching && !feed.isFetchingNextPage} onRefresh={() => void feed.refetch()} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
          windowSize={5}
          initialNumToRender={3}
          removeClippedSubviews
          ListFooterComponent={feed.isFetchingNextPage ? <ActivityIndicator color={colors.primary} style={{ margin: 20 }} /> : posts.length && !feed.hasNextPage ? (
            <View style={styles.caughtUp}>
              <Feather name="check-circle" size={22} color={colors.primary} />
              <Text style={[styles.emptyTitle, { color: colors.foreground, fontSize: 15 }]}>You're all caught up</Text>
              <Text onPress={() => router.push("/(tabs)/explore" as never)} style={{ color: colors.primary, fontWeight: "700" }}>Find more on Explore</Text>
            </View>
          ) : undefined}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { borderColor: colors.primary }]}><Feather name="camera" size={28} color={colors.primary} /></View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Your feed starts with a follow</Text>
              <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>Posts from people you follow, and your own, show up here newest first.</Text>
              <Pressable testID="home-explore-cta" onPress={() => router.push("/(tabs)/explore" as never)} style={[styles.cta, { backgroundColor: colors.primary }]}>
                <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>Explore people and posts</Text>
              </Pressable>
              <Pressable onPress={() => router.push("/(tabs)/create" as never)} style={[styles.cta, { borderWidth: 1, borderColor: colors.border }]}>
                <Text style={[styles.ctaText, { color: colors.foreground }]}>Share your first post</Text>
              </Pressable>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 30 },
  empty: { alignItems: "center", paddingHorizontal: 32, paddingTop: 48, gap: 12 },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, borderWidth: 2, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 20, fontWeight: "800", textAlign: "center", letterSpacing: -0.4 },
  emptyCopy: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  cta: { alignSelf: "stretch", borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  ctaText: { fontWeight: "800", fontSize: 14 },
  caughtUp: { alignItems: "center", gap: 6, paddingVertical: 28 },
});
