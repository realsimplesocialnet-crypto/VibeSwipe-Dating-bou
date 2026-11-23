import { useAuth } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Keyboard, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { profileImageSource } from "@/lib/media";
import { ChatVideoViewer } from "./ChatMedia";

const PREVIEW_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAAA8CAYAAADxJz2MAAAAf0lEQVR4nO3QMQ0AIQDAQPyrRMBbIODhGUiTG7o3N9b8tv43Xg/UAwgQYDqAAAGmAwgQYDqAAAGmAwgQYDqAAAGmAwgQYDqAAAGmAwgQYDqAAAGmAwgQYDqAAAGmAwgQYDqAAAGmAwgQYDqAAAGmAwgQYDqAAAGmAwgQYDqAAAGmAwgQYDqAAAGmAwgQYDqAlx3kkeobrUlclgAAAABJRU5ErkJggg==";

export function ChatMediaMessage({ reference, type, previewUrl = PREVIEW_URL }: { reference: string; type: "image" | "video"; previewUrl?: string }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  const label = type === "image" ? "Photo" : "Video";
  const icon = type === "image" ? "image" : "play-circle";
  function close() { generation.current++; setOpen(false); setLoaded(false); setLoading(false); setToken(null); setError(""); }
  async function load() {
    const request = ++generation.current;
    setLoading(true); setError(""); setLoaded(false);
    try {
      const freshToken = await getToken();
      if (request !== generation.current) return;
      if (!freshToken) throw new Error("Sign in again to load this media.");
      setToken(freshToken); setAttempt(value => value + 1); setLoaded(true);
    } catch { if (request === generation.current) { setLoading(false); setError("Couldn’t load this media. Please try again."); } }
  }
  const preview = <View style={s.preview}><Image source={{ uri: previewUrl }} style={StyleSheet.absoluteFill} resizeMode="cover"/><Feather name={icon} size={36} color="#111111"/><Text style={s.previewTitle}>{label} · Tap to view</Text><Text style={s.previewHint}>Loads only when you choose</Text></View>;
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${label.toLowerCase()} preview`} testID="chat-media-preview" onPress={() => { Keyboard.dismiss(); setLoaded(false); setError(""); setOpen(true); }}>{preview}</Pressable>
    <Modal visible={open} animationType="fade" presentationStyle="fullScreen" onRequestClose={close}>
      <View style={[s.screen, { backgroundColor: c.background, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={s.header}><Text style={{ color: c.foreground, fontWeight: "700" }}>{label}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close media" testID="button-close-chat-media" onPress={close} style={[s.close, { backgroundColor: c.card }]}><Feather name="x" size={25} color={c.primary}/></Pressable></View>
        <View style={s.content}>
          {loaded ? type === "image"
            ? <Image key={attempt} source={profileImageSource(reference, token)} style={s.full} resizeMode="contain" onLoad={() => setLoading(false)} onError={() => { setLoading(false); setError("Couldn’t load this photo. Please try again."); }}/>
            : <ChatVideoViewer key={attempt} reference={reference} token={token} onReady={() => setLoading(false)} onError={() => { setLoading(false); setError("Couldn’t load this video. Please try again."); }}/>
            : preview}
          {loading && <ActivityIndicator accessibilityLabel="Loading media" size="large" color={c.primary} style={s.spinner}/>}
        </View>
        <View style={s.footer}>
          {!!error && <Text accessibilityRole="alert" style={{ color: c.primary, textAlign: "center" }}>{error}</Text>}
          {!loaded && !error && <Text style={{ color: c.mutedForeground, textAlign: "center" }}>The full {label.toLowerCase()} has not been loaded.</Text>}
          {(!loaded || !!error) && <Pressable accessibilityRole="button" disabled={loading} testID="button-load-chat-media" onPress={() => void load()} style={[s.button, { backgroundColor: c.primary, opacity: loading ? 0.6 : 1 }]}><Text style={s.primaryText}>{error ? "Try again" : loading ? "Loading…" : "Load"}</Text></Pressable>}
          <Pressable accessibilityRole="button" testID="button-leave-chat-media" onPress={close} style={[s.button, { borderWidth: 1, borderColor: c.border }]}><Text style={{ color: c.foreground, fontWeight: "700" }}>{loaded ? "Close" : "Leave it / Close"}</Text></Pressable>
        </View>
      </View>
    </Modal>
  </>;
}

const s = StyleSheet.create({
  screen: { flex: 1 }, header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14 },
  close: { padding: 12, borderRadius: 28 }, content: { flex: 1, minHeight: 0, alignItems: "center", justifyContent: "center", padding: 12 },
  full: { width: "100%", height: "100%" }, spinner: { position: "absolute" }, footer: { paddingHorizontal: 20, paddingBottom: 12, gap: 12 },
  button: { minHeight: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" }, primaryText: { color: "#ffffff", fontWeight: "700" },
  preview: { width: 224, maxWidth: "100%", height: 148, borderRadius: 16, backgroundColor: "#EEEEEE", overflow: "hidden", alignItems: "center", justifyContent: "center", gap: 8 },
  previewTitle: { color: "#111111", fontWeight: "700", fontSize: 14 }, previewHint: { color: "#666666", fontSize: 11 },
});
