import {
  getGetBlockedProfilesQueryKey,
  getGetDiscoverProfilesQueryKey,
  getGetMatchesQueryKey,
  useBlockProfile,
  useDeleteChat,
  useGetIcebreakers,
  useGetMatches,
  useReportProfile,
  useSendMessage,
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

export default function MatchesScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const matches = useGetMatches();
  const icebreakers = useGetIcebreakers();
  const blockProfile = useBlockProfile();
  const unblockProfile = useUnblockProfile();
  const reportProfile = useReportProfile();
  const deleteChat = useDeleteChat();
  const unmatch = useUnmatchMatch();
  const sendMessage = useSendMessage();
  const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null);
  const [showReportReasons, setShowReportReasons] = useState(false);
  const data = matches.data ?? [];

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

  async function sendIcebreaker(matchId: string, question: string) {
    try {
      await sendMessage.mutateAsync({ matchId, data: { content: question } });
      await queryClient.invalidateQueries({ queryKey: getGetMatchesQueryKey() });
      router.push({ pathname: "/chat/[matchId]", params: { matchId } } as never);
    } catch {
      Alert.alert("Could not send opener", "Please try again.");
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
      <Text style={[styles.title, { color: colors.foreground }]}>Your matches</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>A mutual like is a good place to start.</Text>
      {matches.isLoading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
      {matches.isError ? (
        <Pressable onPress={() => void matches.refetch()} style={styles.errorBox}>
          <Text style={[styles.errorText, { color: colors.destructive }]}>Couldn’t load matches. Tap to retry.</Text>
        </Pressable>
      ) : null}
      {!matches.isLoading && !matches.isError && !data.length ? (
        <View style={styles.emptyWrap}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.accent }]}>
            <Feather name="heart" size={25} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Your first match is out there</Text>
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>When you both like each other, you can start a conversation.</Text>
          <Pressable
            testID="explore-profiles-empty"
            onPress={() => router.push("/")}
            style={[styles.exploreButton, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.exploreButtonText}>Explore profiles</Text>
            <Feather name="arrow-right" size={17} color="#26111b" />
          </Pressable>
        </View>
      ) : null}
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !matches.isLoading && !matches.isError ? (
            <View style={[styles.matchesPlaceholder, { borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, styles.placeholderTitle, { color: colors.mutedForeground }]}>Your matches</Text>
              <Text style={[styles.last, { color: colors.mutedForeground }]}>New matches will appear here.</Text>
            </View>
          ) : undefined
        }
        renderItem={({ item }) => {
          const isBlocked = item.blockedByMe || item.blockedMe;
          const status = item.blockedByMe ? "Blocked" : item.blockedMe ? "Blocked you" : null;
          return (
            <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: "column", alignItems: "stretch", paddingVertical: 10 }]}>
              <View style={styles.matchTopRow}>
                <Pressable
                  testID={`match-${item.id}`}
                  disabled={isBlocked}
                  onPress={() => router.push({ pathname: "/chat/[matchId]", params: { matchId: item.id } } as never)}
                  style={styles.rowMain}
                >
                  <ProfileAvatar profile={item.profile} size={58} />
                  <View style={styles.copy}>
                    <Text style={[styles.name, { color: colors.foreground }]}>{item.profile.name}, {item.profile.age}</Text>
                    <Text numberOfLines={1} style={[styles.last, { color: colors.mutedForeground }]}>
                      {status ?? item.lastMessage ?? "Say hello and start a conversation"}
                    </Text>
                  </View>
                  {!isBlocked ? <Feather name="message-circle" size={20} color={colors.primary} /> : null}
                </Pressable>
                <Pressable
                  accessibilityLabel={`Actions for ${item.profile.name}`}
                  testID={`match-actions-${item.id}`}
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
              {status ? <Text style={[styles.blockedLabel, { color: colors.destructive }]}>{status}</Text> : null}
              {!isBlocked && !item.lastMessage && icebreakers.data?.length ? (
                <View style={styles.icebreakerPanel}>
                  <Text style={[styles.icebreakerHeading, { color: colors.mutedForeground }]}>Send a first message</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.icebreakerList}>
                    {icebreakers.data.slice(0, 3).map((prompt) => (
                      <Pressable
                        key={prompt.id}
                        disabled={sendMessage.isPending}
                        onPress={() => void sendIcebreaker(item.id, prompt.question)}
                        style={[styles.icebreakerChip, { borderColor: colors.border, backgroundColor: colors.background }]}
                      >
                        <Text numberOfLines={2} style={[styles.icebreakerText, { color: colors.foreground }]}>{prompt.question}</Text>
                        <Feather name="arrow-up-right" size={13} color={colors.primary} />
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
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
  matchTopRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  rowMain: { flex: 1, minHeight: 78, flexDirection: "row", alignItems: "center", gap: 11 },
  icebreakerPanel: { paddingTop: 8, gap: 7 },
  icebreakerHeading: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  icebreakerList: { gap: 7, paddingRight: 3 },
  icebreakerChip: { width: 190, minHeight: 48, borderWidth: 1, borderRadius: 13, paddingHorizontal: 10, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 7 },
  icebreakerText: { flex: 1, fontSize: 10, fontWeight: "600" },
  copy: { flex: 1, gap: 5 },
  name: { fontSize: 15, fontWeight: "700" },
  last: { fontSize: 12 },
  blockedLabel: { fontSize: 11, fontWeight: "700" },
  actionTrigger: { paddingHorizontal: 5, paddingVertical: 12 },
  errorBox: { paddingVertical: 12 },
  errorText: { fontSize: 13 },
  emptyWrap: { alignItems: "center", marginTop: 50, paddingHorizontal: 25, gap: 10 },
  emptyIcon: { width: 62, height: 62, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  empty: { fontSize: 13, textAlign: "center", lineHeight: 20, marginTop: 5 },
  exploreButton: { minHeight: 48, borderRadius: 15, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 12 },
  exploreButtonText: { color: "#26111b", fontSize: 14, fontWeight: "800" },
  matchesPlaceholder: { borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 8, gap: 5 },
  placeholderTitle: { fontSize: 10, letterSpacing: 1, textTransform: "uppercase" },
  sectionTitle: { fontSize: 17, fontWeight: "700", marginBottom: 2 },
  modalScrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.58)", padding: 12 },
  actionSheet: { maxHeight: "82%", borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 24 },
  sheetHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 12 },
  sheetTitle: { fontSize: 17, fontWeight: "700" },
  actionRow: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: StyleSheet.hairlineWidth },
  actionText: { fontSize: 15, fontWeight: "600" },
});
