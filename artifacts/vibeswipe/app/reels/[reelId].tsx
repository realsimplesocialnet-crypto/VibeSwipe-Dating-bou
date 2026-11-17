import { useAuth } from "@clerk/expo";
import {
  getGetMatchesQueryKey,
  getGetProfileReelsQueryKey,
  getGetReelQueryKey,
  useGetMatches,
  useGetReel,
  useRecordReelShare,
  useRecordReelView,
  useSendMessage,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { usePremiumColors } from "@/hooks/useColors";
import { mediaUri } from "@/lib/media";
import { ProfileAvatar } from "@/components/ProfileAvatar";

export default function ProfileReelScreen() {
  const { reelId, returnTo } = useLocalSearchParams<{ reelId: string; returnTo?: string }>();
  const colors = usePremiumColors();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [token, setToken] = useState<string | null>(null);
  const [shareVisible, setShareVisible] = useState(false);
  const [pendingMatchId, setPendingMatchId] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<Record<string, boolean>>({});
  const [shareError, setShareError] = useState("");
  const recordView = useRecordReelView();
  const recordShare = useRecordReelShare();
  const matches = useGetMatches({
    query: { queryKey: getGetMatchesQueryKey(), enabled: shareVisible },
  });
  const sendMessage = useSendMessage();
  const viewRecorded = useRef(false);
  const reelQuery = useGetReel(reelId ?? "", { query: { enabled: Boolean(reelId) } });

  useEffect(() => {
    let active = true;
    void getToken().then((value) => {
      if (active) setToken(value);
    });
    return () => {
      active = false;
    };
  }, [getToken]);

  const uri = reelQuery.data ? mediaUri(reelQuery.data.videoReference) : null;
  const source = useMemo(
    () => uri && token ? { uri, headers: { Authorization: `Bearer ${token}` } } : null,
    [token, uri],
  );
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = false;
  });

  useEffect(() => {
    if (!source) return;
    const update = (status: string) => {
      if (status === "readyToPlay") {
        player.play();
        if (reelQuery.data && !reelQuery.data.isOwner && !viewRecorded.current) {
          viewRecorded.current = true;
          recordView.mutate({ reelId: reelId ?? "" }, {
            onSuccess: () => {
              void queryClient.invalidateQueries({
                queryKey: getGetProfileReelsQueryKey({ profileId: reelQuery.data!.creatorId }),
              });
            },
          });
        }
      }
    };
    update(player.status);
    const subscription = player.addListener("statusChange", (event) => update(event.status));
    return () => subscription.remove();
  }, [player, source, reelQuery.data, recordView, reelId, queryClient]);

  function goBack() {
    if (returnTo) {
      router.replace(returnTo as never);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/profile");
    }
  }

  async function shareToMatch(matchId: string) {
    const reel = reelQuery.data;
    if (!reel || pendingMatchId || sentTo[matchId]) return;
    setPendingMatchId(matchId);
    setShareError("");
    try {
      await sendMessage.mutateAsync({
        matchId,
        data: { content: `Shared a Reel: /reels/${reel.id}` },
      });
      setSentTo((current) => ({ ...current, [matchId]: true }));
      void queryClient.invalidateQueries({ queryKey: getGetMatchesQueryKey() });
      try {
        const result = await recordShare.mutateAsync({ reelId: reel.id });
        queryClient.setQueryData(getGetReelQueryKey(reel.id), (current) =>
          current ? { ...current, shareCount: result.shareCount } : current,
        );
        void queryClient.invalidateQueries({
          queryKey: getGetProfileReelsQueryKey({ profileId: reel.creatorId }),
        });
      } catch {
        setShareError("Sent, but the share count could not be updated.");
      }
    } catch {
      setShareError("That Reel did not send. Try again.");
    } finally {
      setPendingMatchId(null);
    }
  }

  const shareChats = (matches.data ?? []).filter((match) => !match.blockedByMe && !match.blockedMe);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back to profile" onPress={goBack} style={styles.back}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Reels</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Share Reel, ${reelQuery.data?.shareCount ?? 0} shares`}
            testID="button-share-reel"
            disabled={!reelQuery.data}
            onPress={() => {
              setShareError("");
              setShareVisible(true);
            }}
            style={styles.shareButton}
          >
            <Feather name="share-2" size={18} color={colors.primary} />
            <Text style={[styles.shareButtonText, { color: colors.primary }]}>Share</Text>
            {reelQuery.data ? <Text style={[styles.shareCount, { color: colors.mutedForeground }]}>{reelQuery.data.shareCount}</Text> : null}
          </Pressable>
        </View>
        <View style={styles.videoStage}>
          {source ? (
            <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls />
          ) : reelQuery.isLoading || !token ? (
            <ActivityIndicator color={colors.primary} />
          ) : reelQuery.isError ? (
            <View style={styles.message}>
              <Text style={[styles.messageText, { color: colors.foreground }]}>This Reel is unavailable.</Text>
              <Pressable accessibilityRole="button" onPress={() => void reelQuery.refetch()}><Text style={[styles.retry, { color: colors.primary }]}>Try again</Text></Pressable>
            </View>
          ) : null}
        </View>
        {reelQuery.data ? (
          <View style={styles.caption}>
            <Text style={[styles.creator, { color: colors.foreground }]}>
              {reelQuery.data.creatorName}{reelQuery.data.creatorAge ? `, ${reelQuery.data.creatorAge}` : ""}
            </Text>
            {reelQuery.data.caption ? <Text style={[styles.captionText, { color: colors.mutedForeground }]}>{reelQuery.data.caption}</Text> : null}
          </View>
        ) : null}
      </View>
      <Modal transparent visible={shareVisible} animationType="slide" onRequestClose={() => setShareVisible(false)}>
        <View style={styles.shareBackdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close Reel sharing"
            onPress={() => setShareVisible(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.shareSheet, { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 18) }]}>
            <View style={styles.shareHeading}>
              <Text style={[styles.shareTitle, { color: colors.foreground }]}>Share Reel</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setShareVisible(false)} style={styles.closeShare}>
                <Feather name="x" size={20} color={colors.foreground} />
              </Pressable>
            </View>
            {shareError ? <Text accessibilityRole="alert" style={[styles.shareError, { color: colors.destructive }]}>{shareError}</Text> : null}
            <Text style={[styles.shareSectionTitle, { color: colors.mutedForeground }]}>SEND IN A CHAT</Text>
            {matches.isLoading ? (
              <ActivityIndicator color={colors.primary} style={styles.shareLoading} />
            ) : matches.isError ? (
              <Pressable accessibilityRole="button" onPress={() => void matches.refetch()} style={styles.shareEmpty}>
                <Text style={[styles.shareEmptyText, { color: colors.mutedForeground }]}>Chats could not load. Tap to retry.</Text>
              </Pressable>
            ) : !shareChats.length ? (
              <Text style={[styles.shareEmptyText, { color: colors.mutedForeground }]}>Only mutual matches can receive a Reel in chat.</Text>
            ) : (
              <ScrollView style={styles.shareList} keyboardShouldPersistTaps="handled">
                {shareChats.map((match) => {
                  const sent = sentTo[match.id];
                  const pending = pendingMatchId === match.id;
                  return (
                    <Pressable
                      key={match.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${sent ? "Sent to" : "Send Reel to"} ${match.profile.name}`}
                      testID={`button-share-to-${match.id}`}
                      disabled={Boolean(pendingMatchId) || sent}
                      onPress={() => void shareToMatch(match.id)}
                      style={[styles.shareRecipient, { backgroundColor: colors.background }, sent && styles.shareRecipientSent]}
                    >
                      <ProfileAvatar profile={match.profile} size={42} />
                      <Text numberOfLines={1} style={[styles.shareRecipientName, { color: colors.foreground }]}>{match.profile.name}</Text>
                      <View style={[styles.sendPill, { backgroundColor: sent ? colors.secondary : colors.primary }]}>
                        {sent ? <Feather name="check" size={14} color={colors.secondaryForeground} /> : null}
                        <Text style={[styles.sendPillText, { color: sent ? colors.secondaryForeground : colors.primaryForeground }]}>
                          {sent ? "Sent" : pending ? "Sending" : "Send"}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  page: { flex: 1, paddingHorizontal: 12 },
  header: { height: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 19, fontWeight: "800" },
  shareButton: { minWidth: 78, height: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  shareButtonText: { fontSize: 13, fontWeight: "800" },
  shareCount: { fontSize: 11, fontWeight: "700" },
  videoStage: { flex: 1, minHeight: 200, borderRadius: 18, overflow: "hidden", backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  caption: { paddingHorizontal: 4, paddingVertical: 14, gap: 5 },
  creator: { fontSize: 15, fontWeight: "700" },
  captionText: { fontSize: 14, lineHeight: 20 },
  message: { alignItems: "center", gap: 10 },
  messageText: { fontSize: 15 },
  retry: { fontWeight: "700" },
  shareBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" },
  shareSheet: { maxHeight: "72%", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 12 },
  shareHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  shareTitle: { fontSize: 18, fontWeight: "800" },
  closeShare: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  shareError: { marginTop: 3, fontSize: 12, fontWeight: "600" },
  shareSectionTitle: { marginTop: 10, marginBottom: 6, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  shareLoading: { paddingVertical: 28 },
  shareEmpty: { minHeight: 76, justifyContent: "center" },
  shareEmptyText: { paddingVertical: 15, fontSize: 13, lineHeight: 19 },
  shareList: { marginBottom: 4 },
  shareRecipient: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 11, borderRadius: 16, paddingHorizontal: 10, marginVertical: 3 },
  shareRecipientSent: { opacity: 0.76 },
  shareRecipientName: { flex: 1, fontSize: 14, fontWeight: "700" },
  sendPill: { minWidth: 68, minHeight: 34, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 18, paddingHorizontal: 11 },
  sendPillText: { fontSize: 12, fontWeight: "800" },
});
