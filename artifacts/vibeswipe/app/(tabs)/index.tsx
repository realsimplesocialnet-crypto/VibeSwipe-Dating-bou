import { Feather } from "@expo/vector-icons";
import { useInfiniteQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getGetSocialFeedQueryKey, getSocialFeed, useGetNotifications, type Reel } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { PostCard, PostSkeleton, useMediaToken } from "@/components/social/PostCard";
import { StoriesRow } from "@/components/social/Stories";

export default function HomeFeedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const token = useMediaToken();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const notifications = useGetNotifications({ query: { refetchInterval: 15_000 } });
  const counts = notifications.data?.unreadCounts;
  const messageBadge = counts?.messages ?? 0;
  const activityBadge = counts ? counts.likes + counts.follows + (counts.reels ?? 0) : 0;
  const feed = useInfiniteQuery({
    queryKey: [...getGetSocialFeedQueryKey({ mode: "home" }), "infinite"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => getSocialFeed({ mode: "home", limit: 12, ...(pageParam ? { cursor: pageParam } : {}) }, { signal }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 20_000,
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
  const top = Platform.OS === "web" ? 67 : insets.top;

  const header = (
    <View>
      <StoriesRow token={token} />
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.bar, { paddingTop: top + 6, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <Text style={[styles.brand, { color: colors.foreground }]} accessibilityRole="header">Vibe<Text style={{ color: colors.primary }}>Swipes</Text></Text>
        <View style={styles.barActions}>
          <BarIcon icon="plus-square" label="Create" onPress={() => router.push("/(tabs)/create" as never)} />
          <BarIcon icon="heart" label="Activity" badge={activityBadge} onPress={() => router.push("/(tabs)/activity" as never)} />
          <BarIcon icon="send" label="Messages" badge={messageBadge} onPress={() => router.push("/(tabs)/views" as never)} />
        </View>
      </View>
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
          renderItem={({ item }) => <PostCard reel={item} token={token} active={activeId === item.id} onRemoved={onRemoved} />}
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

function BarIcon({ icon, label, badge = 0, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; badge?: number; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={badge ? `${label}, ${badge} new` : label} style={styles.barBtn}>
      <Feather name={icon} size={23} color={colors.foreground} />
      {badge > 0 ? <View style={[styles.badge, { backgroundColor: colors.primary, borderColor: colors.background }]}><Text style={[styles.badgeText, { color: colors.primaryForeground }]}>{badge > 99 ? "99+" : badge}</Text></View> : undefined}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  brand: { fontSize: 26, fontWeight: "900", letterSpacing: -1.2, fontStyle: "italic" },
  barActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  barBtn: { padding: 3 },
  badge: { position: "absolute", top: -4, right: -7, minWidth: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  badgeText: { fontSize: 9, fontWeight: "900" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 30 },
  empty: { alignItems: "center", paddingHorizontal: 32, paddingTop: 48, gap: 12 },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, borderWidth: 2, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 20, fontWeight: "800", textAlign: "center", letterSpacing: -0.4 },
  emptyCopy: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  cta: { alignSelf: "stretch", borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  ctaText: { fontWeight: "800", fontSize: 14 },
  caughtUp: { alignItems: "center", gap: 6, paddingVertical: 28 },
});
