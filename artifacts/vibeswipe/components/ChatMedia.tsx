import { Feather } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { VideoView, useVideoPlayer } from "expo-video";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { mediaUri } from "@/lib/media";

export function ChatAudioMessage({
  reference,
  duration,
  token,
  foreground,
}: {
  reference: string;
  duration: number;
  token: string | null;
  foreground: string;
}) {
  const uri = mediaUri(reference);
  const player = useAudioPlayer(uri ? { uri, headers: token ? { Authorization: `Bearer ${token}` } : undefined } : null);
  const status = useAudioPlayerStatus(player);
  const safeDuration = Math.max(1, duration || status.duration || 1);
  const progress = Math.min(1, Math.max(0, (status.currentTime ?? 0) / safeDuration));

  return (
    <View style={styles.audioWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={status.playing ? "Pause voice note" : `Play ${safeDuration} second voice note`}
        onPress={() => status.playing ? player.pause() : player.play()}
        style={styles.audioPlay}
      >
        <Feather name={status.playing ? "pause" : "play"} size={17} color={foreground} />
      </Pressable>
      <View style={styles.audioTrackWrap}>
        <View style={styles.audioTrack}>
          <View style={[styles.audioProgress, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <Text style={[styles.audioDuration, { color: foreground }]}>{Math.floor(safeDuration)}s voice note</Text>
      </View>
    </View>
  );
}

export function ChatVideoViewer({ reference, token, onReady, onError }: { reference: string; token: string | null; onReady?: () => void; onError?: () => void }) {
  const uri = mediaUri(reference);
  const player = useVideoPlayer(uri ? { uri, headers: token ? { Authorization: `Bearer ${token}` } : undefined } : null, (instance) => {
    instance.loop = false;
  });
  useEffect(() => {
    const update = (status: string) => { if (status === "readyToPlay") onReady?.(); if (status === "error") onError?.(); };
    update(player.status);
    const subscription = player.addListener("statusChange", event => update(event.status));
    return () => subscription.remove();
  }, [player, onReady, onError]);

  return (
    <VideoView
      player={player}
      style={styles.video}
      contentFit="contain"
      nativeControls
    />
  );
}

const styles = StyleSheet.create({
  audioWrap: { width: 210, minHeight: 38, flexDirection: "row", alignItems: "center", gap: 10 },
  audioPlay: { width: 31, height: 31, alignItems: "center", justifyContent: "center" },
  audioTrackWrap: { flex: 1, gap: 4 },
  audioTrack: { width: "100%", height: 4, borderRadius: 2, backgroundColor: "rgba(120,110,120,0.35)", overflow: "hidden" },
  audioProgress: { height: "100%", backgroundColor: "#ffffff", borderRadius: 2 },
  audioDuration: { fontSize: 10, opacity: 0.8 },
  video: { width: "100%", height: "100%" },
});
