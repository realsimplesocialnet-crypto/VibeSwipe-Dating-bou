import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, AppState, Image, Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const domain = process.env.EXPO_PUBLIC_DOMAIN;
const origin = (process.env.EXPO_PUBLIC_WEB_URL || (domain ? `https://${domain}` : "")).replace(/\/$/, "");
const asset = (name: string) => `${origin}/api/vibeswipe/onboarding-art/${name}`;

export function OnboardingVideoBackground({ form = false }: { form?: boolean }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [reduced, setReduced] = useState(true);
  const [choice, setChoice] = useState<boolean | null>(null);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(AppState.currentState === "active");
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const loaded = useRef(false);
  const player = useVideoPlayer(null, instance => {
    instance.loop = true;
    instance.muted = true;
    instance.audioMixingMode = "mixWithOthers";
  });

  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (alive) setReduced(value); }).catch(() => {});
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    const state = AppState.addEventListener("change", value => setActive(value === "active"));
    const playback = player.addListener("playingChange", event => setPlaying(event.isPlaying));
    const status = player.addListener("statusChange", event => {
      if (event.status === "error") {
        loaded.current = false;
        setReady(false);
        setPlaying(false);
      }
    });
    return () => { alive = false; motion.remove(); state.remove(); playback.remove(); status.remove(); };
  }, [player]);

  const shouldPlay = !!origin && focused && active && (choice ?? !reduced);
  useEffect(() => {
    let alive = true;
    if (!shouldPlay) player.pause();
    else void (async () => {
      try {
        if (!loaded.current) {
          await player.replaceAsync({ uri: asset("loop-v1.mp4") });
          loaded.current = true;
        }
        if (alive) player.play();
      } catch { if (alive) setPlaying(false); }
    })();
    // useVideoPlayer releases the native player itself on unmount.
    return () => { alive = false; };
  }, [shouldPlay, player, retry]);

  return <>
    <View pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFill, { backgroundColor: "#ebdfd1" }]}>
      <Image source={{ uri: asset("poster-v1.webp") }} style={StyleSheet.absoluteFill} resizeMode="cover"/>
      <VideoView player={player} style={[StyleSheet.absoluteFill, { opacity: ready ? 1 : 0 }]} contentFit="cover"
        onFirstFrameRender={() => setReady(true)} nativeControls={false} surfaceType="textureView"/>
      {form && <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, opacity: .86 }]}/>}
    </View>
    <Pressable accessibilityRole="button"
      accessibilityLabel={playing ? "Pause onboarding animation" : "Play onboarding animation"}
      testID="onboarding-motion"
      onPress={() => {
        if (playing) { setChoice(false); player.pause(); }
        else { setChoice(true); setRetry(value => value + 1); }
      }}
      style={[styles.control, { top: insets.top + 12 }, form ? { left: "50%", marginLeft: -22 } : { right: 18 }]}>
      <Feather name={playing ? "pause" : "play"} size={18} color="#35293a"/>
    </Pressable>
  </>;
}

const styles = StyleSheet.create({
  control: { position: "absolute", zIndex: 10, width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.92)",
    borderWidth: 1, borderColor: "rgba(92,66,67,.12)" },
});
