import {
  getGetBlockedProfilesQueryKey,
  getGetDiscoverProfilesQueryKey,
  getGetMatchesQueryKey,
  useBlockProfile,
  useDeleteChat,
  useGetMatches,
  useGetWhoViewedYou,
  useGetNotifications,
  useReportProfile,
  useUnblockProfile,
  useUnmatchMatch,
  type Profile,
  type ReportInputReason,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

type ActionTarget = {
  profile: Profile;
  matchId?: string;
  blockedByMe: boolean;
  blockedMe?: boolean;
};

const reportReasons: { reason: ReportInputReason; label: string }[] = [
  { reason: "spam", label: "Spam" },
  { reason: "fake", label: "Fake profile" },
  { reason: "inappropriate", label: "Inappropriate content" },
  { reason: "harassment", label: "Harassment" },
  { reason: "other", label: "Other" },
];

function timeAgo(value?: string | null): string {
  if (!value) return "";
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  if (!Number.isFinite(elapsed)) return "";
  if (elapsed < 60_000) return "Just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  if (elapsed < 604_800_000) return `${Math.floor(elapsed / 86_400_000)}d ago`;
  return new Date(value).toLocaleDateString();
}

export default function MessagesScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const matches = useGetMatches({ query: { refetchInterval: 10_000, refetchOnMount: "always", staleTime: 0 } });
  const blockProfile = useBlockProfile();
  const unblockProfile = useUnblockProfile();
  const reportProfile = useReportProfile();
  const deleteChat = useDeleteChat();
  const unmatch = useUnmatchMatch();
  const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null);
  const [showReportReasons, setShowReportReasons] = useState(false);
  const chats = useMemo(() => (matches.data ?? []).filter((m) => !m.profile.isDemo && !m.blockedByMe && !m.blockedMe).sort((a, b) =>
    new Date(b.lastMessageAt ?? b.updatedAt).getTime() - new Date(a.lastMessageAt ?? a.updatedAt).getTime()), [matches.data]);

  async function refreshSafetyAndLists() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetMatchesQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetBlockedProfilesQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetDiscoverProfilesQueryKey() }),
    ]);
  }

  async function block(target: ActionTarget) {
    try {
      await blockProfile.mutateAsync({ data: { targetUserId: target.profile.id } });
      await refreshSafetyAndLists();
    } catch {
      Alert.alert("Could not block profile", "Please try again.");
    }
  }

  async function unblock(target: ActionTarget) {
    try {
      await unblockProfile.mutateAsync({ targetUserId: target.profile.id });
      await refreshSafetyAndLists();
    } catch {
      Alert.alert("Could not unblock profile", "Please try again.");
    }
  }

  async function report(target: ActionTarget, reason: ReportInputReason) {
    try {
      await reportProfile.mutateAsync({ data: { targetUserId: target.profile.id, reason } });
      Alert.alert("Report submitted", "Thank you. We’ll review this profile.");
    } catch {
      Alert.alert("Could not submit report", "Please try again.");
    }
  }

  function confirmDeleteChat(target: ActionTarget) {
    if (!target.matchId) return;
    Alert.alert("Delete this chat?", "This hides the conversation only for you. The other person will still have their chat.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete chat",
        style: "destructive",
        onPress: () => {
          void deleteChat.mutateAsync({ matchId: target.matchId! })
            .then(() => queryClient.invalidateQueries({ queryKey: getGetMatchesQueryKey() }))
            .catch(() => Alert.alert("Could not delete chat", "Please try again."));
        },
      },
    ]);
  }

  function confirmUnmatch(target: ActionTarget) {
    if (!target.matchId) return;
    Alert.alert(
      "Unmatch?",
      "This deletes the shared match and chat for both of you. You may see each other again in Discover.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unmatch",
          style: "destructive",
          onPress: () => {
            void unmatch.mutateAsync({ matchId: target.matchId! })
              .then(refreshSafetyAndLists)
              .catch(() => Alert.alert("Could not unmatch", "Please try again."));
          },
        },
      ],
    );
  }

  function openActions(target: ActionTarget) {
    setShowReportReasons(false);
    setActionTarget(target);
  }

  const actionBusy = blockProfile.isPending || unblockProfile.isPending || reportProfile.isPending
    || deleteChat.isPending || unmatch.isPending;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.messagesBackground }}><View style={styles.screen}>
      <View style={[styles.brandHeader, { justifyContent: "flex-end" }]}><Pressable accessibilityRole="button" accessibilityLabel="Notifications" onPress={() => router.push("/(tabs)/activity")} style={{ padding: 8 }}><Feather name="bell" size={24} color={colors.foreground}/></Pressable></View>
      <Text style={[styles.title, { color: colors.foreground }]}>Messages</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Only mutual matches appear here. <Feather name="heart" size={16} color={colors.primary}/></Text>
      {matches.isLoading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
      {matches.isError ? (
        <Pressable onPress={() => void matches.refetch()} style={styles.errorBox}>
          <Text style={[styles.errorText, { color: colors.destructive }]}>Couldn’t load conversations. Tap to retry.</Text>
        </Pressable>
      ) : null}
      {!matches.isLoading && !matches.isError && !chats.length ? (
        <View style={styles.empty}>
          <Feather name="message-circle" size={30} color={colors.primary} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No conversations yet</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Match with someone to start chatting.</Text>
        </View>
      ) : null}
      <FlatList
        data={chats}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isBlocked = item.blockedByMe || item.blockedMe;
          const status = item.blockedByMe ? "You blocked this person" : item.blockedMe ? "Messaging unavailable" : null;
          const unread = !isBlocked && (item.unreadCount ?? 0) > 0;
          const stamp = item.lastMessageAt ?? item.updatedAt;
          return (
            <View style={[styles.row, { backgroundColor: colors.profileCard, borderColor: colors.border }]}>
              <Pressable
                disabled={isBlocked}
                onPress={() => router.push({ pathname: "/chat/[matchId]", params: { matchId: item.id, returnTo: "messages" } } as never)}
                style={styles.rowMain}
                testID={`conversation-${item.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Open chat with ${item.profile.name}${unread ? `, ${item.unreadCount} unread` : ""}`}
              >
                <ProfileAvatar profile={item.profile} size={64} />
                <View style={styles.copy}>
                  <Text numberOfLines={1} style={[styles.name, { color: colors.foreground }]}>{item.profile.name} <Feather name="heart" size={14} color={colors.primary}/></Text>
                  <Text numberOfLines={2} style={[styles.last, { color: status ? colors.destructive : unread ? colors.foreground : colors.mutedForeground, fontWeight: unread ? "600" : "400" }]}>
                    {status ?? item.lastMessage ?? "You matched. Say hello."}
                  </Text>
                </View>
                <View style={styles.meta}>
                  <Text style={[styles.time, { color: colors.mutedForeground }]}>{timeAgo(stamp)}</Text>
                  {unread ? <View testID={`unread-${item.id}`} accessibilityLabel={`${item.unreadCount} unread messages`} style={[styles.badge, { backgroundColor: colors.primary }]}><Text style={[styles.badgeText, { color: colors.chatOnAccent }]}>{item.unreadCount! > 99 ? "99+" : item.unreadCount}</Text></View> : <View style={styles.dotSpace} />}
                </View>
              </Pressable>
              <Pressable
                accessibilityLabel={`Actions for ${item.profile.name}`}
                testID={`conversation-actions-${item.id}`}
                onPress={() => openActions({
                  profile: item.profile,
                  matchId: item.id,
                  blockedByMe: item.blockedByMe,
                  blockedMe: item.blockedMe,
                })}
                style={styles.actionTrigger}
              >
                <Feather name="more-horizontal" size={21} color={colors.mutedForeground} />
              </Pressable>
            </View>
          );
        }}
        refreshing={matches.isRefetching}
        onRefresh={() => void matches.refetch()}
      />
      <Modal
        visible={actionTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActionTarget(null)}
      >
        <View style={styles.modalScrim}>
          <View style={[styles.actionSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sheetHeading}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
                {showReportReasons ? "Report profile" : actionTarget?.profile.name}
              </Text>
              <Pressable testID="close-actions" onPress={() => setActionTarget(null)} hitSlop={10}>
                <Feather name="x" size={21} color={colors.foreground} />
              </Pressable>
            </View>
            <ScrollView>
              {showReportReasons ? reportReasons.map(({ reason, label }) => (
                <Pressable
                  key={reason}
                  testID={`report-reason-${reason}`}
                  disabled={actionBusy}
                  onPress={() => {
                    if (actionTarget) void report(actionTarget, reason);
                    setActionTarget(null);
                  }}
                  style={[styles.actionRow, { borderTopColor: colors.border }]}
                >
                  <Text style={[styles.actionText, { color: colors.foreground }]}>{label}</Text>
                  <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
                </Pressable>
              )) : actionTarget ? (
                <>
                  <Pressable
                    testID="report-profile"
                    disabled={actionBusy}
                    onPress={() => setShowReportReasons(true)}
                    style={[styles.actionRow, { borderTopColor: colors.border }]}
                  >
                    <Text style={[styles.actionText, { color: colors.foreground }]}>Report</Text>
                    <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
                  </Pressable>
                  <Pressable
                    testID={actionTarget.blockedByMe ? "unblock-profile" : "block-profile"}
                    disabled={actionBusy}
                    onPress={() => {
                      const target = actionTarget;
                      setActionTarget(null);
                      if (target.blockedByMe) {
                        void unblock(target);
                      } else {
                        Alert.alert("Block this profile?", "You will no longer see each other or be able to chat.", [
                          { text: "Cancel", style: "cancel" },
                          { text: "Block", style: "destructive", onPress: () => void block(target) },
                        ]);
                      }
                    }}
                    style={[styles.actionRow, { borderTopColor: colors.border }]}
                  >
                    <Text style={[styles.actionText, { color: actionTarget.blockedByMe ? colors.primary : colors.destructive }]}>
                      {actionTarget.blockedByMe ? "Unblock" : "Block"}
                    </Text>
                    <Feather name={actionTarget.blockedByMe ? "user-check" : "slash"} size={17} color={actionTarget.blockedByMe ? colors.primary : colors.destructive} />
                  </Pressable>
                  {actionTarget.matchId ? (
                    <>
                      <Pressable
                        testID={`delete-chat-${actionTarget.matchId}`}
                        disabled={actionBusy}
                        onPress={() => {
                          const target = actionTarget;
                          setActionTarget(null);
                          confirmDeleteChat(target);
                        }}
                        style={[styles.actionRow, { borderTopColor: colors.border }]}
                      >
                        <Text style={[styles.actionText, { color: colors.foreground }]}>Delete chat</Text>
                        <Feather name="trash-2" size={17} color={colors.mutedForeground} />
                      </Pressable>
                      <Pressable
                        testID={`unmatch-${actionTarget.matchId}`}
                        disabled={actionBusy}
                        onPress={() => {
                          const target = actionTarget;
                          setActionTarget(null);
                          confirmUnmatch(target);
                        }}
                        style={[styles.actionRow, { borderTopColor: colors.border }]}
                      >
                        <Text style={[styles.actionText, { color: colors.destructive }]}>Unmatch</Text>
                        <Feather name="user-x" size={17} color={colors.destructive} />
                      </Pressable>
                    </>
                  ) : null}
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View></SafeAreaView>
  );
}

export function VisitorsScreen() {
  const colors = useColors();
  const visitors = useGetWhoViewedYou({ query: { refetchInterval: 30_000, refetchOnMount: "always" } });
  const notifications = useGetNotifications({ query: { refetchInterval: 30_000 } });
  const unread = Object.values(notifications.data?.unreadCounts ?? {}).some((count) => count > 0);
  return <LinearGradient colors={[colors.profileGradientStart, colors.profileGradientMiddle, colors.profileGradientEnd]} style={{ flex: 1 }}><SafeAreaView edges={["top"]} style={visitorStyles.screen} testID="visitors-page">
    <View style={[visitorStyles.header, { borderBottomColor: colors.border, justifyContent: "flex-end" }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Notifications" onPress={() => router.push("/(tabs)/activity")}><Feather name="bell" size={25} color={colors.foreground} />{unread ? <View style={{ position: "absolute", right: 0, top: 0, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} /> : null}</Pressable>
    </View>
    <Text style={[visitorStyles.title, { color: colors.foreground }]}>Who viewed you</Text>
    <Text style={[visitorStyles.subtitle, { color: colors.mutedForeground }]}>People who viewed your profile recently</Text>
    <FlatList
      data={visitors.data ?? []}
      keyExtractor={(item) => item.profile.id}
      contentContainerStyle={visitorStyles.list}
      refreshing={visitors.isRefetching}
      onRefresh={() => void visitors.refetch()}
      ListEmptyComponent={visitors.isLoading ? <ActivityIndicator color={colors.primary} /> : visitors.isError ? <Pressable onPress={() => void visitors.refetch()} style={visitorStyles.empty}><Text style={{ color: colors.destructive, textAlign: "center" }}>Couldn’t load profile visitors. Tap to retry.</Text></Pressable> : <Text style={[visitorStyles.empty, { color: colors.mutedForeground }]}>No profile views yet.</Text>}
      renderItem={({ item: { profile } }) => <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${profile.name}'s profile`}
        testID={`card-visitor-${profile.id}`}
        onPress={() => router.push({ pathname: "/profile/[profileId]", params: { profileId: profile.id } })}
        style={[visitorStyles.card, { backgroundColor: colors.profileCard, borderColor: colors.border, shadowColor: colors.foreground }]}
      >
        <View style={[visitorStyles.avatarRing, { borderColor: colors.primary }]}><ProfileAvatar profile={profile} size={62} /></View>
        <View style={visitorStyles.copy}>
          <Text style={[visitorStyles.name, { color: colors.foreground }]}>{profile.name}{profile.age != null ? `, ${profile.age}` : ""} <Feather name="heart" size={15} color={colors.primary} /></Text>
          <View style={{ flexDirection: "row", gap: 5, alignItems: "flex-start" }}><Feather name="map-pin" size={15} color={colors.primary} /><Text style={[visitorStyles.location, { color: colors.mutedForeground, flex: 1 }]}>{profile.city?.trim() || profile.state?.trim() || profile.country?.trim() || "Location not shared"}</Text></View>
        </View>
        <Feather name="chevron-right" size={21} color={colors.primary} />
      </Pressable>}
    />
  </SafeAreaView></LinearGradient>;
}

const visitorStyles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 12, paddingHorizontal: 18 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 12, marginBottom: 16 },
  logo: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  logoText: { fontSize: 25, fontWeight: "900", lineHeight: 28 },
  title: { fontSize: 34, lineHeight: 42, fontFamily: Platform.OS === "ios" ? "Georgia" : "serif", fontWeight: "700", letterSpacing: -0.7 },
  subtitle: { fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: 22 },
  list: { gap: 12, paddingBottom: 100 },
  card: { flexDirection: "row", alignItems: "center", gap: 15, paddingHorizontal: 16, paddingVertical: 20, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  avatarRing: { borderWidth: 1, padding: 3, borderRadius: 36 },
  copy: { flex: 1, gap: 5 },
  name: { fontWeight: "700", fontSize: 17, lineHeight: 23 },
  location: { fontSize: 13, lineHeight: 20 },
  empty: { textAlign: "center", paddingVertical: 32 },
});

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 90 },
  brandHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  wordmark: { flexDirection: "row", alignItems: "center", gap: 10 },
  monogram: { fontSize: 34, fontWeight: "900", letterSpacing: -3 },
  brandName: { fontSize: 22, fontWeight: "800" },
  title: { fontSize: 38, fontWeight: "800", letterSpacing: -1.3 },
  subtitle: { fontSize: 14, marginTop: 8, marginBottom: 22 },
  badge: { minWidth: 28, height: 28, paddingHorizontal: 6, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: 13, fontWeight: "800" },
  loading: { marginTop: 40 },
  list: { paddingBottom: 18 },
  row: { minHeight: 96, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, paddingHorizontal: 12, marginBottom: 12, shadowColor: "#7a3a5a", shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  meta: { alignSelf: "stretch", alignItems: "flex-end", justifyContent: "space-between", paddingVertical: 18 },
  dot: { width: 11, height: 11, borderRadius: 6 },
  dotSpace: { height: 11 },
  time: { fontSize: 12 },
  rowMain: { flex: 1, minHeight: 78, flexDirection: "row", alignItems: "center", gap: 12 },
  copy: { flex: 1, gap: 5 },
  name: { fontSize: 17, fontWeight: "700" },
  last: { fontSize: 14 },
  blockedLabel: { fontSize: 11, fontWeight: "700" },
  actionTrigger: { paddingHorizontal: 5, paddingVertical: 12 },
  empty: { alignItems: "center", marginTop: 78, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: "700" },
  errorBox: { paddingVertical: 12 },
  errorText: { fontSize: 13 },
  sectionTitle: { fontSize: 17, fontWeight: "700", marginBottom: 2 },
  modalScrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.58)", padding: 12 },
  actionSheet: { maxHeight: "82%", borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 24 },
  sheetHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 12 },
  sheetTitle: { fontSize: 17, fontWeight: "700" },
  actionRow: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: StyleSheet.hairlineWidth },
  actionText: { fontSize: 15, fontWeight: "600" },
});
