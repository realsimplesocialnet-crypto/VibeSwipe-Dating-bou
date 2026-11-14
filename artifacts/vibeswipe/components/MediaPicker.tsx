import {
  useRequestProfileMediaUpload,
  useTranscodeProfileVideo,
  type MediaUploadInputContentType,
} from "@workspace/api-client-react";
import { useAuth } from "@clerk/expo";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { fetch } from "expo/fetch";
import { Feather } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { profileImageSource } from "@/lib/media";

type Props = {
  photos: string[];
  videoUrl: string | null;
  onChange: (next: { photos: string[]; videoUrl: string | null }) => void;
  maxPhotos?: number;
  showVideo?: boolean;
  /** Six equal slots with pink add buttons (Edit Profile). Presentation only. */
  variant?: "default" | "grid";
};

const MAX_PHOTOS = 6;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_SOURCE_BYTES = 500 * 1024 * 1024;

export function MediaPicker({
  photos,
  videoUrl,
  onChange,
  maxPhotos = MAX_PHOTOS,
  showVideo = true,
  variant = "default",
}: Props) {
  const colors = useColors();
  const { getToken } = useAuth();
  const uploadUrl = useRequestProfileMediaUpload();
  const transcodeVideo = useTranscodeProfileVideo();
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyMessage, setBusyMessage] = useState("Uploading securely…");
  const [error, setError] = useState("");
  const photoLimit = Math.min(MAX_PHOTOS, Math.max(1, maxPhotos));
  const [gridWidth, setGridWidth] = useState(0);
  useEffect(() => {
    let active = true;
    void getToken().then((value) => {
      if (active) setToken(value);
    });
    return () => {
      active = false;
    };
  }, [getToken]);

  async function uploadAsset(
    asset: ImagePicker.ImagePickerAsset,
    mediaType: "image" | "video",
  ): Promise<string> {
    const file = new File(asset.uri);
    const size = asset.fileSize ?? file.size;
    const allowedTypes: MediaUploadInputContentType[] = [
      "image/jpeg", "image/png", "image/webp", "image/heic", "video/mp4", "video/quicktime",
    ];
    const fallbackType = mediaType === "video" ? "video/mp4" : "image/jpeg";
    const contentType = allowedTypes.includes(asset.mimeType as MediaUploadInputContentType)
      ? (asset.mimeType as MediaUploadInputContentType)
      : fallbackType;
    const maxSize = mediaType === "video" ? MAX_VIDEO_SOURCE_BYTES : MAX_IMAGE_BYTES;
    if (size <= 0 || size > maxSize) {
      throw new Error(
        mediaType === "video"
          ? "Choose a source video that is 500 MB or smaller."
          : "Choose an image smaller than 15 MB.",
      );
    }
    const result = await uploadUrl.mutateAsync({
      data: {
        name: asset.fileName ?? `${mediaType}-${Date.now()}`,
        size,
        contentType,
        mediaType,
      },
    });
    setBusyMessage(mediaType === "video" ? "Uploading video…" : "Uploading securely…");
    const uploaded = await fetch(result.uploadURL, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: file as unknown as BodyInit,
    });
    if (!uploaded.ok) throw new Error("The file could not be uploaded.");
    if (mediaType === "video") {
      setBusyMessage("Compressing video…");
      await transcodeVideo.mutateAsync({ mediaId: result.mediaId });
    }
    return result.mediaReference;
  }

  async function pickPhotos() {
    setError("");
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Allow photo access to add profile pictures.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, photoLimit - photos.length),
      quality: 0.85,
    });
    if (result.canceled || result.assets.length === 0) return;
    setBusy(true);
    try {
      const remaining = photoLimit - photos.length;
      const uploaded = await Promise.all(
        result.assets.slice(0, remaining).map((asset) => uploadAsset(asset, "image")),
      );
      onChange({ photos: [...photos, ...uploaded], videoUrl });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Photo upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function pickVideo() {
    setError("");
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Allow media access to add a profile video.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      videoMaxDuration: 30,
      videoQuality: ImagePicker.UIImagePickerControllerQualityType.IFrame1280x720,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setBusy(true);
    try {
      const reference = await uploadAsset(asset, "video");
      onChange({ photos, videoUrl: reference });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Video upload failed.");
    } finally {
      setBusy(false);
    }
  }

  function removePhoto(index: number) {
    onChange({
      photos: photos.filter((_, photoIndex) => photoIndex !== index),
      videoUrl,
    });
  }

  if (variant === "grid") {
    const gap = 12;
    const slotWidth = gridWidth > 0 ? (gridWidth - gap * 2) / 3 : 0;
    const slotStyle = { width: slotWidth, height: slotWidth * 1.28, borderRadius: 16 };
    return (
      <View style={styles.wrap}>
        <View style={[styles.photoRow, { gap }]} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
          {slotWidth > 0 ? Array.from({ length: photoLimit }, (_, index) => {
            const photo = photos[index];
            if (photo) {
              return (
                <View key={`${photo}-${index}`} style={[slotStyle, { overflow: "hidden", backgroundColor: colors.profileChip }]}>
                  <Image source={profileImageSource(photo, token)} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel={`Profile photo ${index + 1}`} />
                  {index === 0 ? (
                    <View style={[styles.mainBadge, { left: 6, bottom: 6, backgroundColor: colors.profileEdit }]}>
                      <Text style={[styles.mainBadgeText, { color: colors.profileEditForeground }]}>Main photo</Text>
                    </View>
                  ) : null}
                  <Pressable accessibilityRole="button" accessibilityLabel={`Remove photo ${index + 1}`} testID={`remove-photo-${index}`} hitSlop={6} onPress={() => removePhoto(index)} style={[styles.remove, { backgroundColor: colors.profileCard, top: 6, right: 6, width: 26, height: 26, borderRadius: 13 }]}>
                    <Feather name="x" size={14} color={colors.foreground} />
                  </Pressable>
                </View>
              );
            }
            const uploadingHere = busy && index === photos.length;
            return (
              <Pressable key={`empty-${index}`} accessibilityRole="button" accessibilityLabel="Add photos" testID={index === photos.length ? "add-profile-photos" : `add-profile-photo-slot-${index}`} onPress={pickPhotos} disabled={busy} style={({ pressed }) => [slotStyle, styles.gridEmpty, { borderColor: colors.profileEdit, backgroundColor: colors.profileChip, opacity: busy ? 0.6 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] }]}>
                {uploadingHere ? <ActivityIndicator color={colors.profileEdit} /> : (
                  <View style={[styles.gridPlus, { backgroundColor: colors.profileEdit, shadowColor: colors.profileEdit }]}>
                    <Feather name="plus" size={20} color={colors.profileEditForeground} />
                  </View>
                )}
              </Pressable>
            );
          }) : null}
        </View>
        <Text testID="profile-photo-count" style={[styles.gridHelper, { color: colors.profileMuted }]}>
          {photos.length === 0 ? "Add at least one photo before saving." : `Add up to ${photoLimit} photos to show your vibe.`}
        </Text>
        {busy ? <Text style={[styles.helper, { color: colors.profileMuted, textAlign: "center" }]}>{busyMessage}</Text> : null}
        {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.destructive, textAlign: "center" }]}>{error}</Text> : null}
        {showVideo ? (
          <Pressable accessibilityRole="button" testID="add-profile-video" onPress={pickVideo} disabled={busy} style={[styles.videoButton, { borderColor: colors.profileEdit, borderStyle: "dashed" }]}>
            <Feather name={videoUrl ? "check-circle" : "video"} size={18} color={colors.profileEdit} />
            <Text style={[styles.videoText, { color: colors.foreground }]}>{videoUrl ? "Profile video added" : "Add a video, up to 30 seconds"}</Text>
            {videoUrl ? (
              <Pressable accessibilityLabel="Remove profile video" onPress={() => onChange({ photos, videoUrl: null })} hitSlop={10}>
                <Feather name="x" size={16} color={colors.profileMuted} />
              </Pressable>
            ) : null}
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.photoRow}>
        {photos.map((photo, index) => (
          <View key={`${photo}-${index}`} style={styles.photoSlot}>
            <Image
              source={profileImageSource(photo, token)}
              style={styles.photo}
              resizeMode="cover"
            />
              {index === 0 ? (
                <View style={styles.mainBadge}>
                  <Text style={styles.mainBadgeText}>Main</Text>
                </View>
              ) : null}
            <Pressable
                accessibilityLabel={`Remove photo ${index + 1}`}
              testID={`remove-photo-${index}`}
              style={styles.remove}
              onPress={() => removePhoto(index)}
            >
              <Feather name="x" size={14} color="#ffffff" />
            </Pressable>
          </View>
        ))}
        {photos.length < photoLimit && (
          <Pressable
            accessibilityLabel="Add photos"
            testID="add-profile-photos"
            onPress={pickPhotos}
            disabled={busy}
            style={[styles.addSlot, { borderColor: colors.border }]}
          >
            <Feather name="plus" size={22} color={colors.primary} />
            <Text style={[styles.addText, { color: colors.mutedForeground }]}>
              Add
            </Text>
          </Pressable>
        )}
      </View>
      <Text testID="profile-photo-count" style={[styles.helper, { color: colors.mutedForeground }]}>
        {photos.length}/{photoLimit} photos · the first photo is your main photo
      </Text>
      {showVideo ? <Pressable
        accessibilityRole="button"
        testID="add-profile-video"
        onPress={pickVideo}
        disabled={busy}
        style={[styles.videoButton, { borderColor: colors.border }]}
      >
        <Feather
          name={videoUrl ? "check-circle" : "video"}
          size={18}
          color={colors.primary}
        />
        <Text style={[styles.videoText, { color: colors.foreground }]}>
          {videoUrl ? "Profile video added" : "Add a video, up to 30 seconds"}
        </Text>
        {videoUrl ? (
          <Pressable
            accessibilityLabel="Remove profile video"
            onPress={() => onChange({ photos, videoUrl: null })}
            hitSlop={10}
          >
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </Pressable> : null}
      {busy ? (
        <View style={styles.progress}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.helper, { color: colors.mutedForeground }]}>
            {busyMessage}
          </Text>
        </View>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>
          {error}
        </Text>
      ) : null}
      <Text style={[styles.helper, { color: colors.mutedForeground }]}>
        {photoLimit === 1
          ? "Add one profile picture. It will appear on your profile and Discover cards."
          : `Add 1–${photoLimit} photos.${showVideo ? " Videos are compressed to 720p or smaller and limited to 30 seconds and 50 MB." : ""}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  photoRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  photoSlot: { width: 76, height: 92, borderRadius: 14, overflow: "hidden" },
  photo: { width: "100%", height: "100%", backgroundColor: "#211b20" },
  mainBadge: { position: "absolute", left: 4, bottom: 4, borderRadius: 9, backgroundColor: "rgba(0,0,0,0.72)", paddingHorizontal: 6, paddingVertical: 3 },
  mainBadgeText: { color: "#ffffff", fontSize: 9, fontWeight: "700" },
  remove: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 23,
    height: 23,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  addSlot: {
    width: 76,
    height: 92,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  gridEmpty: { borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  gridPlus: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  gridHelper: { fontSize: 13, textAlign: "center" },
  addText: { fontSize: 12, fontWeight: "600" },
  videoButton: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
  },
  videoText: { flex: 1, fontSize: 14, fontWeight: "600" },
  progress: { flexDirection: "row", alignItems: "center", gap: 9 },
  helper: { fontSize: 12, lineHeight: 17 },
  error: { fontSize: 13, lineHeight: 18 },
});
