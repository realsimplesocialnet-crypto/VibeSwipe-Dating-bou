import { useAuth } from "@clerk/expo";
import { getGetProfileReelsQueryKey, useGetReel, useRecordReelView } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePremiumColors } from "@/hooks/useColors";
import { mediaUri } from "@/lib/media";

export default function ProfileReelScreen() {
  const { reelId, returnTo } = useLocalSearchParams<{ reelId: string; returnTo?: string }>();
  const colors = usePremiumColors();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const recordView = useRecordReelView();
  const viewRecorded = useRef(false);
  const [token, setToken] = useState<string | null>(null);
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
    if (router.canGoBack()) {
      router.back();
    } else if (returnTo) {
      router.replace(returnTo as never);
    } else {
      router.replace("/(tabs)/profile");
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back to profile" onPress={goBack} style={styles.back}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Reels</Text>
          <View style={styles.back} />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  page: { flex: 1, paddingHorizontal: 12 },
  header: { height: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 19, fontWeight: "800" },
  videoStage: { flex: 1, minHeight: 200, borderRadius: 18, overflow: "hidden", backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  caption: { paddingHorizontal: 4, paddingVertical: 14, gap: 5 },
  creator: { fontSize: 15, fontWeight: "700" },
  captionText: { fontSize: 14, lineHeight: 20 },
  message: { alignItems: "center", gap: 10 },
  messageText: { fontSize: 15 },
  retry: { fontWeight: "700" },
});
