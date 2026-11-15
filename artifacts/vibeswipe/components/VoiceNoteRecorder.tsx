import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { File } from "expo-file-system";
import { formatVoiceDuration } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

type Note = { uri: string; duration: number };
function removeTemporaryFile(uri?: string | null) {
  if (!uri) return;
  try { const file = new File(uri); if (file.exists) file.delete(); }
  catch { /* The OS can already have cleared its temporary cache. */ }
}

export function VoiceNoteRecorder({ disabled, onSend, onActiveChange }: {
  disabled: boolean;
  onSend: (uri: string, duration: number) => Promise<void>;
  onActiveChange: (active: boolean) => void;
}) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const status = useAudioRecorderState(recorder, 250);
  const [phase, setPhase] = useState<"idle" | "starting" | "recording" | "sending" | "retry">("idle");
  const [error, setError] = useState("");
  const [canOpenSettings, setCanOpenSettings] = useState(false);
  const held = useRef(false);
  const working = useRef(false);
  const active = useRef(false);
  const alive = useRef(true);
  const startX = useRef(0);
  const pending = useRef<Note | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false; held.current = false; onActiveChange(false);
      if (!working.current) removeTemporaryFile(pending.current?.uri);
      if (active.current) {
        active.current = false;
        void (async () => {
          try { await recorder.stop(); removeTemporaryFile(recorder.uri); }
          catch { /* The recorder may already have been released by Expo. */ }
          finally { await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {}); }
        })();
      }
    };
  }, [recorder]);

  async function begin() {
    if (disabled || working.current || active.current || pending.current) return;
    held.current = true; working.current = true;
    setError(""); setCanOpenSettings(false); setPhase("starting"); onActiveChange(true);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setCanOpenSettings(!permission.canAskAgain);
        throw new Error("Allow microphone access to record a voice note.");
      }
      if (!held.current || !alive.current) return;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      if (!held.current || !alive.current) {
        await recorder.stop(); removeTemporaryFile(recorder.uri);
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        return;
      }
      recorder.record();
      active.current = true;
      setPhase("recording");
    } catch (error) {
      held.current = false;
      if (alive.current) setError(error instanceof Error ? error.message : "Recording couldn’t start.");
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    } finally {
      working.current = false;
      if (!active.current && alive.current) { setPhase("idle"); onActiveChange(false); }
    }
  }
  async function sendPending() {
    const note = pending.current;
    if (!note || working.current) return;
    working.current = true; setPhase("sending"); setError("");
    try {
      await onSend(note.uri, note.duration);
      removeTemporaryFile(note.uri); pending.current = null;
      if (alive.current) { setPhase("idle"); onActiveChange(false); }
    } catch (error) {
      if (alive.current) {
        setPhase("retry");
        const message = error instanceof Error ? error.message : "";
        setError(!message || /failed to fetch|network|load failed/i.test(message)
          ? "Your voice note wasn’t sent. It’s kept here—check your connection and tap Retry."
          : message);
      }
    } finally { working.current = false; }
  }
  async function end(cancel = false) {
    held.current = false;
    if (!active.current || working.current) return;
    active.current = false; working.current = true;
    // Capture before stop(): some native implementations reset their clock.
    const duration = Math.max(1, Math.ceil(recorder.currentTime));
    setPhase("sending");
    try {
      await recorder.stop();
      if (!recorder.uri) throw new Error("The recording could not be saved.");
      if (cancel || !alive.current) removeTemporaryFile(recorder.uri);
      else pending.current = { uri: recorder.uri, duration };
    } catch (error) {
      if (alive.current) setError(error instanceof Error ? error.message : "Recording could not finish.");
    } finally {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
      working.current = false;
    }
    if (!alive.current) return;
    if (pending.current && !cancel) await sendPending();
    else { setPhase("idle"); onActiveChange(false); }
  }
  function discard() {
    if (active.current || phase === "starting") { void end(true); return; }
    if (working.current) return;
    removeTemporaryFile(pending.current?.uri); pending.current = null;
    setError(""); setPhase("idle"); onActiveChange(false);
  }
  useEffect(() => { if (disabled && held.current) void end(true); }, [disabled]);
  const seconds = pending.current?.duration ?? status.durationMillis / 1000;
  return <View style={styles.root}>
    {(phase !== "idle" || error) && <View testID="voice-recording-status" style={[styles.panel, { width: Math.min(270, width - 128), backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.row}>
        <Text accessibilityLiveRegion={phase === "recording" ? "none" : "polite"} style={[styles.label, { color: colors.foreground }]}>
          {phase === "starting" ? "Allow microphone access…" : phase === "sending" ? "Sending voice note…" : formatVoiceDuration(seconds)}
        </Text>
        {phase === "retry" && <Pressable testID="retry-voice-note" accessibilityRole="button" accessibilityLabel="Retry voice note" onPress={() => void sendPending()} style={styles.action}>
          <Feather name="rotate-ccw" size={20} color={colors.primary}/>
        </Pressable>}
        {phase !== "sending" && <Pressable testID="cancel-voice-note" accessibilityRole="button" accessibilityLabel="Delete recording" onPress={discard} style={styles.action}>
          <Feather name="trash-2" size={20} color={colors.primary}/>
        </Pressable>}
      </View>
      {phase === "recording" && <Text style={[styles.hint, { color: colors.mutedForeground }]}>Release to send · Slide left to cancel</Text>}
      {error ? <Text accessibilityRole="alert" style={[styles.hint, { color: colors.destructive }]}>{error}</Text> : null}
      {canOpenSettings && Platform.OS !== "web" && <Pressable accessibilityRole="button" accessibilityLabel="Open microphone settings"
        onPress={() => void Linking.openSettings().catch(() => setError("Open your phone’s Settings to allow microphone access."))}>
        <Text style={[styles.hint, { color: colors.primary }]}>Open Settings</Text>
      </Pressable>}
    </View>}
    <Pressable testID="record-voice-note" accessibilityRole="button" accessibilityLabel="Hold to record a voice note"
      disabled={disabled || phase === "sending" || phase === "retry"}
      pressRetentionOffset={{ left: 10000, right: 10000, top: 10000, bottom: 10000 }}
      onPressIn={event => { startX.current = event.nativeEvent.pageX; void begin(); }}
      onTouchMove={event => { if (held.current && event.nativeEvent.pageX < startX.current - 70) void end(true); }}
      onPressOut={() => void end()}
      style={[styles.mic, { backgroundColor: phase === "recording" ? colors.muted : "transparent", opacity: disabled ? .5 : 1 }]}>
      {phase === "sending" ? <ActivityIndicator color={colors.primary}/> : <Feather name="mic" size={22} color={colors.primary}/>}
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  root: { position: "relative", zIndex: 10 },
  mic: { width: 42, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 },
  panel: { position: "absolute", right: 0, bottom: 56, width: 270, padding: 12, borderRadius: 16, borderWidth: 1, elevation: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { flex: 1, fontSize: 14, fontWeight: "600", fontVariant: ["tabular-nums"] },
  hint: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  action: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
});
