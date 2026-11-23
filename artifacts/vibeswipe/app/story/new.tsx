import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { fetch as expoFetch } from "expo/fetch";
import { File } from "expo-file-system";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getGetStoriesQueryKey,
  useCreateStory,
  useRequestStoryMediaUpload,
  useTranscodeStoryVideo,
  type StoryInput,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { getReelPhotoContentType, getReelVideoContentType } from "@/lib/reelComposer";

const BACKGROUNDS = ["#111111", "#202020", "#303030", "#404040", "#505050", "#606060"];

export default function StoryComposer() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const requestUpload = useRequestStoryMediaUpload();
  const transcode = useTranscodeStoryVideo();
  const createStory = useCreateStory();
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [caption, setCaption] = useState("");
  const [background, setBackground] = useState(BACKGROUNDS[0]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const isVideo = asset?.type === "video";
  const videoSource = useMemo(() => (asset && isVideo ? { uri: asset.uri } : null), [asset, isVideo]);
  const player = useVideoPlayer(videoSource, (p) => { p.loop = true; p.muted = true; p.play(); });

  async function pick(camera: boolean) {
    setError("");
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", camera ? "Allow camera access to capture a story." : "Allow photo access to choose a story.", perm.canAskAgain ? [{ text: "OK" }] : [{ text: "Cancel", style: "cancel" }, { text: "Open Settings", onPress: () => void Linking.openSettings() }]);
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images", "videos"], quality: 0.85, videoMaxDuration: 60 };
    const result = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (result.canceled || !result.assets[0]) return;
    const next = result.assets[0];
    if (next.type === "video" && next.duration && next.duration > 60_500) { setError("Story videos must be 60 seconds or shorter."); return; }
    setAsset(next);
  }

  async function post() {
    if (busy) return;
    if (!asset && !caption.trim()) { setError("Add a photo, a video, or a few words first."); return; }
    setError("");
    try {
      let input: StoryInput;
      if (asset) {
        const mediaType = isVideo ? "video" : "image";
        const meta = { name: asset.fileName || asset.uri, mimeType: asset.mimeType };
        const contentType = isVideo ? getReelVideoContentType(meta) : getReelPhotoContentType(meta);
        if (!contentType) throw new Error(isVideo ? "Choose an MP4 or MOV video." : "Use JPG, PNG, WebP or HEIC photos.");
        const file = new File(asset.uri);
        const size = asset.fileSize && asset.fileSize > 0 ? asset.fileSize : file.size;
        setBusy("Uploading privately");
        const signed = await requestUpload.mutateAsync({ data: { name: (asset.fileName || `story.${isVideo ? "mp4" : "jpg"}`).slice(0, 120), size, contentType, mediaType } });
        const res = await expoFetch(signed.uploadURL, { method: "PUT", headers: { "Content-Type": contentType }, body: file as unknown as BodyInit });
        if (!res.ok) throw new Error("The upload didn't finish. Check your connection and try again.");
        let reference = signed.mediaReference;
        if (isVideo) {
          setBusy("Preparing video");
          reference = (await transcode.mutateAsync({ mediaId: signed.mediaId })).mediaReference;
        }
        input = { mediaUrl: reference, mediaType, ...(caption.trim() ? { caption: caption.trim() } : {}) };
      } else {
        input = { caption: caption.trim(), backgroundColor: background };
      }
      setBusy("Posting");
      await createStory.mutateAsync({ data: input });
      await queryClient.invalidateQueries({ queryKey: getGetStoriesQueryKey() });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Your story wasn't posted. Try again.");
    } finally { setBusy(""); }
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: asset ? colors.discoverBackground : background }}>
      {asset ? (isVideo ? <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} /> : <Image source={{ uri: asset.uri }} style={StyleSheet.absoluteFill} contentFit="contain" />) : null}
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Close"><Feather name="x" size={26} color="#FFFFFF" /></Pressable>
        <Text style={styles.heading}>New story</Text>
        {asset ? <Pressable onPress={() => setAsset(null)} hitSlop={10} accessibilityLabel="Remove media"><Feather name="trash-2" size={21} color="#FFFFFF" /></Pressable> : <View style={{ width: 26 }} />}
      </View>
      <View style={styles.middle}>
        <TextInput value={caption} onChangeText={setCaption} maxLength={500} multiline placeholder={asset ? "Add a caption" : "Type something"} placeholderTextColor="rgba(255,255,255,0.6)" style={[styles.caption, !asset && styles.captionBig]} testID="story-caption" />
      </View>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 14 }]}>
        {!asset ? (
          <View style={styles.swatches}>
            {BACKGROUNDS.map((c) => <Pressable key={c} onPress={() => setBackground(c)} accessibilityLabel={`Background ${c}`} style={[styles.swatch, { backgroundColor: c, borderWidth: background === c ? 3 : 1.5 }]} />)}
          </View>
        ) : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <View style={styles.actions}>
          <Pressable onPress={() => void pick(false)} style={styles.round} accessibilityLabel="Choose from library"><Feather name="image" size={21} color="#FFFFFF" /></Pressable>
          <Pressable onPress={() => void pick(true)} style={styles.round} accessibilityLabel="Use camera"><Feather name="camera" size={21} color="#FFFFFF" /></Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => void post()} disabled={!!busy} style={[styles.share, { backgroundColor: colors.primary, opacity: busy ? 0.7 : 1 }]} testID="story-post">
            {busy ? <ActivityIndicator color={colors.primaryForeground} size="small" /> : <Feather name="arrow-up-circle" size={18} color={colors.primaryForeground} />}
            <Text style={{ color: colors.primaryForeground, fontWeight: "800" }}>{busy || "Share story"}</Text>
          </Pressable>
        </View>
        <Text style={styles.note}>Visible to people who follow each other with you, for 24 hours.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  heading: { color: "#FFFFFF", fontWeight: "800", fontSize: 16 },
  middle: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  caption: { color: "#FFFFFF", fontSize: 17, fontWeight: "600", textAlign: "center", textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 6 },
  captionBig: { fontSize: 28, fontWeight: "800" },
  bottom: { paddingHorizontal: 16, gap: 12 },
  swatches: { flexDirection: "row", gap: 10, justifyContent: "center" },
  swatch: { width: 28, height: 28, borderRadius: 14, borderColor: "#FFFFFF" },
  error: { color: "#FFFFFF", backgroundColor: "rgba(212,67,88,0.85)", padding: 10, borderRadius: 10, overflow: "hidden", fontWeight: "600" },
  actions: { flexDirection: "row", alignItems: "center", gap: 10 },
  round: { width: 46, height: 46, borderRadius: 23, backgroundColor: "rgba(15,12,15,0.55)", alignItems: "center", justifyContent: "center" },
  share: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 24, paddingHorizontal: 18, height: 46 },
  note: { color: "rgba(255,255,255,0.75)", fontSize: 11, textAlign: "center" },
});
