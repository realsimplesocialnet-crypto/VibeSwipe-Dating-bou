import { Feather } from "@expo/vector-icons";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, type AudioSource } from "expo-audio";
import { VideoView, useVideoPlayer } from "expo-video";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { formatVoiceDuration } from "@workspace/api-client-react";
import { mediaUri } from "@/lib/media";

export function ChatAudioMessage({
  reference,
  duration,
  token,
  foreground,
  getToken,
}: {
  reference: string;
  duration: number;
  token: string | null;
  foreground: string;
  getToken?: () => Promise<string | null>;
}) {
  const uri = mediaUri(reference);
  const [source, setSource] = useState<AudioSource | null>(null);
  // Fetch only after Play. Keeping the file locally also avoids expired bearer
  // tokens interrupting a seek many minutes into a long recording.
  const player = useAudioPlayer(source, { downloadFirst: true, updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const safeDuration = Math.max(1, Number.isFinite(status.duration) && status.duration > 0 ? status.duration : duration || 1);
  const [wantsPlay, setWantsPlay] = useState(false);
  const [error, setError] = useState("");
  const [speed, setSpeed] = useState(1);
  const [trackWidth, setTrackWidth] = useState(1);
  const [scrub, setScrub] = useState<number | null>(null);
  const origin = useRef(0);
  const seconds = scrub ?? status.currentTime ?? 0;
  const progress = Math.min(1, Math.max(0, seconds / safeDuration));
  useEffect(() => {
    if (wantsPlay && status.isLoaded) { player.play(); setWantsPlay(false); }
  }, [wantsPlay, status.isLoaded, player]);
  useEffect(() => {
    if (status.isLoaded) { player.shouldCorrectPitch = true; player.setPlaybackRate(speed); }
  }, [status.isLoaded, speed, player]);
  const seek = (seconds: number) => player.seekTo(Math.max(0, Math.min(safeDuration, seconds))).catch(() => setError("Couldn’t seek. Try again."));
  const gestures = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => status.isLoaded,
    onMoveShouldSetPanResponder: () => status.isLoaded,
    onPanResponderGrant: event => { origin.current = Math.max(0, Math.min(1, event.nativeEvent.locationX / trackWidth)) * safeDuration; setScrub(origin.current); },
    onPanResponderMove: (_, gesture) => setScrub(Math.max(0, Math.min(safeDuration, origin.current + gesture.dx / trackWidth * safeDuration))),
    onPanResponderRelease: (_, gesture) => {
      void player.seekTo(Math.max(0, Math.min(safeDuration, origin.current + gesture.dx / trackWidth * safeDuration))).catch(() => setError("Couldn’t seek. Try again."));
      setScrub(null);
    },
    onPanResponderTerminate: () => setScrub(null),
  }), [status.isLoaded, trackWidth, safeDuration, player]);
  async function toggle() {
    setError("");
    try {
      await setAudioModeAsync({ playsInSilentMode: true });
      if (!source || status.playbackState === "error") {
        const freshToken = getToken ? await getToken() : token;
        if (!uri || !freshToken) throw new Error("Sign in again to play this voice note.");
        setSource({ uri, headers: { Authorization: `Bearer ${freshToken}` } });
        setWantsPlay(true);
      } else if (status.playing) player.pause();
      else if (!status.isLoaded) setWantsPlay(true);
      else {
        if (status.didJustFinish || status.currentTime >= safeDuration - .1) await player.seekTo(0);
        player.play();
      }
    } catch (error) { setError(error instanceof Error ? error.message : "Couldn’t play voice note."); }
  }

  return (
    <View style={styles.audioWrap}>
      <Pressable
        testID="play-voice-note"
        accessibilityRole="button"
        accessibilityLabel={status.playing ? "Pause voice note" : `Play ${safeDuration} second voice note`}
        onPress={() => void toggle()}
        style={styles.audioPlay}
      >
        {wantsPlay && !status.isLoaded ? <ActivityIndicator size="small" color={foreground}/> : <Feather name={status.playing ? "pause" : "play"} size={17} color={foreground} />}
      </Pressable>
      <View style={styles.audioTrackWrap}>
        <View testID="seek-voice-note" accessibilityRole="adjustable" accessibilityLabel="Voice note position"
          accessibilityValue={{ min: 0, max: Math.floor(safeDuration), now: Math.floor(seconds) }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={event => { if (status.isLoaded) void seek(seconds + (event.nativeEvent.actionName === "increment" ? 10 : -10)); }}
          onLayout={event => setTrackWidth(Math.max(1, event.nativeEvent.layout.width))}
          {...gestures.panHandlers} style={styles.audioSeek}>
          <View pointerEvents="none" style={styles.audioTrack}>
            <View style={[styles.audioProgress, { backgroundColor: foreground, width: `${Math.round(progress * 100)}%` }]} />
          </View>
        </View>
        <View style={styles.audioDetails}>
          <Text style={[styles.audioDuration, { color: foreground }]}>{formatVoiceDuration(status.didJustFinish ? Math.ceil(safeDuration) : seconds)} / {formatVoiceDuration(Math.ceil(safeDuration))}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Playback speed ${speed}x`} onPress={() => {
            const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
            player.shouldCorrectPitch = true; player.setPlaybackRate(next); setSpeed(next);
          }} style={styles.audioSpeed}><Text style={[styles.audioDuration, { color: foreground }]}>{speed}x</Text></Pressable>
        </View>
        {error || status.playbackState === "error" ? <Text accessibilityRole="alert" style={[styles.audioDuration, { color: foreground }]}>{error || "Audio couldn’t load. Tap Play to retry."}</Text> : null}
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
  audioSeek: { height: 28, justifyContent: "center" },
  audioDetails: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  audioSpeed: { minWidth: 32, minHeight: 30, alignItems: "center", justifyContent: "center" },
  audioTrack: { width: "100%", height: 4, borderRadius: 2, backgroundColor: "rgba(120,110,120,0.35)", overflow: "hidden" },
  audioProgress: { height: "100%", backgroundColor: "#ffffff", borderRadius: 2 },
  audioDuration: { fontSize: 10, opacity: 0.8 },
  video: { width: "100%", height: "100%" },
});
