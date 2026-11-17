import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  getGetNotificationsQueryKey,
  getGetProfileFollowSummaryQueryKey,
  getGetProfileFollowersQueryKey,
  getGetProfileFollowingQueryKey,
  useFollowProfile,
  useGetMyProfile,
  useGetProfileFollowSummary,
  useGetProfileFollowers,
  useGetProfileFollowing,
  useUnfollowProfile,
} from "@workspace/api-client-react";
import type { ProfileFollowList } from "@workspace/api-client-react";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { usePremiumColors } from "@/hooks/useColors";

type FollowEntry = ProfileFollowList["entries"][number];

export function ProfileFollowButton({ profileId, viewerId, isFollowing: initialIsFollowing, followsYou, checking = false, onChange }: {
  profileId: string;
  viewerId?: string;
  isFollowing: boolean;
  followsYou: boolean;
  checking?: boolean;
  onChange?: (following: boolean) => void;
}) {
  const colors = usePremiumColors();
  const client = useQueryClient();
  const follow = useFollowProfile();
  const unfollow = useUnfollowProfile();
  const [override, setOverride] = useState<{ base: boolean; value: boolean } | null>(null);
  const [error, setError] = useState("");
  const isFollowing = override?.base === initialIsFollowing ? override.value : initialIsFollowing;
  const pending = follow.isPending || unfollow.isPending;

  async function toggle() {
    if (pending) return;
    const next = !isFollowing;
    const previous = isFollowing;
    setError("");
    setOverride({ base: initialIsFollowing, value: next });
    try {
      if (next) {
        const summary = await follow.mutateAsync({ profileId });
        client.setQueryData(getGetProfileFollowSummaryQueryKey(profileId), summary);
      } else {
        await unfollow.mutateAsync({ profileId });
        client.setQueryData(getGetProfileFollowSummaryQueryKey(profileId), (old: {
          followersCount: number; followingCount: number; isFollowing: boolean; followsYou: boolean;
        } | undefined) => old ? { ...old, followersCount: Math.max(0, old.followersCount - 1), isFollowing: false } : old);
      }
      await Promise.all([
        client.invalidateQueries({ queryKey: getGetProfileFollowSummaryQueryKey(profileId) }),
        viewerId ? client.invalidateQueries({ queryKey: getGetProfileFollowSummaryQueryKey(viewerId) }) : Promise.resolve(),
        client.invalidateQueries({ queryKey: getGetProfileFollowersQueryKey() }),
        client.invalidateQueries({ queryKey: getGetProfileFollowingQueryKey() }),
        client.invalidateQueries({ queryKey: getGetNotificationsQueryKey() }),
      ]);
      onChange?.(next);
    } catch {
      setOverride({ base: initialIsFollowing, value: previous });
      setError(next ? "Could not follow. Try again." : "Could not unfollow. Try again.");
    }
  }

  return (
    <View style={styles.actionWrap}>
      <Pressable
        testID={`button-follow-${profileId}`}
        accessibilityRole="button"
        accessibilityState={{ disabled: pending, selected: isFollowing }}
        accessibilityLabel={isFollowing ? `Unfollow ${profileId}` : followsYou ? `Follow ${profileId} back` : `Follow ${profileId}`}
        disabled={pending || checking}
        onPress={() => void toggle()}
        style={({ pressed }) => [
          styles.followButton,
          { borderColor: colors.profileEdit, backgroundColor: isFollowing ? "transparent" : colors.profileEdit, opacity: pending ? 0.55 : pressed ? 0.8 : 1 },
        ]}
      >
        {pending || checking ? <ActivityIndicator size="small" color={colors.profileEdit} /> : (
          <>
            {!isFollowing && <Feather name="user-plus" size={14} color={colors.profileEditForeground} />}
            <Text style={{ color: isFollowing ? colors.profileEdit : colors.profileEditForeground, fontWeight: "800", fontSize: 12 }}>
              {isFollowing ? "Following" : followsYou ? "Follow back" : "Follow"}
            </Text>
          </>
        )}
      </Pressable>
      {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
    </View>
  );
}

export function ProfileFollowNotificationAction({ profileId, viewerId, onFollow }: {
  profileId: string;
  viewerId?: string;
  onFollow: () => void;
}) {
  const summary = useGetProfileFollowSummary(profileId, {
    query: { queryKey: getGetProfileFollowSummaryQueryKey(profileId), refetchOnMount: "always" },
  });
  if (!summary.data?.followsYou || summary.data.isFollowing) return null;
  return <ProfileFollowButton
    profileId={profileId}
    viewerId={viewerId}
    isFollowing={summary.data.isFollowing}
    followsYou={summary.data.followsYou}
    onChange={(following) => { if (following) onFollow(); }}
  />;
}

export function ProfileFollowStats({ profileId, viewerId, showAction = true, datingAction }: {
  profileId: string;
  viewerId?: string;
  showAction?: boolean;
  datingAction?: ReactNode;
}) {
  const colors = usePremiumColors();
  const query = useGetProfileFollowSummary(profileId, {
    query: {
      queryKey: getGetProfileFollowSummaryQueryKey(profileId),
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      staleTime: 0,
    },
  });
  const checkingRelationship = query.isFetching && !query.data?.isFollowing && !query.data?.followsYou;
  return (
    <View style={styles.statsWrap} testID="profile-follow-stats">
      <View style={[styles.stats, { backgroundColor: colors.profileCard, borderColor: colors.border }]}>
        <Pressable
          testID="link-profile-followers"
          accessibilityRole="button"
          accessibilityLabel={`${query.data?.followersCount ?? 0} followers`}
          onPress={() => router.push({ pathname: "/followers/[profileId]", params: { profileId } })}
          style={styles.stat}
        >
          <Text style={[styles.statValue, { color: colors.profileLabel }]}>{query.isLoading ? "—" : query.data?.followersCount ?? 0}</Text>
          <Text style={[styles.statLabel, { color: colors.profileMuted }]}>Followers</Text>
        </Pressable>
        <View style={[styles.statRule, { backgroundColor: colors.profileRule }]} />
        <Pressable
          testID="link-profile-following"
          accessibilityRole="button"
          accessibilityLabel={`${query.data?.followingCount ?? 0} following`}
          onPress={() => router.push({ pathname: "/following/[profileId]", params: { profileId } })}
          style={styles.stat}
        >
          <Text style={[styles.statValue, { color: colors.profileLabel }]}>{query.isLoading ? "—" : query.data?.followingCount ?? 0}</Text>
          <Text style={[styles.statLabel, { color: colors.profileMuted }]}>Following</Text>
        </Pressable>
      </View>
      {showAction && viewerId && viewerId !== profileId ? (
        <View style={styles.actionsRow}>
          {query.data
            ? <ProfileFollowButton profileId={profileId} viewerId={viewerId} isFollowing={query.data.isFollowing} followsYou={query.data.followsYou} checking={checkingRelationship} />
            : <View style={[styles.actionPlaceholder, { backgroundColor: colors.profileCard, borderColor: colors.border }]}><Text style={{ color: colors.profileMuted, fontWeight: "700", fontSize: 12 }}>{query.isError ? "Unavailable" : "Loading…"}</Text></View>}
          {datingAction}
        </View>
      ) : null}
    </View>
  );
}

function FollowRow({ entry, viewerId }: { entry: FollowEntry; viewerId?: string }) {
  const colors = usePremiumColors();
  const profile = entry.profile;
  const place = [profile.city, profile.state, profile.country].filter(Boolean).join(", ");
  return (
    <View style={[styles.row, { backgroundColor: colors.profileCard, borderColor: colors.border }]}>
      <Pressable
        testID={`follow-profile-${profile.id}`}
        accessibilityRole="button"
        accessibilityLabel={`Open ${profile.name}'s profile`}
        onPress={() => router.push({ pathname: "/profile/[profileId]", params: { profileId: profile.id } })}
      >
        <ProfileAvatar profile={profile} size={48} />
      </Pressable>
      <Pressable
        onPress={() => router.push({ pathname: "/profile/[profileId]", params: { profileId: profile.id } })}
        style={styles.rowCopy}
      >
        <Text numberOfLines={1} style={[styles.rowName, { color: colors.profileLabel }]}>
          {profile.name}{profile.showAge !== false && profile.age !== null ? `, ${profile.age}` : ""}
        </Text>
        <Text numberOfLines={1} style={[styles.rowPlace, { color: colors.profileMuted }]}>{place || "Location not shared"}</Text>
      </Pressable>
      <ProfileFollowButton profileId={profile.id} viewerId={viewerId} isFollowing={entry.isFollowing} followsYou={entry.followsYou} />
    </View>
  );
}

export function ProfileFollowListScreen({ kind }: { kind: "followers" | "following" }) {
  const colors = usePremiumColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ profileId?: string }>();
  const profileId = typeof params.profileId === "string" ? params.profileId : "";
  const me = useGetMyProfile();
  const [typedSearch, setTypedSearch] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [entries, setEntries] = useState<FollowEntry[]>([]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(typedSearch.trim());
      setOffset(0);
      setEntries([]);
    }, 250);
    return () => clearTimeout(timer);
  }, [typedSearch]);
  const queryParams = { profileId, offset, limit: 30, ...(search ? { search } : {}) };
  const followers = useGetProfileFollowers(queryParams, { query: { queryKey: getGetProfileFollowersQueryKey(queryParams), enabled: !!profileId && kind === "followers" } });
  const following = useGetProfileFollowing(queryParams, { query: { queryKey: getGetProfileFollowingQueryKey(queryParams), enabled: !!profileId && kind === "following" } });
  const query = kind === "followers" ? followers : following;
  const data = query.data;
  useEffect(() => {
    if (!data) return;
    setEntries(current => offset === 0 ? data.entries : [
      ...current,
      ...data.entries.filter(entry => !current.some(item => item.profile.id === entry.profile.id)),
    ]);
  }, [data, offset]);
  const title = kind === "followers" ? "Followers" : "Following";
  const noRowsText = search ? "No people found. Try a different name." : kind === "followers" ? "No followers yet." : "Not following anyone yet.";

  return (
    <KeyboardAvoidingView style={[styles.page, { backgroundColor: colors.messagesBackground }]} behavior="padding">
      <View style={[styles.pageHead, { paddingTop: insets.top + 12 }]}>
        <Pressable
          testID="button-back-profile-follows"
          accessibilityRole="button"
          accessibilityLabel="Back to profile"
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/profile" as never)}
          style={[styles.back, { backgroundColor: colors.profileCard, borderColor: colors.border }]}
        >
          <Feather name="arrow-left" size={17} color={colors.profileLabel} />
          <Text style={{ color: colors.profileLabel, fontWeight: "700" }}>Back</Text>
        </Pressable>
        <Text accessibilityRole="header" style={[styles.pageTitle, { color: colors.foreground }]}>{title}</Text>
      </View>
      <View style={[styles.search, { backgroundColor: colors.profileCard, borderColor: colors.border }]}>
        <Feather name="search" size={17} color={colors.profileMuted} />
        <TextInput
          testID={`input-search-${kind}`}
          accessibilityLabel={`Search ${title.toLowerCase()}`}
          value={typedSearch}
          onChangeText={setTypedSearch}
          placeholder={`Search ${title.toLowerCase()}`}
          placeholderTextColor={colors.profileMuted}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.searchInput, { color: colors.profileLabel }]}
        />
        {typedSearch ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setTypedSearch("")}><Feather name="x" size={17} color={colors.profileMuted} /></Pressable> : null}
      </View>
      {query.isLoading && !data ? <ActivityIndicator color={colors.primary} style={{ marginTop: 28 }} />
        : query.isError && !data ? (
          <View style={styles.empty}>
            <Text style={{ color: colors.profileMuted, textAlign: "center" }}>Couldn’t load this list.</Text>
            <Pressable onPress={() => void query.refetch()} style={[styles.retry, { backgroundColor: colors.profileEdit }]}><Text style={{ color: colors.profileEditForeground, fontWeight: "800" }}>Try again</Text></Pressable>
          </View>
        ) : !entries.length ? (
          <View style={styles.empty}><Feather name="users" size={26} color={colors.profileEdit} /><Text style={[styles.emptyText, { color: colors.profileMuted }]}>{noRowsText}</Text></View>
        ) : (
          <FlatList
            data={entries}
            keyExtractor={(entry) => entry.profile.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 24, gap: 9 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            renderItem={({ item }) => <FollowRow entry={item} viewerId={me.data?.id} />}
            ListFooterComponent={data?.nextOffset !== null && data?.nextOffset !== undefined ? (
              <Pressable
                testID="button-load-more-follows"
                disabled={query.isFetching}
                onPress={() => setOffset(data.nextOffset!)}
                style={[styles.loadMore, { backgroundColor: colors.profileCard, borderColor: colors.border }]}
              >
                {query.isFetching ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={{ color: colors.primary, fontWeight: "800" }}>Load more</Text>}
              </Pressable>
            ) : undefined}
          />
        )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  pageHead: { paddingHorizontal: 18, paddingBottom: 12 },
  back: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 10 },
  pageTitle: { fontSize: 34, fontWeight: "800", letterSpacing: -1.2 },
  statsWrap: { width: "100%", gap: 9, marginTop: 12 },
  stats: { flex: 1, minHeight: 58, borderWidth: 1, borderRadius: 15, flexDirection: "row", alignItems: "center" },
  stat: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 7 },
  statValue: { fontSize: 22, lineHeight: 25, fontWeight: "900" },
  statLabel: { fontSize: 11, fontWeight: "600" },
  statRule: { width: StyleSheet.hairlineWidth, height: 34 },
  actionsRow: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  actionPlaceholder: { flex: 1, minHeight: 42, borderWidth: 1.5, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  actionWrap: { flex: 1, minWidth: 0, alignItems: "center" },
  followButton: { width: "100%", minHeight: 42, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  error: { fontSize: 10, textAlign: "center", marginTop: 2 },
  search: { marginHorizontal: 16, minHeight: 48, borderWidth: 1, borderRadius: 15, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 9 },
  searchInput: { flex: 1, minWidth: 0, height: 48, fontSize: 15 },
  row: { minHeight: 72, borderWidth: 1, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 10 },
  rowCopy: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 15, fontWeight: "800" },
  rowPlace: { fontSize: 11, marginTop: 2 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 26 },
  emptyText: { fontSize: 15, textAlign: "center" },
  retry: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  loadMore: { minHeight: 44, borderWidth: 1, borderRadius: 13, alignItems: "center", justifyContent: "center", marginTop: 8 },
});
