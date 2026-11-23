import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, AppState, Image, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useColors } from "@/hooks/useColors";

const domain = process.env.EXPO_PUBLIC_DOMAIN;
const origin = (process.env.EXPO_PUBLIC_WEB_URL || (domain ? `https://${domain}` : "")).replace(/\/$/, "");
const asset = (name: string) => `${origin}/api/vibeswipe/onboarding-art/${name}`;

export function OnboardingVideoBackground({ form = false }: { form?: boolean }) {
  const colors = useColors();
  const [reduced, setReduced] = useState(false);
  const [choice, setChoice] = useState<boolean | null>(null);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(true);
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

  return (
    <View pointerEvents="none" accessible accessibilityRole="image"
      accessibilityLabel="Onboarding animation preview"
      accessibilityActions={[{ name: "toggleAnimation", label: playing ? "Pause animation" : "Resume animation" }]}
      onAccessibilityAction={event => {
        if (event.nativeEvent.actionName !== "toggleAnimation") return;
        if (playing) { setChoice(false); player.pause(); }
        else { setChoice(true); setRetry(value => value + 1); }
      }}
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}>
      <Image source={{ uri: asset("poster-v1.webp") }} style={StyleSheet.absoluteFill} resizeMode="cover"/>
      <VideoView player={player} style={[StyleSheet.absoluteFill, { opacity: ready ? 1 : 0 }]} contentFit="cover"
        onFirstFrameRender={() => setReady(true)} nativeControls={false} surfaceType="textureView"/>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: form ? colors.background : "#111111", opacity: form ? .12 : .16 }]}/>
    </View>
  );
}
