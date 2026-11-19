import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, AppState, FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getGetMatchesQueryKey, getGetNotificationsQueryKey, getGetWhoLikedYouQueryKey, getGetWhoViewedYouQueryKey,
  useCreateReaction, useGetMatches, useGetMyProfile, useGetNotifications, useGetWhoLikedYou, useGetWhoViewedYou, useMarkNotificationRead,
  useGetDailyLikeStatus,
  createUseMarkActivitySeen, patchActivityReads, type ActivityCategory, type NotificationsResponse,
  type Match, type Profile,
} from "@workspace/api-client-react";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { MatchCelebration } from "@/components/MatchCelebration";
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
const active = (m?: Match[]) => (m ?? []).filter((x) => !x.profile.isDemo && !x.blockedByMe && !x.blockedMe);
function ago(v: string) {
  const s = Math.max(0, (Date.now() - new Date(v).getTime()) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(v).toLocaleDateString();
}
const label = (p: Profile) => `${p.name}${p.age !== null && p.showAge !== false ? `, ${p.age}` : ""}`;

function useRefetchOnFocus(fns: (() => unknown)[]) {
  const ref = fns;
  useFocusEffect(useCallback(() => { ref.forEach((f) => void f()); }, [])); // eslint-disable-line react-hooks/exhaustive-deps
}

function useNoticeReader() {
  const qc = useQueryClient();
  const notes = useGetNotifications({ query: live });
  const mark = useMarkNotificationRead();
  return (actorId: string, type: "new_match" | "new_like" | "profile_view") => {
    const unread = notes.data?.notifications.filter(n => n.actor.id === actorId && (n.type === type || (type === "new_like" && n.type === "new_super_like")) && !n.readAt) ?? [];
    if (unread.length) void Promise.allSettled(unread.map(n => mark.mutateAsync({ notificationId: n.id })))
      .then(() => qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey() }));
  };
}

function Screen({ title, sub, back, children }: { title: string; sub?: string; back?: boolean; children: ReactNode }) {
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
        <Text style={[s.title, { color: c.foreground }]} accessibilityRole="header">{title}</Text>
        {sub && <Text style={[s.sub, { color: c.mutedForeground }]}>{sub}</Text>}
      </View>
      {children}
    </View>
  );
}

function State({ loading, error, empty, onRetry, icon, emptyTitle, emptyText }: { loading: boolean; error: boolean; empty: boolean; onRetry: () => void; icon: keyof typeof Feather.glyphMap; emptyTitle: string; emptyText: string }) {
  const c = usePremiumColors();
  if (loading) return <View style={s.center}><ActivityIndicator color={c.primary} /></View>;
  if (error) return (
    <View style={[s.card, s.stateCard, { backgroundColor: c.profileCard, borderColor: c.border }]}>
      <Text style={{ color: c.mutedForeground, textAlign: "center" }}>Something went wrong loading this.</Text>
      <Pressable onPress={onRetry} testID="button-retry" style={[s.btn, { backgroundColor: c.primary }]}><Text style={{ color: c.primaryForeground, fontWeight: "700" }}>Try again</Text></Pressable>
    </View>
  );
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
  const me = useGetMyProfile();
  const mark = useMarkNotificationRead();
  const [readError, setReadError] = useState("");
  const counts = notes.data?.unreadCounts;
  const cards = [
    { key: "matches", title: "Matches", to: "/(tabs)/matches", count: counts?.matches ?? 0, icon: "heart" as const, color: "#ed4b89" },
    { key: "likes", title: "Likes", to: "/(tabs)/activity/likes", count: counts?.likes ?? 0, icon: "thumbs-up" as const, color: "#3b82f6" },
    { key: "views", title: "Views", to: "/(tabs)/activity/views", count: counts?.views ?? 0, icon: "eye" as const, color: "#16a394" },
    { key: "followers", title: "Followers", to: me.data?.id ? `/followers/${me.data.id}` : "", count: counts?.follows ?? 0, icon: "user" as const, color: "#8b5cf6" },
  ];
  const items = useMemo(() => (notes.data?.notifications ?? [])
    .filter(n => n.type === "new_match" || n.type === "new_like" || n.type === "new_super_like" || n.type === "profile_view" || n.type === "new_follow")
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [notes.data?.notifications]);

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
    if (n.type === "new_match" && n.matchId) {
      router.push({ pathname: "/chat/[matchId]", params: { matchId: n.matchId, returnTo: "activity" } });
      return;
    }
    router.push({ pathname: "/profile/[profileId]", params: { profileId: n.actor.id, returnTo: "activity" } });
  }

  return (
    <Screen title="Activity">
      <ScrollView contentContainerStyle={[s.activityContent, { paddingBottom: insets.bottom + 110 }]}>
        <View testID="activity-summary" accessibilityLabel="Activity summary" style={s.activityGrid}>
          {cards.map((card) => (
            <Pressable key={card.key} onPress={() => card.to && router.push(card.to as never)} testID={`link-summary-${card.key}`} accessibilityRole="button" accessibilityLabel={`${card.title}, ${card.count} unread`} disabled={!card.to} style={({ pressed }) => [s.activityMetric, { backgroundColor: c.profileCard, borderColor: c.border, opacity: !card.to ? 0.65 : pressed ? 0.86 : 1 }]}>
              <View style={[s.activityMetricIcon, { backgroundColor: card.color }]}><Feather name={card.icon} size={23} color="#fff" /></View>
              <View style={s.activityMetricCopy}>
                <Text style={[s.activityMetricCount, { color: c.foreground }]} testID={`text-count-${card.key}`}>{notes.isLoading ? "—" : card.count}</Text>
                <Text style={[s.activityMetricLabel, { color: c.mutedForeground }]}>{card.title}</Text>
              </View>
            </Pressable>
          ))}
        </View>
        {readError ? <Text accessibilityRole="alert" style={[s.activityReadError, { color: c.destructive }]}>{readError}</Text> : null}
        {notes.isLoading || (notes.isError && !notes.data) ? (
          <State loading={notes.isLoading} error={notes.isError} empty={false} onRetry={() => void notes.refetch()} icon="bell" emptyTitle="" emptyText="" />
        ) : null}
        {!notes.isLoading && !notes.isError && items.length === 0 ? (
          <View style={[s.activityEmpty, { borderColor: c.border }]} testID="status-empty-activity"><Feather name="heart" size={22} color={c.primary}/><Text style={{ color: c.mutedForeground, fontWeight: "700" }}>You’re all caught up</Text></View>
        ) : null}
        {items.length > 0 ? <View testID="activity-feed" accessibilityLabel="Activity feed">
          {items.map(n => {
            const event = n.type === "new_match"
              ? { label: "matched with you", icon: "heart" as const, color: "#ed4b89" }
              : n.type === "new_like" || n.type === "new_super_like"
                ? { label: n.type === "new_super_like" ? "super liked you" : "liked you", icon: "thumbs-up" as const, color: "#3b82f6" }
                : n.type === "profile_view"
                  ? { label: "viewed your profile", icon: "eye" as const, color: "#16a394" }
                  : { label: "followed you", icon: "user" as const, color: "#8b5cf6" };
            return <Pressable key={n.id} onPress={() => void openActivityItem(n)} testID={`activity-item-${n.id}`} accessibilityRole="button" accessibilityLabel={`${n.actor.name} ${event.label}, ${ago(n.createdAt)}${n.readAt ? ", read" : ", unread"}`} accessibilityState={{ disabled: false }} style={({ pressed }) => [s.activityRow, { borderBottomColor: c.border, opacity: n.readAt ? 0.56 : pressed ? 0.84 : 1 }]}>
              <View style={[s.activityFeedIcon, { backgroundColor: event.color }]}><Feather name={event.icon} size={19} color="#fff"/></View>
              <View style={s.activityFeedCopy}><Text numberOfLines={1} style={[s.activityFeedText, { color: c.foreground }]}><Text style={{ fontWeight: "800" }}>{n.actor.name}</Text> {event.label}</Text><Text style={[s.time, { color: c.mutedForeground }]}>{ago(n.createdAt)}</Text></View>
              {!n.readAt ? <View style={[s.dot, { backgroundColor: c.primary }]} accessibilityLabel="Unread"/> : null}
            </Pressable>;
          })}
        </View> : null}
      </ScrollView>
    </Screen>
  );
}

export function InboundPeoplePage({ kind }: { kind: "likes" | "views" }) {
  const readNotice = useNoticeReader();
  const c = usePremiumColors();
  const insets = useSafeAreaInsets();
  const isLikes = kind === "likes";
  const likes = useGetWhoLikedYou({ query: { queryKey: getGetWhoLikedYouQueryKey(), enabled: isLikes, ...live } });
  const views = useGetWhoViewedYou({ query: { queryKey: getGetWhoViewedYouQueryKey(), enabled: !isLikes, ...live } });
  const me = useGetMyProfile();
  const reaction = useCreateReaction();
  const dailyLikeStatus = useGetDailyLikeStatus();
  const [match, setMatch] = useState<{ profile: Profile; matchId: string | null } | null>(null);
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState("");
  const qc = useQueryClient();
  const q = isLikes ? likes : views;
  const seen = useSeenOnFocus(kind, q.isSuccess && !q.isFetching);
  useRefetchOnFocus([q.refetch]);
  const rows = useMemo(() => (isLikes ? (likes.data ?? []).map((l) => ({ profile: l.profile, at: l.likedAt, isSuperLike: l.isSuperLike })) : (views.data ?? []).map((v) => ({ profile: v.profile, at: v.viewedAt, isSuperLike: false }))), [isLikes, likes.data, views.data]);
  return (
     <Screen back title={isLikes ? "Dating Likes" : "Views"} sub={isLikes ? "People who liked your profile" : "People who viewed your profile"}>
      {actionError ? <Text accessibilityRole="alert" style={{ color: c.destructive, marginHorizontal: 18, marginBottom: 8 }}>{actionError}</Text> : null}
      <SeenError seen={seen} />
      {q.isLoading || (q.isError && !q.data) ? (
        <View style={s.list}><State loading={q.isLoading} error={q.isError && !q.data} empty={false} onRetry={() => void q.refetch()} icon={isLikes ? "heart" : "eye"} emptyTitle="" emptyText="" /></View>
      ) : !rows.length ? (
        isLikes ? (
          <View style={[s.emptyLikes, { backgroundColor: c.premiumBackground }]} testID="status-empty-likes">
            <View style={[s.emptyHeart, { backgroundColor: c.premiumSoft, borderColor: c.premiumBorder }]}>
              <Feather name="heart" size={32} color={c.premiumAccent} />
            </View>
            <Text style={[s.emptyTitle, { color: c.premiumForeground }]}>No new likes yet.</Text>
            <Text style={[s.emptySubtitle, { color: c.premiumMuted }]}>Keep swiping!</Text>
          </View>
        ) : <View style={s.list}><State loading={false} error={false} empty onRetry={() => void q.refetch()} icon="eye" emptyTitle="No views yet" emptyText="When someone opens your profile, they show up here." /></View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => `${r.profile.id}-${r.at}`}
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 110 }]}
          renderItem={({ item: r }) => (
             <View testID={`card-${kind}-profile-${r.profile.id}`} style={[s.card, { backgroundColor: c.profileCard, borderColor: c.border }]}>
              <View style={s.row}>
               <Pressable onPress={() => { readNotice(r.profile.id, isLikes ? "new_like" : "profile_view"); router.push({ pathname: "/profile/[profileId]", params: { profileId: r.profile.id, ...(isLikes ? { returnTo: "likes" } : {}) } } as never); }} testID={`link-${kind}-profile-${r.profile.id}`} accessibilityRole="button" accessibilityLabel={`View ${r.profile.name}'s profile`} style={[s.row, s.flex]}>
              <View style={[s.avatarRing, { borderColor: c.premiumAccent }]}><ProfileAvatar profile={r.profile} size={54} /></View>
              <View style={s.flex}>
                <Text numberOfLines={1} style={[s.name, { color: c.foreground }]}>{label(r.profile)}</Text>
                <Text style={{ color: c.mutedForeground, fontSize: 13 }}>{isLikes ? (r.isSuperLike ? "Super Liked your profile" : "Liked your profile") : "Viewed your profile"} · {ago(r.at)}</Text>
              </View>
              {isLikes ? <View style={[s.heartBadge, { backgroundColor: c.premiumSoft }]}><Feather name={r.isSuperLike ? "star" : "heart"} size={17} color={c.premiumAccent} /></View> : (
                <View style={[s.pill, { backgroundColor: c.profileChip }]}><Feather name="eye" size={14} color={c.primary} /><Text style={{ color: c.primary, fontWeight: "700", fontSize: 12 }}>View</Text></View>
              )}
               </Pressable>
              </View>
              {isLikes ? <View style={[s.likeActions, { borderTopColor: c.border }]}>
                <Pressable testID={`button-pass-like-${r.profile.id}`} accessibilityRole="button" disabled={reaction.isPending || busyId === r.profile.id}
                  onPress={async () => {
                    setBusyId(r.profile.id); setActionError("");
                    try {
                      await reaction.mutateAsync({ data: { toUserId: r.profile.id, type: "pass" } });
                      await Promise.all([
                        qc.invalidateQueries({ queryKey: getGetWhoLikedYouQueryKey() }),
                        qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey() }),
                      ]);
                    } catch { setActionError(`Your pass on ${r.profile.name} did not save. Please try again.`); }
                    finally { setBusyId(""); }
                  }}
                  style={[s.likeActionButton, { borderColor: c.border }]}
                ><Text style={{ color: c.mutedForeground, fontWeight: "800", fontSize: 12 }}>Pass</Text></Pressable>
                <Pressable testID={`button-like-back-${r.profile.id}`} accessibilityRole="button" disabled={reaction.isPending || busyId === r.profile.id || dailyLikeStatus.data?.remaining === 0}
                  onPress={async () => {
                    setBusyId(r.profile.id); setActionError("");
                    try {
                      const result = await reaction.mutateAsync({ data: { toUserId: r.profile.id, type: "like" } });
                      await Promise.all([
                        qc.invalidateQueries({ queryKey: getGetWhoLikedYouQueryKey() }),
                        qc.invalidateQueries({ queryKey: getGetMatchesQueryKey() }),
                        qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey() }),
                      ]);
                      if (result.matched) setMatch({ profile: r.profile, matchId: result.matchId ?? null });
                      else setActionError(`Your like to ${r.profile.name} was sent.`);
                    } catch { setActionError(`Your Like Back to ${r.profile.name} did not go through. Please try again.`); }
                    finally { setBusyId(""); }
                  }}
                  style={[s.likeActionButton, { backgroundColor: c.primary, borderColor: c.primary }]}
                ><Text style={{ color: c.primaryForeground, fontWeight: "800", fontSize: 12 }}>Like Back</Text></Pressable>
              </View> : null}
             </View>
          )}
        />
      )}
        <MatchCelebration visible={!!match} self={me.data ?? null} other={match?.profile ?? null} canMessage={!!match?.matchId}
          onMessage={() => { if (!match?.matchId) return; const matchId = match.matchId; setMatch(null); router.push({ pathname: "/chat/[matchId]", params: { matchId, returnTo: "likes" } }); }}
          onKeepSwiping={() => setMatch(null)} />
    </Screen>
  );
}

export function MutualMatchesPage() {
  const readNotice = useNoticeReader();
  const c = usePremiumColors();
  const insets = useSafeAreaInsets();
  const matches = useGetMatches({ query: { queryKey: getGetMatchesQueryKey(), ...live } });
  const seen = useSeenOnFocus("matches", matches.isSuccess && !matches.isFetching);
  useRefetchOnFocus([matches.refetch]);
  const list = useMemo(() => active(matches.data), [matches.data]);
  return (
    <Screen title="Matches">
      <SeenError seen={seen} />
      {matches.isLoading || (matches.isError && !matches.data) ? (
        <View style={s.list}><State loading={matches.isLoading} error={matches.isError && !matches.data} empty={!list.length} onRetry={() => void matches.refetch()} icon="users" emptyTitle="No matches yet" emptyText="When someone you like likes you back, you'll meet here." /></View>
      ) : !list.length ? (
        <View style={s.list}><Pressable onPress={() => router.navigate("/(tabs)" as never)} testID="link-empty-discover" style={[s.btn, { backgroundColor: c.primary }]}><Text style={{ color: c.primaryForeground, fontWeight: "700" }}>Explore profiles</Text></Pressable></View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(m) => m.id}
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 110 }]}
          renderItem={({ item: m }) => (
            <View style={[s.card, s.row, { backgroundColor: c.profileCard, borderColor: c.border }]} testID={`card-match-${m.id}`}>
              <Pressable onPress={() => { readNotice(m.profile.id, "new_match"); router.push({ pathname: "/chat/[matchId]", params: { matchId: m.id, returnTo: "matches" } } as never); }} testID={`link-match-name-${m.id}`} accessibilityLabel={`Chat with ${m.profile.name}`} style={[s.row, s.flex]}>
                <ProfileAvatar profile={m.profile} size={56} />
                <Text numberOfLines={1} style={[s.name, s.flex, { color: c.foreground }]}>{label(m.profile)}</Text>
              </Pressable>
              <Pressable onPress={() => { readNotice(m.profile.id, "new_match"); router.push({ pathname: "/chat/[matchId]", params: { matchId: m.id, returnTo: "matches" } } as never); }} testID={`link-match-chat-${m.id}`} accessibilityRole="button" accessibilityLabel={`Chat with ${m.profile.name}`} style={[s.chat, { backgroundColor: c.profileChip }]}>
                <Feather name="message-circle" size={20} color={c.primary} />
              </Pressable>
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  activityContent: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  activityGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  activityMetric: { width: "48.5%", minHeight: 92, flexGrow: 1, flexBasis: "45%", flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 17, padding: 12 },
  activityMetricIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  activityMetricCopy: { minWidth: 0, gap: 2 },
  activityMetricCount: { fontSize: 25, fontWeight: "800", lineHeight: 29, fontVariant: ["tabular-nums"] },
  activityMetricLabel: { fontSize: 13, fontWeight: "600" },
  activityRow: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 4, paddingVertical: 10 },
  activityFeedIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  activityFeedCopy: { flex: 1, minWidth: 0, gap: 4 },
  activityFeedText: { fontSize: 14 },
  activityReadError: { borderWidth: 1, borderRadius: 12, padding: 10, fontSize: 13 },
  activityEmpty: { minHeight: 120, alignItems: "center", justifyContent: "center", gap: 10, borderTopWidth: StyleSheet.hairlineWidth },
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
