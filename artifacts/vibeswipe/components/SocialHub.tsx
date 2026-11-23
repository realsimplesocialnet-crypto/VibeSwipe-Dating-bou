import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, AppState, FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getGetNotificationsQueryKey, getGetWhoViewedYouQueryKey,
  useGetNotifications, useGetWhoViewedYou, useMarkNotificationRead,
  createUseMarkActivitySeen, patchActivityReads, type ActivityCategory, type NotificationsResponse,
} from "@workspace/api-client-react";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { AppHeader } from "@/components/AppHeader";
import { usePremiumColors } from "@/hooks/useColors";

const live = { refetchInterval: 15000, refetchOnMount: "always" as const, refetchOnWindowFocus: true, staleTime: 0 };
const useMarkActivitySeen = createUseMarkActivitySeen({ useCallback, useEffect, useRef, useState });
function useSeenOnFocus(category: ActivityCategory, ready: boolean) {
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => setForeground(state === "active"));
    return () => subscription.remove();
  }, []);
  return useMarkActivitySeen(category, { active: focused && foreground, ready });
}

function SeenError({ seen }: { seen: ReturnType<typeof useMarkActivitySeen> }) {
  const c = usePremiumColors();
  return seen.error ? <Pressable disabled={seen.pending} onPress={() => void seen.retry()} accessibilityRole="button" style={{ padding: 12, marginHorizontal: 20 }}><Text accessibilityRole="alert" style={{ color: c.primary }}>Couldn’t clear the new count. Tap to retry.</Text></Pressable> : null;
}
function ago(v: string) {
  const s = Math.max(0, (Date.now() - new Date(v).getTime()) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(v).toLocaleDateString();
}
function useRefetchOnFocus(fns: (() => unknown)[]) {
  const ref = fns;
  useFocusEffect(useCallback(() => { ref.forEach((f) => void f()); }, [])); // eslint-disable-line react-hooks/exhaustive-deps
}

function Screen({ title, sub, back, home, children }: { title: string; sub?: string; back?: boolean; home?: boolean; children: ReactNode }) {
  const c = usePremiumColors();
  const insets = useSafeAreaInsets();
  const top = Platform.OS === "web" ? 67 : insets.top;
  return (
    <View style={[s.flex, { backgroundColor: c.messagesBackground }]}>
      <View style={[s.head, { paddingTop: top + 10 }]}>
        {back && (
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/activity" as never))} testID="button-back-activity" accessibilityRole="button" accessibilityLabel="Back to Activity" style={[s.back, { backgroundColor: c.profileCard, borderColor: c.border }]}>
            <Feather name="arrow-left" size={16} color={c.foreground} />
            <Text style={[s.backText, { color: c.foreground }]}>Activity</Text>
          </Pressable>
        )}
        {home && (
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)" as never))} testID="button-back-home" accessibilityRole="button" accessibilityLabel="Back to Home" style={[s.back, { backgroundColor: c.profileCard, borderColor: c.border }]}>
            <Feather name="arrow-left" size={16} color={c.foreground} />
            <Text style={[s.backText, { color: c.foreground }]}>Home</Text>
          </Pressable>
        )}
        <Text style={[s.title, { color: c.foreground }]} accessibilityRole="header">{title}</Text>
        {sub && <Text style={[s.sub, { color: c.mutedForeground }]}>{sub}</Text>}
      </View>
      {children}
    </View>
  );
}

function State({ loading, error, empty, onRetry: _onRetry, icon, emptyTitle, emptyText }: { loading: boolean; error: boolean; empty: boolean; onRetry: () => void; icon: keyof typeof Feather.glyphMap; emptyTitle: string; emptyText: string }) {
  const c = usePremiumColors();
  if (loading) return <View style={s.center}><ActivityIndicator color={c.primary} /></View>;
  if (error) return <View style={s.center}><ActivityIndicator color={c.primary} accessibilityLabel="Loading" /></View>;
  if (empty) return (
    <View style={[s.card, s.stateCard, { backgroundColor: c.profileCard, borderColor: c.border }]} testID="status-empty">
      <View style={[s.iconBox, { backgroundColor: c.profileChip }]}><Feather name={icon} size={22} color={c.primary} /></View>
      <Text style={[s.name, { color: c.foreground }]}>{emptyTitle}</Text>
      <Text style={{ color: c.mutedForeground, textAlign: "center" }}>{emptyText}</Text>
    </View>
  );
  return null;
}

export function ActivityOverview() {
  const c = usePremiumColors();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const notes = useGetNotifications({ query: { queryKey: getGetNotificationsQueryKey(), ...live } });
  const mark = useMarkNotificationRead();
  const [readError, setReadError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "likes" | "comments" | "follows" | "views">("all");
  const allItems = useMemo(() => (notes.data?.notifications ?? [])
    .filter(n => n.type === "profile_view" || n.type === "new_follow" || n.type === "reel_like" || n.type === "reel_comment_like" || n.type === "reel_comment_reply")
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [notes.data?.notifications]);
  const items = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return allItems.filter((item) => {
      const categoryMatches = filter === "all"
        || (filter === "likes" && (item.type === "reel_like" || item.type === "reel_comment_like"))
        || (filter === "comments" && item.type === "reel_comment_reply")
        || (filter === "follows" && item.type === "new_follow")
        || (filter === "views" && item.type === "profile_view");
      return categoryMatches && (!term || item.actor.name.toLocaleLowerCase().includes(term));
    });
  }, [allItems, filter, search]);

  async function markAllRead() {
    const unreadIds = allItems.filter((item) => !item.readAt).map((item) => item.id);
    if (!unreadIds.length || mark.isPending) return;
    const key = getGetNotificationsQueryKey();
    const stamp = new Date().toISOString();
    setReadError("");
    await qc.cancelQueries({ queryKey: key });
    qc.setQueryData<NotificationsResponse>(key, (data) => data ? patchActivityReads(data, unreadIds, stamp) : data);
    const results = await Promise.allSettled(unreadIds.map((notificationId) => mark.mutateAsync({ notificationId })));
    const failedIds = unreadIds.filter((_, index) => results[index]?.status === "rejected");
    if (failedIds.length) {
      qc.setQueryData<NotificationsResponse>(key, (data) => data ? patchActivityReads(data, failedIds, stamp, true) : data);
      setReadError("Some notifications could not be marked as read. Try again.");
    }
    void qc.invalidateQueries({ queryKey: key });
  }

  async function openActivityItem(n: NotificationsResponse["notifications"][number]) {
    const key = getGetNotificationsQueryKey();
    const stamp = new Date().toISOString();
    if (!n.readAt) {
      await qc.cancelQueries({ queryKey: key });
      const current = qc.getQueryData<NotificationsResponse>(key);
      const canOptimisticallyMark = !!current?.notifications.some(item => item.id === n.id && !item.readAt);
      if (canOptimisticallyMark) {
        qc.setQueryData<NotificationsResponse>(key, data => data ? patchActivityReads(data, [n.id], stamp) : data);
      }
      try {
        await mark.mutateAsync({ notificationId: n.id });
      } catch {
        if (canOptimisticallyMark) {
          qc.setQueryData<NotificationsResponse>(key, data => data ? patchActivityReads(data, [n.id], stamp, true) : data);
        }
        setReadError("This activity could not be marked as read. Please try again.");
      } finally {
        void qc.invalidateQueries({ queryKey: key });
      }
    }
    if (n.reelId && (n.type === "reel_like" || n.type === "reel_comment_like" || n.type === "reel_comment_reply")) {
      router.push({
        pathname: "/reels/[reelId]",
        params: {
          reelId: n.reelId,
          returnTo: "/(tabs)/activity",
          ...(n.commentId ? { openComments: "1", commentId: n.commentId } : {}),
        },
      } as never);
      return;
    }
    router.push({ pathname: "/profile/[profileId]", params: { profileId: n.actor.id, returnTo: "activity" } });
  }

  return (
    <View style={[s.flex, { backgroundColor: c.messagesBackground }]}>
      <AppHeader active="notifications" />
      <ScrollView contentContainerStyle={[s.activityContent, { paddingBottom: insets.bottom + 110 }]}>
        <View testID="activity-summary" style={[s.notificationControls, { backgroundColor: c.profileCard, borderColor: c.border }]}>
          <View style={s.notificationHeading}>
            <View style={s.notificationTitleCopy}>
              <Text style={[s.notificationTitle, { color: c.foreground }]} accessibilityRole="header">Notifications</Text>
              <Text style={[s.notificationSubtitle, { color: c.mutedForeground }]}>
                {allItems.some((item) => !item.readAt) ? "Stay up to date with your community." : "You are caught up on all activity."}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mark all notifications read"
              disabled={!allItems.some((item) => !item.readAt) || mark.isPending}
              onPress={() => void markAllRead()}
              style={[s.markReadButton, { backgroundColor: c.secondary, opacity: !allItems.some((item) => !item.readAt) || mark.isPending ? 0.48 : 1 }]}
            >
              {mark.isPending ? <ActivityIndicator size="small" color={c.foreground} /> : <Feather name="check" size={15} color={c.foreground} />}
              <Text style={[s.markReadText, { color: c.foreground }]}>Mark all read</Text>
            </Pressable>
          </View>
          <View style={[s.activitySearch, { backgroundColor: c.secondary }]}>
            <Feather name="search" size={18} color={c.mutedForeground} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search activity feed..."
              placeholderTextColor={c.mutedForeground}
              accessibilityLabel="Search activity feed"
              returnKeyType="search"
              maxLength={100}
              style={[s.activitySearchInput, { color: c.foreground }]}
            />
            {search ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearch("")}><Feather name="x" size={17} color={c.mutedForeground} /></Pressable> : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.activityFilters} accessibilityLabel="Notification filters">
            {([
              ["all", "All"],
              ["likes", "Likes"],
              ["comments", "Comments"],
              ["follows", "Follows"],
              ["views", "Profile views"],
            ] as const).map(([value, label]) => {
              const selected = filter === value;
              return <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                testID={`activity-filter-${value}`}
                onPress={() => setFilter(value)}
                style={[s.activityFilter, { backgroundColor: selected ? c.primary : c.secondary }]}
              >
                <Text style={[s.activityFilterText, { color: selected ? c.primaryForeground : c.foreground }]}>{label}</Text>
              </Pressable>;
            })}
          </ScrollView>
        </View>
        {readError ? <Text accessibilityRole="alert" style={[s.activityReadError, { color: c.destructive }]}>{readError}</Text> : null}
        {notes.isLoading || (notes.isError && !notes.data) ? (
          <State loading={notes.isLoading} error={notes.isError} empty={false} onRetry={() => void notes.refetch()} icon="bell" emptyTitle="" emptyText="" />
        ) : null}
        {!notes.isLoading && !notes.isError && items.length === 0 ? (
          <View style={[s.activityEmpty, { backgroundColor: c.profileCard, borderColor: c.border }]} testID="status-empty-activity"><Feather name="bell" size={22} color={c.mutedForeground}/><Text style={{ color: c.mutedForeground, fontWeight: "600", textAlign: "center" }}>{search || filter !== "all" ? "No notifications match your current filter." : "You are caught up on all activity."}</Text></View>
        ) : null}
        {items.length > 0 ? <View testID="activity-feed" accessibilityLabel="Activity feed">
          {items.map(n => {
            const event = n.type === "reel_like"
              ? { label: "liked your post", icon: "heart" as const }
              : n.type === "reel_comment_like"
                ? { label: "liked your comment", icon: "heart" as const }
                : n.type === "reel_comment_reply"
                  ? { label: "replied to your comment", icon: "message-circle" as const }
                  : n.type === "profile_view"
                  ? { label: "viewed your profile", icon: "eye" as const }
                  : { label: "followed you", icon: "user" as const };
            return <Pressable key={n.id} onPress={() => void openActivityItem(n)} testID={`activity-item-${n.id}`} accessibilityRole="button" accessibilityLabel={`${n.actor.name} ${event.label}, ${ago(n.createdAt)}${n.readAt ? ", read" : ", unread"}`} accessibilityState={{ disabled: false }} style={({ pressed }) => [s.activityRow, { borderBottomColor: c.border, opacity: n.readAt ? 0.72 : pressed ? 0.84 : 1 }]}>
              <View style={[s.activityFeedIcon, { backgroundColor: c.secondary }]}><Feather name={event.icon} size={19} color={c.foreground}/></View>
              <View style={s.activityFeedCopy}><Text numberOfLines={1} style={[s.activityFeedText, { color: c.foreground }]}><Text style={{ fontWeight: "800" }}>{n.actor.name}</Text> {event.label}</Text><Text style={[s.time, { color: c.mutedForeground }]}>{ago(n.createdAt)}</Text></View>
              {!n.readAt ? <View style={[s.dot, { backgroundColor: c.primary }]} accessibilityLabel="Unread"/> : null}
            </Pressable>;
          })}
        </View> : null}
      </ScrollView>
    </View>
  );
}

export function ProfileViewsPage() {
  const c = usePremiumColors();
  const insets = useSafeAreaInsets();
  const views = useGetWhoViewedYou({ query: { queryKey: getGetWhoViewedYouQueryKey(), ...live } });
  const seen = useSeenOnFocus("views", views.isSuccess && !views.isFetching);
  useRefetchOnFocus([views.refetch]);
  const rows = useMemo(() => (views.data ?? []).map((view) => ({ profile: view.profile, at: view.viewedAt })), [views.data]);
  return (
     <Screen back title="Profile views" sub="People who viewed your profile">
      <SeenError seen={seen} />
      {views.isLoading || (views.isError && !views.data) ? (
        <View style={s.list}><State loading={views.isLoading} error={views.isError && !views.data} empty={false} onRetry={() => void views.refetch()} icon="eye" emptyTitle="" emptyText="" /></View>
      ) : !rows.length ? (
        <View style={s.list}><State loading={false} error={false} empty onRetry={() => void views.refetch()} icon="eye" emptyTitle="No views yet" emptyText="When someone opens your profile, they show up here." /></View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => `${row.profile.id}-${row.at}`}
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 110 }]}
          renderItem={({ item: row }) => (
             <View testID={`card-views-profile-${row.profile.id}`} style={[s.card, { backgroundColor: c.profileCard, borderColor: c.border }]}>
              <View style={s.row}>
                <Pressable onPress={() => router.push({ pathname: "/profile/[profileId]", params: { profileId: row.profile.id } } as never)} testID={`link-views-profile-${row.profile.id}`} accessibilityRole="button" accessibilityLabel={`View ${row.profile.name}'s profile`} style={[s.row, s.flex]}>
              <View style={[s.avatarRing, { borderColor: c.premiumAccent }]}><ProfileAvatar profile={row.profile} size={54} /></View>
              <View style={s.flex}>
                <Text numberOfLines={1} style={[s.name, { color: c.foreground }]}>{`${row.profile.name}${row.profile.age !== null && row.profile.showAge !== false ? `, ${row.profile.age}` : ""}`}</Text>
                <Text style={{ color: c.mutedForeground, fontSize: 13 }}>Viewed your profile · {ago(row.at)}</Text>
              </View>
              <View style={[s.pill, { backgroundColor: c.profileChip }]}><Feather name="eye" size={14} color={c.primary} /><Text style={{ color: c.primary, fontWeight: "700", fontSize: 12 }}>View</Text></View>
               </Pressable>
              </View>
             </View>
          )}
        />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  activityContent: { paddingHorizontal: 16, paddingTop: 14, gap: 14 },
  notificationControls: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 16, gap: 13 },
  notificationHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  notificationTitleCopy: { flex: 1, minWidth: 0 },
  notificationTitle: { fontSize: 24, lineHeight: 30, fontWeight: "800", letterSpacing: -0.5 },
  notificationSubtitle: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  markReadButton: { minHeight: 40, borderRadius: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 10 },
  markReadText: { fontSize: 11, fontWeight: "700" },
  activitySearch: { minHeight: 46, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 13 },
  activitySearchInput: { flex: 1, minWidth: 0, height: 46, fontSize: 14 },
  activityFilters: { flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 4 },
  activityFilter: { minHeight: 38, borderRadius: 13, paddingHorizontal: 13, alignItems: "center", justifyContent: "center" },
  activityFilterText: { fontSize: 12, fontWeight: "700" },
  activityGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  activityMetric: { width: "48.5%", minHeight: 92, flexGrow: 1, flexBasis: "45%", flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 17, padding: 12 },
  activityMetricIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  activityMetricCopy: { minWidth: 0, gap: 2 },
  activityMetricCount: { fontSize: 25, fontWeight: "800", lineHeight: 29, fontVariant: ["tabular-nums"] },
  activityMetricLabel: { fontSize: 13, fontWeight: "600" },
  activityRow: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 4, paddingVertical: 10 },
  activityFeedIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  activityFeedCopy: { flex: 1, minWidth: 0, gap: 4 },
  activityFeedText: { fontSize: 14 },
  activityReadError: { borderWidth: 1, borderRadius: 12, padding: 10, fontSize: 13 },
  activityEmpty: { minHeight: 260, alignItems: "center", justifyContent: "center", gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 24 },
  brandBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 18, paddingBottom: 6 },
  logo: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  logoM: { fontSize: 18, fontWeight: "800" },
  brandText: { fontSize: 20, fontWeight: "800", letterSpacing: -0.6 },
  head: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 12 },
  back: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 12 },
  backText: { fontWeight: "600", fontSize: 14 },
  title: { fontSize: 36, fontWeight: "800", letterSpacing: -1.5 },
  sub: { fontSize: 15, marginTop: 4 },
  list: { paddingHorizontal: 16, gap: 10 },
  section: { fontSize: 12, fontWeight: "800", letterSpacing: 2, marginBottom: 2 },
  card: { borderWidth: 1, borderRadius: 22, padding: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  stateCard: { alignItems: "center", gap: 10, paddingVertical: 32 },
  emptyLikes: { flex: 1, minHeight: 260, alignItems: "center", justifyContent: "center", paddingHorizontal: 26 },
  emptyHeart: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  emptySubtitle: { fontSize: 15, marginTop: 6, textAlign: "center" },
  avatarRing: { borderWidth: 1.5, borderRadius: 32, padding: 2 },
  heartBadge: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  center: { paddingVertical: 40, alignItems: "center" },
  btn: { borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10, marginTop: 4 },
  notice: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12 },
  time: { fontSize: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  iconBox: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: -5, right: -5, minWidth: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { fontSize: 11, fontWeight: "800" },
  name: { fontSize: 17, fontWeight: "700" },
  stack: { flexDirection: "row" },
  stackItem: { borderWidth: 2, borderRadius: 18 },
  count: { fontSize: 20, fontWeight: "800", minWidth: 22, textAlign: "right" },
  pill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  chat: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  likeActions: { flexDirection: "row", gap: 8, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 12, paddingTop: 10 },
  likeActionButton: { flex: 1, minHeight: 40, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
