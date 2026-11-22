import {
  getGetMyReelsQueryKey,
  getGetSocialFeedQueryKey,
  getGetReelsFeedQueryKey,
  useCreateReel,
  useGetReelMusic,
  useGetVibeSwipeSettings,
  useRequestProfileMediaUpload,
  useTranscodeReelVideo,
  type ReelMusicTrack,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { Image as CachedImage } from "expo-image";
import { File } from "expo-file-system";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import * as ImagePicker from "expo-image-picker";
import { fetch as expoFetch } from "expo/fetch";
import { router, useIsFocused } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { useQueryClient } from "@tanstack/react-query";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useColors } from "@/hooks/useColors";
import {
  ensureReelSlidesUploaded,
  ensureReelVideoProcessed,
  getReelPhotoContentType,
  getReelVideoContentType,
  REEL_CAPTION_MAX_LENGTH,
  REEL_SLIDE_MAX_COUNT,
  validateReelPhoto,
  validateReelSlides,
  validateReelVideo,
} from "@/lib/reelComposer";
import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { ImagePickerAsset } from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type SelectedMedia =
  | { kind: "video"; asset: ImagePickerAsset }
  | { kind: "slides"; assets: ImagePickerAsset[] };

type Audience = "public" | "friends";
type PostingStage = "idle" | "uploading" | "processing" | "publishing";

function permissionDenied(message: string, canAskAgain: boolean) {
  Alert.alert(
    "Permission needed",
    message,
    canAskAgain
      ? [{ text: "OK" }]
      : [
          { text: "Not now", style: "cancel" },
          { text: "Open settings", onPress: () => void Linking.openSettings() },
        ],
  );
}

function safeFileName(asset: ImagePickerAsset, fallback: string) {
  const pickedName = asset.fileName || asset.uri.split("/").pop() || "";
  const name = pickedName.includes(".") ? pickedName : fallback;
  return name.slice(0, 255);
}

function readableError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "object" && error !== null) {
    const value = error as {
      error?: unknown;
      response?: { data?: { error?: unknown } };
    };
    const message = value.response?.data?.error ?? value.error;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

export default function ReelComposerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const queryClient = useQueryClient();
  const requestUpload = useRequestProfileMediaUpload();
  const transcode = useTranscodeReelVideo();
  const createReel = useCreateReel();
  const musicQuery = useGetReelMusic({ query: { staleTime: 24 * 60 * 60 * 1000 } });
  const settings = useGetVibeSwipeSettings({ query: { staleTime: 60_000 } });

  const [media, setMedia] = useState<SelectedMedia | null>(null);
  const [caption, setCaption] = useState("");
  const [audience, setAudience] = useState<Audience>("public");
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [allowDownloads, setAllowDownloads] = useState<boolean | null>(null);
  const [downloadChoiceOpen, setDownloadChoiceOpen] = useState(false);
  const [soundtrackId, setSoundtrackId] = useState<string | null>(null);
  const [musicOpen, setMusicOpen] = useState(false);
  const [previewingTrackId, setPreviewingTrackId] = useState<string | null>(null);
  const [stage, setStage] = useState<PostingStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const videoUploadCache = useRef<{
    uri: string;
    mediaId: string | null;
    processed: boolean;
  } | null>(null);
  const slideUploadCache = useRef(new Map<string, string>());
  const busy = stage !== "idle";
  const tracks = musicQuery.data?.tracks ?? [];
  const selectedTrack = tracks.find((track) => track.id === soundtrackId) ?? null;
  const previewingTrack =
    tracks.find((track) => track.id === previewingTrackId) ?? null;
  const musicPlayer = useAudioPlayer(
    previewingTrack
      ? { uri: previewingTrack.audioUrl, name: previewingTrack.title }
      : null,
  );
  const selectedVideoUri = media?.kind === "video" ? media.asset.uri : null;
  const videoSource = useMemo(
    () => (selectedVideoUri ? { uri: selectedVideoUri } : null),
    [selectedVideoUri],
  );
  const videoPlayer = useVideoPlayer(videoSource, (player) => {
    player.loop = true;
    player.muted = true;
  });

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      const active = state === "active";
      setAppActive(active);
      if (!active) {
        setPreviewingTrackId(null);
        setMusicOpen(false);
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (allowDownloads === null && settings.data) setAllowDownloads(settings.data.allowDownloads);
  }, [allowDownloads, settings.data]);

  useEffect(() => {
    if (selectedVideoUri && isFocused && appActive) videoPlayer.play();
    else videoPlayer.pause();
  }, [appActive, isFocused, selectedVideoUri, videoPlayer]);

  useEffect(() => {
    if (!musicOpen || !previewingTrack || !appActive) {
      musicPlayer.pause();
      return;
    }
    void setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
    musicPlayer.loop = true;
    musicPlayer.volume = 1;
    musicPlayer.play();
    return () => musicPlayer.pause();
  }, [appActive, musicOpen, musicPlayer, previewingTrack?.audioUrl]);

  useEffect(
    () => () => {
      musicPlayer.pause();
      videoPlayer.pause();
    },
    [musicPlayer, videoPlayer],
  );

  async function chooseVideo(asset: ImagePickerAsset) {
    const file = new File(asset.uri);
    const size = asset.fileSize && asset.fileSize > 0 ? asset.fileSize : file.size;
    const contentType = getReelVideoContentType({
      name: asset.fileName || asset.uri,
      mimeType: asset.mimeType,
    });
    const problem = validateReelVideo(size, contentType);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setMedia({ kind: "video", asset });
    setAudienceOpen(false);
  }

  async function pickVideo() {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      permissionDenied(
        "Allow photo access to choose a video.",
        permission.canAskAgain,
      );
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        allowsMultipleSelection: false,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets[0]) {
        await chooseVideo(result.assets[0]);
      }
    } catch (pickerError) {
      setError(readableError(pickerError, "Could not open your videos."));
    }
  }

  async function recordVideo() {
    setError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      permissionDenied("Allow camera access to record a video.", permission.canAskAgain);
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["videos"],
        cameraType: ImagePicker.CameraType.back,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets[0]) {
        await chooseVideo(result.assets[0]);
      }
    } catch (pickerError) {
      setError(readableError(pickerError, "Could not open the camera."));
    }
  }

  async function addPhotos() {
    setError(null);
    const currentPhotos = media?.kind === "slides" ? media.assets : [];
    const remaining = REEL_SLIDE_MAX_COUNT - currentPhotos.length;
    if (remaining < 1) {
      setError("You can add up to 10 photos.");
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      permissionDenied(
        "Allow photo access to choose photos.",
        permission.canAskAgain,
      );
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        orderedSelection: true,
        quality: 1,
      });
      if (result.canceled) return;
      const additions = result.assets.filter(
        (asset) => !asset.type || asset.type === "image",
      );
      const unique = new Map(
        [...currentPhotos, ...additions].map((asset) => [asset.uri, asset]),
      );
      const assets = [...unique.values()].slice(0, REEL_SLIDE_MAX_COUNT);
      setMedia(assets.length ? { kind: "slides", assets } : null);
      setAudienceOpen(false);
    } catch (pickerError) {
      setError(readableError(pickerError, "Could not open your photos."));
    }
  }

  function removePhoto(index: number) {
    if (media?.kind !== "slides") return;
    const assets = media.assets.filter((_, photoIndex) => photoIndex !== index);
    setMedia(assets.length ? { kind: "slides", assets } : null);
  }

  function clearMedia() {
    setMedia(null);
    setError(null);
    videoUploadCache.current = null;
  }

  function openMusic() {
    setMusicOpen(true);
    setPreviewingTrackId(null);
  }

  function closeMusic() {
    setMusicOpen(false);
    setPreviewingTrackId(null);
  }

  function uploadAsset(asset: ImagePickerAsset, mediaType: "image" | "video") {
    const file = new File(asset.uri);
    const size = asset.fileSize && asset.fileSize > 0 ? asset.fileSize : file.size;
    const contentType =
      mediaType === "video"
        ? getReelVideoContentType({
            name: asset.fileName || asset.uri,
            mimeType: asset.mimeType,
          })
        : getReelPhotoContentType({
            name: asset.fileName || asset.uri,
            mimeType: asset.mimeType,
          });
    const problem =
      mediaType === "video"
        ? validateReelVideo(size, contentType)
        : validateReelPhoto(size, contentType);
    if (problem) throw new Error(problem);

    const fallbackName =
      mediaType === "video"
        ? contentType === "video/quicktime"
          ? "reel.mov"
          : "reel.mp4"
        : contentType === "image/png"
          ? "reel-photo.png"
          : contentType === "image/webp"
            ? "reel-photo.webp"
            : contentType === "image/heic"
              ? "reel-photo.heic"
              : "reel-photo.jpg";

    return requestUpload
      .mutateAsync({
        data: {
          name: safeFileName(asset, fallbackName),
          size,
          contentType: contentType!,
          mediaType,
        },
      })
      .then(async (signed) => {
        const response = await expoFetch(signed.uploadURL, {
          method: "PUT",
          headers: { "Content-Type": contentType! },
          body: file as unknown as BodyInit,
        });
        if (!response.ok) {
          throw new Error("Upload failed. Check your connection and try again.");
        }
        return signed.mediaId;
      });
  }

  async function postReel() {
    if (!media || busy) return;
    if (allowDownloads === null) {
      setError("Choose whether viewers can download this post.");
      return;
    }
    setError(null);
    try {
      setStage("uploading");
      let reel: { id: string };

      if (media.kind === "video") {
        const videoAsset = media.asset;
        const mediaId = await ensureReelVideoProcessed(
          videoAsset.uri,
          videoUploadCache,
          () => uploadAsset(videoAsset, "video"),
          async (uploadedMediaId) => {
            setStage("processing");
            await transcode.mutateAsync({ mediaId: uploadedMediaId });
          },
        );
        setStage("publishing");
        reel = await createReel.mutateAsync({
          data: {
            mediaId,
            audience,
            allowDownloads,
            ...(caption.trim() ? { caption: caption.trim() } : {}),
            ...(soundtrackId ? { soundtrackId } : {}),
          },
        });
      } else {
        const selectedPhotos = media.assets;
        const details = selectedPhotos.map((asset) => {
          const file = new File(asset.uri);
          return {
            size: asset.fileSize && asset.fileSize > 0 ? asset.fileSize : file.size,
            contentType: getReelPhotoContentType({
              name: asset.fileName || asset.uri,
              mimeType: asset.mimeType,
            }),
          };
        });
        const slideProblem = validateReelSlides(details);
        if (slideProblem) throw new Error(slideProblem);

        const assetsByUri = new Map(selectedPhotos.map((asset) => [asset.uri, asset]));
        const slideMediaIds = await ensureReelSlidesUploaded(
          selectedPhotos.map((asset) => asset.uri),
          slideUploadCache.current,
          (uri) => {
            const asset = assetsByUri.get(uri);
            if (!asset) throw new Error("A selected photo is no longer available.");
            return uploadAsset(asset, "image");
          },
        );
        setStage("publishing");
        reel = await createReel.mutateAsync({
          data: {
            slideMediaIds,
            audience,
            allowDownloads,
            ...(caption.trim() ? { caption: caption.trim() } : {}),
            ...(soundtrackId ? { soundtrackId } : {}),
          },
        });
      }

      void queryClient.invalidateQueries({ queryKey: getGetReelsFeedQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetMyReelsQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetSocialFeedQueryKey() });
      videoUploadCache.current = null;
      slideUploadCache.current.clear();
      router.replace({
        pathname: "/reels/[reelId]",
        params: { reelId: reel.id, returnTo: "/(tabs)/reels" },
      } as never);
    } catch (postError) {
      setError(
        readableError(
          postError,
          "Your post wasn't posted. Your selection is still here; tap Post to retry.",
        ),
      );
    } finally {
      setStage("idle");
    }
  }

  function selectTrack(track: ReelMusicTrack | null) {
    setSoundtrackId(track?.id ?? null);
    closeMusic();
    setError(null);
  }

  const stageLabel =
    stage === "uploading"
      ? "Uploading"
      : stage === "processing"
        ? "Preparing video"
        : stage === "publishing"
          ? "Posting"
          : "";
  const canPost =
    !busy &&
    allowDownloads !== null &&
    (media?.kind === "video" ||
      (media?.kind === "slides" && media.assets.length >= 1));
  const audienceLabel = audience === "public" ? "Public" : "Friends";
  const downloadLabel =
    allowDownloads === true ? "Yes, allow downloads" : allowDownloads === false ? "No downloads" : "Choose download access";

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: colors.discoverBackground,
          paddingTop: insets.top,
        },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Reels"
          hitSlop={12}
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace("/(tabs)/reels" as never)
          }
          style={styles.iconButton}
        >
          <Feather name="arrow-left" size={22} color={colors.discoverForeground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.discoverForeground }]}>
          New post
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAwareScrollViewCompat
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 16) + 24 },
        ]}
      >
        <View style={styles.mediaActions}>
          <MediaAction
            icon="video"
            label="Record"
            disabled={busy}
            onPress={() => void recordVideo()}
            colors={colors}
          />
          <MediaAction
            icon="film"
            label="Choose video"
            disabled={busy}
            onPress={() => void pickVideo()}
            colors={colors}
          />
          <MediaAction
            icon="image"
            label="Photos"
            disabled={busy}
            onPress={() => void addPhotos()}
            colors={colors}
          />
        </View>

        {media?.kind === "video" ? (
          <View style={styles.previewSection}>
            <View style={styles.previewHeading}>
              <Text style={[styles.sectionLabel, { color: colors.discoverForeground }]}>
                Video preview
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove video"
                disabled={busy}
                onPress={clearMedia}
                style={styles.removeButton}
              >
                <Feather name="x" size={18} color={colors.discoverForeground} />
              </Pressable>
            </View>
            <View style={[styles.videoPreview, { backgroundColor: colors.chatMediaBackdrop }]}>
              <VideoView
                player={videoPlayer}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                nativeControls
              />
            </View>
          </View>
        ) : media?.kind === "slides" ? (
          <View style={styles.previewSection}>
            <View style={styles.previewHeading}>
              <Text style={[styles.sectionLabel, { color: colors.discoverForeground }]}>
                Photos · {media.assets.length}/{REEL_SLIDE_MAX_COUNT}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove all photos"
                disabled={busy}
                onPress={clearMedia}
                style={styles.removeButton}
              >
                <Feather name="x" size={18} color={colors.discoverForeground} />
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoStrip}
            >
              {media.assets.map((asset, index) => (
                <View key={asset.uri} style={styles.photoPreview}>
                  <CachedImage
                    source={{ uri: asset.uri }}
                    contentFit="cover"
                    cachePolicy="memory"
                    style={StyleSheet.absoluteFill}
                    accessibilityLabel={`Photo ${index + 1}`}
                  />
                  <View style={styles.photoNumber}>
                    <Text style={[styles.photoNumberText, { color: colors.discoverForeground }]}>
                      {index + 1}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove photo ${index + 1}`}
                    disabled={busy}
                    onPress={() => removePhoto(index)}
                    style={[
                      styles.removePhotoButton,
                      { backgroundColor: colors.discoverControl },
                    ]}
                  >
                    <Feather name="x" size={15} color={colors.discoverForeground} />
                  </Pressable>
                </View>
              ))}
              {media.assets.length < REEL_SLIDE_MAX_COUNT ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add photos"
                  disabled={busy}
                  onPress={() => void addPhotos()}
                  style={[
                    styles.addPhotoCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Feather name="plus" size={24} color={colors.primary} />
                  <Text style={[styles.addPhotoText, { color: colors.foreground }]}>
                    Add photos
                  </Text>
                </Pressable>
              ) : null}
            </ScrollView>
            {media.assets.length < 2 ? (
              <Text style={[styles.helperText, { color: colors.mutedForeground }]}>
                Choose at least 2 photos.
              </Text>
            ) : null}
          </View>
        ) : (
          <View
            style={[
              styles.emptyPreview,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="film" size={30} color={colors.primary} />
            <Text style={[styles.emptyPreviewTitle, { color: colors.foreground }]}>
              Choose a video or photos
            </Text>
            <Text style={[styles.helperText, { color: colors.mutedForeground }]}>
              MP4 or MOV · Up to 500 MB
            </Text>
          </View>
        )}

        <View style={styles.field}>
          <View style={styles.fieldHeading}>
            <Text style={[styles.sectionLabel, { color: colors.discoverForeground }]}>
              Caption
            </Text>
            <Text style={[styles.counter, { color: colors.mutedForeground }]}>
              {caption.length}/{REEL_CAPTION_MAX_LENGTH}
            </Text>
          </View>
          <TextInput
            accessibilityLabel="Post caption"
            editable={!busy}
            maxLength={REEL_CAPTION_MAX_LENGTH}
            multiline
            onChangeText={setCaption}
            placeholder="Add a caption"
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.captionInput,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.foreground,
              },
            ]}
            textAlignVertical="top"
            value={caption}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.sectionLabel, { color: colors.discoverForeground }]}>
            Music
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={selectedTrack ? `Music: ${selectedTrack.title}` : "Add music"}
            disabled={busy}
            onPress={openMusic}
            style={[
              styles.selectionButton,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="music" size={18} color={colors.primary} />
            <Text
              numberOfLines={1}
              style={[styles.selectionText, { color: colors.foreground }]}
            >
              {selectedTrack?.title ?? "Add music"}
            </Text>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <View style={styles.field}>
          <Text style={[styles.sectionLabel, { color: colors.discoverForeground }]}>
            Who can see this post?
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Who can see this post? ${audienceLabel}`}
            accessibilityState={{ expanded: audienceOpen }}
            disabled={busy}
            onPress={() => setAudienceOpen((open) => !open)}
            style={[
              styles.selectionButton,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.selectionText, { color: colors.foreground }]}>
              {audienceLabel}
            </Text>
            <Feather
              name={audienceOpen ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.mutedForeground}
            />
          </Pressable>
          {audienceOpen ? (
            <View
              style={[
                styles.audienceMenu,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              {(["public", "friends"] as const).map((value) => {
                const label = value === "public" ? "Public" : "Friends";
                const selected = value === audience;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setAudience(value);
                      setAudienceOpen(false);
                    }}
                    style={styles.audienceOption}
                  >
                    <Text
                      style={[
                        styles.selectionText,
                        { color: selected ? colors.primary : colors.foreground },
                      ]}
                    >
                      {label}
                    </Text>
                    {selected ? (
                      <Feather name="check" size={18} color={colors.primary} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>

        <View style={styles.field}>
          <Text style={[styles.sectionLabel, { color: colors.discoverForeground }]}>
            Allow people to download this post?
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Download access: ${downloadLabel}`}
            accessibilityState={{ expanded: downloadChoiceOpen }}
            disabled={busy}
            onPress={() => setDownloadChoiceOpen((open) => !open)}
            style={[
              styles.selectionButton,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.selectionText, { color: colors.foreground }]}>
              {downloadLabel}
            </Text>
            <Feather
              name={downloadChoiceOpen ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.mutedForeground}
            />
          </Pressable>
          {downloadChoiceOpen ? (
            <View
              style={[
                styles.audienceMenu,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              {([
                [true, "Yes, allow downloads"],
                [false, "No downloads"],
              ] as const).map(([value, label]) => {
                const selected = value === allowDownloads;
                return (
                  <Pressable
                    key={String(value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setAllowDownloads(value);
                      setDownloadChoiceOpen(false);
                    }}
                    style={styles.audienceOption}
                  >
                    <Text
                      style={[
                        styles.selectionText,
                        { color: selected ? colors.primary : colors.foreground },
                      ]}
                    >
                      {label}
                    </Text>
                    {selected ? (
                      <Feather name="check" size={18} color={colors.primary} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>

        {error ? (
          <View
            accessibilityRole="alert"
            style={[
              styles.errorBox,
              { backgroundColor: colors.card, borderColor: colors.destructive },
            ]}
          >
            <Text style={[styles.errorText, { color: colors.destructive }]}>
              {error}
            </Text>
          </View>
        ) : null}

        {busy ? (
          <View
            accessibilityRole="progressbar"
            style={styles.progress}
          >
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={[styles.progressText, { color: colors.mutedForeground }]}>
              {stageLabel}
            </Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share post"
          accessibilityState={{ disabled: !canPost, busy }}
          disabled={!canPost}
          onPress={() => void postReel()}
          style={({ pressed }) => [
            styles.postButton,
            {
              backgroundColor: canPost ? colors.primary : colors.secondary,
              opacity: pressed && canPost ? 0.86 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.postButtonText,
              {
                color: canPost
                  ? colors.primaryForeground
                  : colors.mutedForeground,
              },
            ]}
          >
            Post
          </Text>
        </Pressable>
      </KeyboardAwareScrollViewCompat>

      <Modal
        animationType="slide"
        onRequestClose={closeMusic}
        transparent
        visible={musicOpen}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close music picker"
            onPress={closeMusic}
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: colors.chatScrim },
            ]}
          />
          <View
            style={[
              styles.musicSheet,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}
          >
            <View style={styles.musicHeader}>
              <Text style={[styles.musicTitle, { color: colors.foreground }]}>
                Music
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close music picker"
                onPress={closeMusic}
                style={styles.iconButton}
              >
                <Feather name="x" size={20} color={colors.foreground} />
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.musicList}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: soundtrackId === null }}
                onPress={() => selectTrack(null)}
                style={[styles.trackRow, { borderBottomColor: colors.border }]}
              >
                <View style={styles.trackDetails}>
                  <Text style={[styles.trackTitle, { color: colors.foreground }]}>
                    No music
                  </Text>
                </View>
                {soundtrackId === null ? (
                  <Feather name="check" size={18} color={colors.primary} />
                ) : null}
              </Pressable>

              {musicQuery.isLoading ? (
                <View style={styles.musicStatus}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : musicQuery.isError ? (
                <View style={styles.musicStatus}>
                  <Text style={[styles.helperText, { color: colors.mutedForeground }]}>
                    Music is unavailable.
                  </Text>
                  <Pressable onPress={() => void musicQuery.refetch()}>
                    <Text style={[styles.retryText, { color: colors.primary }]}>
                      Try again
                    </Text>
                  </Pressable>
                </View>
              ) : tracks.length ? (
                tracks.map((track) => {
                  const previewing = previewingTrackId === track.id;
                  const selected = soundtrackId === track.id;
                  return (
                    <View
                      key={track.id}
                      style={[styles.trackRow, { borderBottomColor: colors.border }]}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${previewing ? "Pause" : "Preview"} ${track.title}`}
                        accessibilityState={{ selected: previewing }}
                        onPress={() =>
                          setPreviewingTrackId((current) =>
                            current === track.id ? null : track.id,
                          )
                        }
                        style={[
                          styles.previewTrackButton,
                          { backgroundColor: colors.secondary },
                        ]}
                      >
                        <Feather
                          name={previewing ? "pause" : "play"}
                          size={17}
                          color={colors.primary}
                        />
                      </Pressable>
                      <View style={styles.trackDetails}>
                        <Text
                          numberOfLines={1}
                          style={[styles.trackTitle, { color: colors.foreground }]}
                        >
                          {track.title}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={[styles.trackArtist, { color: colors.mutedForeground }]}
                        >
                          {track.artist}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={selected ? `${track.title} selected` : `Use ${track.title}`}
                        onPress={() => selectTrack(track)}
                        style={[
                          styles.useTrackButton,
                          { backgroundColor: selected ? colors.secondary : colors.primary },
                        ]}
                      >
                        <Text
                          style={[
                            styles.useTrackText,
                            {
                              color: selected
                                ? colors.primary
                                : colors.primaryForeground,
                            },
                          ]}
                        >
                          {selected ? "Added" : "Use"}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })
              ) : (
                <View style={styles.musicStatus}>
                  <Text style={[styles.helperText, { color: colors.mutedForeground }]}>
                    No music available.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MediaAction({
  icon,
  label,
  disabled,
  onPress,
  colors,
}: {
  icon: ComponentProps<typeof Feather>["name"];
  label: string;
  disabled: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.mediaAction,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: disabled ? 0.55 : pressed ? 0.78 : 1,
        },
      ]}
    >
      <Feather name={icon} size={18} color={colors.primary} />
      <Text style={[styles.mediaActionText, { color: colors.foreground }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 12,
  },
  iconButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 19, fontWeight: "700" },
  headerSpacer: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 20,
  },
  mediaActions: {
    flexDirection: "row",
    gap: 8,
  },
  mediaAction: {
    minHeight: 48,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
  },
  mediaActionText: { fontSize: 12, fontWeight: "600" },
  previewSection: { gap: 10 },
  previewHeading: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionLabel: { fontSize: 14, fontWeight: "700" },
  removeButton: {
    width: 32,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  videoPreview: {
    width: "100%",
    height: 250,
    overflow: "hidden",
    borderRadius: 14,
  },
  photoStrip: { gap: 10, paddingRight: 4 },
  photoPreview: {
    width: 150,
    height: 210,
    overflow: "hidden",
    borderRadius: 12,
  },
  photoNumber: {
    position: "absolute",
    left: 8,
    top: 8,
    minWidth: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  photoNumberText: { fontSize: 12, fontWeight: "700" },
  removePhotoButton: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  addPhotoCard: {
    width: 130,
    height: 210,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 12,
  },
  addPhotoText: { fontSize: 12, fontWeight: "600" },
  emptyPreview: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
  },
  emptyPreviewTitle: { fontSize: 16, fontWeight: "700" },
  helperText: { fontSize: 12, lineHeight: 18 },
  field: { gap: 9 },
  fieldHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  counter: { fontSize: 12 },
  captionInput: {
    minHeight: 96,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    fontSize: 15,
  },
  selectionButton: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    gap: 10,
  },
  selectionText: { flex: 1, fontSize: 15, fontWeight: "600" },
  audienceMenu: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    overflow: "hidden",
  },
  audienceOption: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
  },
  errorBox: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
  },
  errorText: { fontSize: 13, lineHeight: 19 },
  progress: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  progressText: { fontSize: 13, fontWeight: "600" },
  postButton: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
  },
  postButtonText: { fontSize: 16, fontWeight: "800" },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  musicSheet: {
    maxHeight: "82%",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  musicHeader: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  musicTitle: { fontSize: 18, fontWeight: "700" },
  musicList: { paddingHorizontal: 16, paddingBottom: 8 },
  trackRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  trackDetails: { flex: 1, gap: 4 },
  trackTitle: { fontSize: 14, fontWeight: "700" },
  trackArtist: { fontSize: 12 },
  previewTrackButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  useTrackButton: {
    minWidth: 62,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: 18,
  },
  useTrackText: { fontSize: 12, fontWeight: "700" },
  musicStatus: {
    minHeight: 90,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  retryText: { fontSize: 13, fontWeight: "700" },
});
