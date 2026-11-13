import {
  getGetBlockedProfilesQueryKey,
  getGetDiscoverProfilesQueryKey,
  getGetMatchesQueryKey,
  useBlockProfile,
  useDeleteChat,
  useGetBlockedProfiles,
  useGetMatches,
  useReportProfile,
  useUnblockProfile,
  useUnmatchMatch,
  type Profile,
  type ReportInputReason,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ProfileAvatar } from "@/components/ProfileAvatar";
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

export default function ChatsScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const matches = useGetMatches({ query: { refetchInterval: 10_000 } });
  const blockedProfiles = useGetBlockedProfiles();
  const blockProfile = useBlockProfile();
  const unblockProfile = useUnblockProfile();
  const reportProfile = useReportProfile();
  const deleteChat = useDeleteChat();
  const unmatch = useUnmatchMatch();
  const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null);
  const [showReportReasons, setShowReportReasons] = useState(false);
  const chats = matches.data ?? [];

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
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>Conversations</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Only your mutual matches can message you.</Text>
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
          const status = item.blockedByMe ? "Blocked" : item.blockedMe ? "Blocked you" : null;
          return (
            <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Pressable
                disabled={isBlocked}
                onPress={() => router.push({ pathname: "/chat/[matchId]", params: { matchId: item.id } } as never)}
                style={styles.rowMain}
                testID={`conversation-${item.id}`}
              >
                <ProfileAvatar profile={item.profile} />
                <View style={styles.copy}>
                  <Text style={[styles.name, { color: colors.foreground }]}>{item.profile.name}</Text>
                  <Text numberOfLines={1} style={[styles.last, { color: colors.mutedForeground }]}>
                    {status ?? item.lastMessage ?? "Send the first message"}
                  </Text>
                </View>
                {!isBlocked ? <Feather name="chevron-right" size={18} color={colors.mutedForeground} /> : null}
              </Pressable>
              {status ? <Text style={[styles.blockedLabel, { color: colors.destructive }]}>{status}</Text> : null}
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
        ListFooterComponent={
          <View style={styles.blockedSection}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Blocked profiles</Text>
            {blockedProfiles.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
            {blockedProfiles.isError ? (
              <Pressable onPress={() => void blockedProfiles.refetch()}>
                <Text style={[styles.last, { color: colors.destructive }]}>Couldn’t load blocked profiles. Tap to retry.</Text>
              </Pressable>
            ) : null}
            {!blockedProfiles.isLoading && !blockedProfiles.isError && !blockedProfiles.data?.length ? (
              <Text style={[styles.last, { color: colors.mutedForeground }]}>Profiles you block will appear here.</Text>
            ) : null}
            {blockedProfiles.data?.map(({ profile }) => (
              <View key={profile.id} style={[styles.blockedRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <ProfileAvatar profile={profile} size={46} />
                <View style={styles.copy}>
                  <Text style={[styles.name, { color: colors.foreground }]}>{profile.name}</Text>
                  <Text style={[styles.blockedLabel, { color: colors.destructive }]}>Blocked</Text>
                </View>
                <Pressable
                  testID={`unblock-${profile.id}`}
                  disabled={unblockProfile.isPending}
                  onPress={() => void unblock({ profile, blockedByMe: true })}
                  style={[styles.unblockButton, { borderColor: colors.border }]}
                >
                  <Text style={[styles.unblockText, { color: colors.primary }]}>Unblock</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={`More actions for ${profile.name}`}
                  onPress={() => openActions({ profile, blockedByMe: true })}
                  style={styles.actionTrigger}
                >
                  <Feather name="more-horizontal" size={20} color={colors.mutedForeground} />
                </Pressable>
              </View>
            ))}
          </View>
        }
        refreshing={matches.isRefetching}
        onRefresh={() => void Promise.all([matches.refetch(), blockedProfiles.refetch()])}
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20, paddingTop: 70, paddingBottom: 90 },
  title: { fontSize: 27, fontWeight: "700", letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 6, marginBottom: 16 },
  loading: { marginTop: 40 },
  list: { paddingBottom: 18 },
  row: { minHeight: 88, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 11, marginBottom: 9 },
  rowMain: { flex: 1, minHeight: 78, flexDirection: "row", alignItems: "center", gap: 12 },
  copy: { flex: 1, gap: 5 },
  name: { fontSize: 15, fontWeight: "700" },
  last: { fontSize: 12 },
  blockedLabel: { fontSize: 11, fontWeight: "700" },
  actionTrigger: { paddingHorizontal: 5, paddingVertical: 12 },
  empty: { alignItems: "center", marginTop: 78, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: "700" },
  errorBox: { paddingVertical: 12 },
  errorText: { fontSize: 13 },
  blockedSection: { paddingTop: 26, gap: 11 },
  sectionTitle: { fontSize: 17, fontWeight: "700", marginBottom: 2 },
  blockedRow: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 11, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 11, marginBottom: 8 },
  unblockButton: { minHeight: 34, justifyContent: "center", borderWidth: 1, borderRadius: 9, paddingHorizontal: 11 },
  unblockText: { fontSize: 12, fontWeight: "700" },
  modalScrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.58)", padding: 12 },
  actionSheet: { maxHeight: "82%", borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 24 },
  sheetHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 12 },
  sheetTitle: { fontSize: 17, fontWeight: "700" },
  actionRow: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: StyleSheet.hairlineWidth },
  actionText: { fontSize: 15, fontWeight: "600" },
});
