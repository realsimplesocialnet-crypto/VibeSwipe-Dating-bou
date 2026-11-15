import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, AppState, FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getGetMatchesQueryKey, getGetNotificationsQueryKey, getGetWhoLikedYouQueryKey, getGetWhoViewedYouQueryKey,
  useGetMatches, useGetNotifications, useGetWhoLikedYou, useGetWhoViewedYou, useMarkNotificationRead,
  createUseMarkActivitySeen, type ActivityCategory,
  type Match, type Profile,
} from "@workspace/api-client-react";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useColors } from "@/hooks/useColors";

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
  const c = useColors();
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
  const c = useColors();
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
  const c = useColors();
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
  const readNotice = useNoticeReader();
  const c = useColors();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const notes = useGetNotifications({ query: { queryKey: getGetNotificationsQueryKey(), ...live } });
  const matches = useGetMatches({ query: { queryKey: getGetMatchesQueryKey(), ...live } });
  const likes = useGetWhoLikedYou({ query: { queryKey: getGetWhoLikedYouQueryKey(), ...live } });
  const views = useGetWhoViewedYou({ query: { queryKey: getGetWhoViewedYouQueryKey(), ...live } });
  useRefetchOnFocus([notes.refetch, matches.refetch, likes.refetch, views.refetch]);
  const mark = useMarkNotificationRead();
  const am = useMemo(() => active(matches.data), [matches.data]);
  const reelNotices = (notes.data?.notifications ?? []).filter(n => n.type === "reel_like");
  const msgs = useMemo(() => (notes.data?.notifications ?? []).filter(n => n.type === "new_message" && am.some(m => m.id === n.matchId && m.profile.id === n.actor.id)).slice(0, 8), [notes.data, am]);
  const superNotices = useMemo(() => (notes.data?.notifications ?? []).filter(n => n.type === "new_super_like" && likes.data?.some(l => l.profile.id === n.actor.id && l.isSuperLike)).slice(0, 8), [notes.data, likes.data]);
  const open = async (id: string, unread: boolean) => {
    if (unread) { try { await mark.mutateAsync({ notificationId: id }); } catch { /* navigate anyway */ } void qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey() }); }
    router.navigate("/(tabs)/views" as never);
  };
  const counts = notes.data?.unreadCounts;
  const cards = [
    { key: "matches", to: "/(tabs)/matches", title: "Mutual Matches", sub: "People you both said yes to", icon: "users" as const, n: am.length, ps: am.map((m) => m.profile), loading: matches.isLoading, badge: counts?.matches ?? 0 },
    { key: "likes", to: "/(tabs)/activity/likes", title: "Likes", sub: "People who liked you", icon: "heart" as const, n: likes.data?.length ?? 0, ps: (likes.data ?? []).map((l) => l.profile), loading: likes.isLoading, badge: counts?.likes ?? 0 },
    { key: "views", to: "/(tabs)/activity/views", title: "Views", sub: "People who viewed your profile", icon: "eye" as const, n: views.data?.length ?? 0, ps: (views.data ?? []).map((v) => v.profile), loading: views.isLoading, badge: counts?.views ?? 0 },
  ];
  return (
    <Screen title="Activity">
      <ScrollView contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 110 }]}>
        {reelNotices.map(n => <Pressable key={n.id} accessibilityRole="button"
          testID={`reel-like-notice-${n.id}`}
          onPress={async () => {
            if (!n.readAt) {
              try { await mark.mutateAsync({ notificationId: n.id }); } catch { /* Still open the profile. */ }
              void qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
            }
            router.push({ pathname: "/profile/[profileId]", params: { profileId: n.actor.id } });
          }}
          style={[s.notice, { backgroundColor: c.profileCard, borderColor: c.border }]}>
          <ProfileAvatar profile={n.actor} size={40} />
          <View style={s.flex}><Text style={[s.name, { color: c.primary }]}>{n.actor.name}</Text>
            <Text style={{ color: c.foreground }}>liked your video</Text></View>
          <Text style={[s.time, { color: c.mutedForeground }]}>{ago(n.createdAt)}</Text>
          {!n.readAt && <View style={[s.dot, { backgroundColor: c.primary }]} />}
        </Pressable>)}
        {notes.isLoading || (notes.isError && !notes.data) ? (
          <State loading={notes.isLoading} error={notes.isError} empty={false} onRetry={() => void notes.refetch()} icon="message-circle" emptyTitle="" emptyText="" />
        ) : msgs.map((n) => (
          <Pressable key={n.id} onPress={() => void open(n.id, !n.readAt)} disabled={mark.isPending} testID={`button-message-notice-${n.id}`} accessibilityRole="button" accessibilityLabel={`New message from ${n.actor.name}. Open Messages`} style={({ pressed }) => [s.notice, { backgroundColor: c.profileCard, borderColor: c.border, opacity: pressed ? 0.8 : 1 }]}>
            <Feather name="message-circle" size={17} color={c.primary} />
            <Text numberOfLines={1} style={[s.flex, { color: n.readAt ? c.mutedForeground : c.foreground, fontWeight: n.readAt ? "400" : "700" }]}>{n.actor.name} sent you a message</Text>
            <Text style={[s.time, { color: c.mutedForeground }]}>{ago(n.createdAt)}</Text>
            {!n.readAt && <View style={[s.dot, { backgroundColor: c.primary }]} />}
          </Pressable>
        ))}
        {superNotices.map(n => (
          <Pressable key={n.id} onPress={() => { readNotice(n.actor.id, "new_like"); router.push({ pathname: "/profile/[profileId]", params: { profileId: n.actor.id } }); }} testID={`super-like-notice-${n.id}`} accessibilityRole="button" accessibilityLabel={`${n.actor.name} Super Liked you. Open profile`} style={[s.notice, { backgroundColor: c.profileCard, borderColor: c.primary }]}>
            <View style={[s.iconBox, { backgroundColor: c.profileChip }]}><Feather name="star" size={22} color={c.primary} /></View>
            <View style={s.flex}><Text numberOfLines={1} style={[s.name, { color: c.foreground }]}>{n.actor.name}</Text><Text style={{ color: c.primary, fontWeight: "700" }}>Super Liked you</Text></View>
            <Text style={[s.time, { color: c.mutedForeground }]}>{ago(n.createdAt)}</Text>
            {!n.readAt && <View style={[s.dot, { backgroundColor: c.primary }]} />}
            <Feather name="chevron-right" size={17} color={c.primary} />
          </Pressable>
        ))}
        <View style={{ height: 18 }} />
        {cards.map((k) => (
          <Pressable key={k.key} onPress={() => router.push(k.to as never)} testID={`link-summary-${k.key}`} accessibilityRole="button" accessibilityLabel={`${k.title}, ${k.badge} new`} style={({ pressed }) => [s.card, s.row, { backgroundColor: c.profileCard, borderColor: c.border, opacity: pressed ? 0.85 : 1 }]}>
            <View style={[s.iconBox, { backgroundColor: c.profileChip }]}>
              <Feather name={k.icon} size={20} color={c.primary} />
              {k.badge > 0 && <View style={[s.badge, { backgroundColor: c.primary }]}><Text style={[s.badgeText, { color: c.primaryForeground }]}>{k.badge > 99 ? "99+" : k.badge}</Text></View>}
            </View>
            <View style={s.flex}>
              <Text style={[s.name, { color: c.foreground }]}>{k.title}</Text>
              <Text numberOfLines={1} style={{ color: c.mutedForeground, fontSize: 13 }}>{k.sub}</Text>
            </View>
            <View style={s.stack}>{k.ps.slice(0, 3).map((p, i) => <View key={p.id} style={[s.stackItem, { marginLeft: i ? -12 : 0, borderColor: c.profileCard }]}><ProfileAvatar profile={p} size={32} /></View>)}</View>
            <Text style={[s.count, { color: c.foreground }]} testID={`text-count-${k.key}`}>{k.loading ? "-" : k.badge}</Text>
            <Feather name="chevron-right" size={18} color={c.mutedForeground} />
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

export function InboundPeoplePage({ kind }: { kind: "likes" | "views" }) {
  const readNotice = useNoticeReader();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const isLikes = kind === "likes";
  const likes = useGetWhoLikedYou({ query: { queryKey: getGetWhoLikedYouQueryKey(), enabled: isLikes, ...live } });
  const views = useGetWhoViewedYou({ query: { queryKey: getGetWhoViewedYouQueryKey(), enabled: !isLikes, ...live } });
  const q = isLikes ? likes : views;
  const seen = useSeenOnFocus(kind, q.isSuccess && !q.isFetching);
  useRefetchOnFocus([q.refetch]);
  const rows = useMemo(() => (isLikes ? (likes.data ?? []).map((l) => ({ profile: l.profile, at: l.likedAt, isSuperLike: l.isSuperLike })) : (views.data ?? []).map((v) => ({ profile: v.profile, at: v.viewedAt, isSuperLike: false }))), [isLikes, likes.data, views.data]);
  return (
    <Screen back title={isLikes ? "Likes" : "Views"} sub={isLikes ? "People who liked you" : "People who viewed your profile"}>
      <SeenError seen={seen} />
      {q.isLoading || (q.isError && !q.data) || !rows.length ? (
        <View style={s.list}><State loading={q.isLoading} error={q.isError && !q.data} empty={!rows.length} onRetry={() => void q.refetch()} icon={isLikes ? "heart" : "eye"} emptyTitle={isLikes ? "No likes yet" : "No views yet"} emptyText={isLikes ? "When someone likes you, they show up here." : "When someone opens your profile, they show up here."} /></View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => `${r.profile.id}-${r.at}`}
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 110 }]}
          renderItem={({ item: r }) => (
            <Pressable onPress={() => { readNotice(r.profile.id, isLikes ? "new_like" : "profile_view"); router.push({ pathname: "/profile/[profileId]", params: { profileId: r.profile.id } } as never); }} testID={`link-${kind}-profile-${r.profile.id}`} accessibilityRole="button" accessibilityLabel={`View ${r.profile.name}'s profile`} style={({ pressed }) => [s.card, s.row, { backgroundColor: c.profileCard, borderColor: c.border, opacity: pressed ? 0.85 : 1 }]}>
              <ProfileAvatar profile={r.profile} size={56} />
              <View style={s.flex}>
                <Text numberOfLines={1} style={[s.name, { color: c.foreground }]}>{label(r.profile)}</Text>
                <Text style={{ color: c.mutedForeground, fontSize: 13 }}>{isLikes ? (r.isSuperLike ? "Super Liked you" : "Liked you") : "Viewed your profile"} · {ago(r.at)}</Text>
              </View>
              {isLikes ? <Feather name={r.isSuperLike ? "star" : "heart"} size={22} color={c.primary} /> : (
                <View style={[s.pill, { backgroundColor: c.profileChip }]}><Feather name="eye" size={14} color={c.primary} /><Text style={{ color: c.primary, fontWeight: "700", fontSize: 12 }}>View</Text></View>
              )}
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

export function MutualMatchesPage() {
  const readNotice = useNoticeReader();
  const c = useColors();
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
});
