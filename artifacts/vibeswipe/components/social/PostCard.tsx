import { useAuth } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import {
  getGetMyReelsQueryKey,
  getGetSocialFeedQueryKey,
  useDeleteReel,
  useLikeReel,
  useReportReel,
  useSaveReel,
  useUnlikeReel,
  useUnsaveReel,
  type Reel,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { mediaUri, profileImagePreviewSource } from "@/lib/media";

export function useMediaToken() {
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void getToken().then((value) => { if (active) setToken(value); });
    return () => { active = false; };
  }, [getToken]);
  return token;
}

export function authedSource(reference: string | null | undefined, token: string | null) {
  if (!reference || !token) return null;
  const uri = mediaUri(reference);
  return uri ? { uri, headers: { Authorization: `Bearer ${token}` } } : null;
}

export function compactCount(value: number) {
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0).replace(/\.0$/, "")}k`;
  return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
}

export function timeAgo(value: string) {
  const s = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function isPhotoPost(reel: Reel) {
  return reel.mediaType === "slides" && reel.slideReferences.length > 0;
}

export function CreatorAvatar({ name, photo, token, size = 34, ring = false }: { name: string; photo: string | null; token: string | null; size?: number; ring?: boolean }) {
  const colors = useColors();
  const source = profileImagePreviewSource(photo, token);
  const inner = (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}>
      {source ? <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" /> : <Text style={{ color: colors.primary, fontWeight: "800", fontSize: size * 0.4 }}>{name.trim().slice(0, 1).toUpperCase()}</Text>}
    </View>
  );
  if (!ring) return inner;
  return <View style={{ padding: 2, borderRadius: size, borderWidth: 2, borderColor: colors.primary }}><View style={{ padding: 2, borderRadius: size, backgroundColor: colors.background }}>{inner}</View></View>;
}

function PostVideo({ reference, token, active, height }: { reference: string; token: string | null; active: boolean; height: number }) {
  const colors = useColors();
  const [muted, setMuted] = useState(false);
  const source = useMemo(() => {
    const auth = authedSource(reference, token);
    return auth ? { ...auth, useCaching: true } : null;
  }, [reference, token]);
  const player = useVideoPlayer(source, (p) => { p.loop = true; p.muted = false; });
  useEffect(() => {
    if (active && source) player.play(); else player.pause();
  }, [active, player, source]);
  useEffect(() => { player.muted = muted; }, [muted, player]);
  return (
    <View style={{ height, backgroundColor: colors.discoverBackground }}>
      {source ? <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} /> : <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />}
      <Pressable accessibilityRole="button" accessibilityLabel={muted ? "Unmute video" : "Mute video"} onPress={() => setMuted((m) => !m)} style={styles.muteButton} hitSlop={10}>
        <Feather name={muted ? "volume-x" : "volume-2"} size={14} color={colors.discoverForeground} />
      </Pressable>
    </View>
  );
}

function PostCarousel({ references, token, width, height, onDoubleTap }: { references: string[]; token: string | null; width: number; height: number; onDoubleTap: () => void }) {
  const colors = useColors();
  const [index, setIndex] = useState(0);
  const lastTap = useRef(0);
  const tap = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) onDoubleTap();
    lastTap.current = now;
  };
  return (
    <View style={{ height, backgroundColor: colors.discoverBackground }}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} scrollEnabled={references.length > 1}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width)))}>
        {references.map((reference, i) => (
          <Pressable key={`${reference}-${i}`} onPress={tap} accessibilityLabel={`Photo ${i + 1} of ${references.length}`} style={{ width, height }}>
            <Image source={authedSource(reference, token)} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={120} recyclingKey={reference} />
          </Pressable>
        ))}
      </ScrollView>
      {references.length > 1 ? (
        <>
          <View pointerEvents="none" style={styles.slideCount}><Text style={styles.slideCountText}>{index + 1}/{references.length}</Text></View>
          <View pointerEvents="none" style={styles.dotsAbsolute}>
            {references.map((_, i) => <View key={i} style={[styles.dot, { backgroundColor: i === index ? colors.primary : "rgba(255,255,255,0.55)", width: i === index ? 14 : 6 }]} />)}
          </View>
        </>
      ) : null}
    </View>
  );
}

export const PostCard = memo(function PostCard({ reel, token, active, onRemoved, returnTo = "/(tabs)" }: { reel: Reel; token: string | null; active: boolean; onRemoved?: (id: string) => void; returnTo?: string }) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const queryClient = useQueryClient();
  const [liked, setLiked] = useState(reel.likedByMe);
  const [likeCount, setLikeCount] = useState(reel.likeCount);
  const [saved, setSaved] = useState(reel.savedByMe);
  const [captionOpen, setCaptionOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const likeBusy = useRef(false);
  const saveBusy = useRef(false);
  const like = useLikeReel();
  const unlike = useUnlikeReel();
  const save = useSaveReel();
  const unsave = useUnsaveReel();
  const remove = useDeleteReel();
  const report = useReportReel();
  useEffect(() => { setLiked(reel.likedByMe); setLikeCount(reel.likeCount); setSaved(reel.savedByMe); }, [reel.id, reel.likedByMe, reel.likeCount, reel.savedByMe]);

  const photo = isPhotoPost(reel);
  const mediaWidth = Math.min(width, 640);
  const mediaHeight = Math.round(mediaWidth * (photo ? 1.25 : 1.25));

  async function toggleLike(forceOn = false) {
    if (likeBusy.current) return;
    if (forceOn && liked) return;
    likeBusy.current = true;
    const next = !liked;
    setLiked(next); setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      if (next) await like.mutateAsync({ reelId: reel.id }); else await unlike.mutateAsync({ reelId: reel.id });
      void queryClient.invalidateQueries({ queryKey: getGetSocialFeedQueryKey(), refetchType: "none" });
    } catch {
      setLiked(!next); setLikeCount((c) => Math.max(0, c + (next ? -1 : 1)));
      Alert.alert("Could not update like", "Please try again.");
    } finally {
      likeBusy.current = false;
    }
  }
  async function toggleSave() {
    if (saveBusy.current) return;
    saveBusy.current = true;
    const next = !saved;
    setSaved(next);
    try {
      if (next) await save.mutateAsync({ reelId: reel.id }); else await unsave.mutateAsync({ reelId: reel.id });
      void queryClient.invalidateQueries({ queryKey: getGetSocialFeedQueryKey(), refetchType: "none" });
    } catch {
      setSaved(!next);
      Alert.alert("Could not save post", "Please try again.");
    } finally {
      saveBusy.current = false;
    }
  }
  function sharePost() {
    router.push({ pathname: "/reels/[reelId]", params: { reelId: reel.id, returnTo, openShare: "1" } } as never);
  }
  function openComments() {
    router.push({ pathname: "/reels/[reelId]", params: { reelId: reel.id, returnTo, openComments: "1" } } as never);
  }
  function confirmDelete() {
    setMenuOpen(false);
    Alert.alert("Delete post?", "This removes the post for everyone. It can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await remove.mutateAsync({ reelId: reel.id });
          onRemoved?.(reel.id);
          void queryClient.invalidateQueries({ queryKey: getGetSocialFeedQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetMyReelsQueryKey() });
        } catch { Alert.alert("Could not delete post", "Please try again."); }
      } },
    ]);
  }
  function confirmReport() {
    setMenuOpen(false);
    const send = async (reason: "spam" | "harassment" | "nudity" | "other") => {
      try { await report.mutateAsync({ reelId: reel.id, data: { reason } }); Alert.alert("Report sent", "Thanks. Our safety team will review this post."); }
      catch { Alert.alert("Could not send report", "Please try again."); }
    };
    Alert.alert("Report post", "Why are you reporting this?", [
      { text: "Spam", onPress: () => void send("spam") },
      { text: "Harassment", onPress: () => void send("harassment") },
      { text: "Nudity", onPress: () => void send("nudity") },
      { text: "Something else", onPress: () => void send("other") },
      { text: "Cancel", style: "cancel" },
    ]);
  }
  const openCreator = () => router.push({ pathname: "/profile/[profileId]", params: { profileId: reel.creatorId } });

  return (
    <View style={[styles.card, { borderBottomColor: colors.border }]} testID={`post-${reel.id}`}>
      <View style={styles.header}>
        <Pressable onPress={reel.isOwner ? () => router.push("/(tabs)/profile") : openCreator} style={styles.headerLeft} accessibilityRole="button" accessibilityLabel={`Open ${reel.creatorName}'s profile`}>
          <CreatorAvatar name={reel.creatorName} photo={reel.creatorPhoto} token={token} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.nameRow}>
              <Text numberOfLines={1} style={[styles.name, { color: colors.foreground }]}>{reel.creatorName}</Text>
              {reel.creatorVerified ? <Feather name="check-circle" size={13} color={colors.primary} accessibilityLabel="Verified" /> : null}
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>· {timeAgo(reel.createdAt)}</Text>
            </View>
            {reel.creatorLocation ? <Text numberOfLines={1} style={[styles.meta, { color: colors.mutedForeground }]}>{reel.creatorLocation}</Text> : null}
          </View>
        </Pressable>
        {reel.audience === "friends" ? <Feather name="users" size={13} color={colors.mutedForeground} accessibilityLabel="Friends only" /> : null}
        <Pressable onPress={() => setMenuOpen(true)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Post options" testID={`post-options-${reel.id}`} style={styles.iconBtn}>
          <Feather name="more-horizontal" size={20} color={colors.foreground} />
        </Pressable>
      </View>

      <View style={{ width: mediaWidth, alignSelf: "center" }}>
        {photo ? (
          <PostCarousel references={reel.slideReferences} token={token} width={mediaWidth} height={mediaHeight} onDoubleTap={() => void toggleLike(true)} />
        ) : (
          <Pressable onPress={() => router.push({ pathname: "/reels/[reelId]", params: { reelId: reel.id, returnTo } } as never)} accessibilityLabel="Open video">
            <PostVideo reference={reel.videoReference} token={token} active={active} height={mediaHeight} />
          </Pressable>
        )}
      </View>

      <View style={styles.actions}>
        <Pressable onPress={() => void toggleLike()} hitSlop={8} accessibilityRole="button" accessibilityLabel={liked ? "Unlike" : "Like"} accessibilityState={{ selected: liked }} testID={`post-like-${reel.id}`} style={styles.iconBtn}>
          <Feather name="heart" size={24} color={liked ? colors.primary : colors.foreground} style={liked ? styles.filledHeart : undefined} />
        </Pressable>
        <Pressable onPress={openComments} hitSlop={8} accessibilityRole="button" accessibilityLabel={reel.canComment ? "Comments" : "Comments are off"} style={styles.iconBtn}>
          <Feather name="message-circle" size={23} color={colors.foreground} />
        </Pressable>
        <Pressable onPress={() => void sharePost()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Share" style={styles.iconBtn}>
          <Feather name="send" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => void toggleSave()} hitSlop={8} accessibilityRole="button" accessibilityLabel={saved ? "Remove from saved" : "Save"} accessibilityState={{ selected: saved }} style={styles.iconBtn}>
          <Feather name="bookmark" size={23} color={saved ? colors.primary : colors.foreground} />
        </Pressable>
      </View>
      <View style={styles.body}>
        <Text style={[styles.likes, { color: colors.foreground }]}>{compactCount(likeCount)} {likeCount === 1 ? "like" : "likes"}</Text>
        {reel.caption ? (
          <Text onPress={() => setCaptionOpen((o) => !o)} numberOfLines={captionOpen ? undefined : 2} style={[styles.caption, { color: colors.foreground }]}>
            <Text style={{ fontWeight: "800" }}>{reel.creatorName} </Text>{reel.caption}
          </Text>
        ) : null}
        {reel.commentCount > 0 ? (
          <Text onPress={openComments} style={[styles.meta, { color: colors.mutedForeground, marginTop: 4 }]}>View {reel.commentCount === 1 ? "1 comment" : `all ${compactCount(reel.commentCount)} comments`}</Text>
        ) : null}
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          {reel.isOwner ? (
            <>
              <SheetRow icon="edit-2" label="Edit post" onPress={() => { setMenuOpen(false); router.push({ pathname: "/post-edit/[reelId]", params: { reelId: reel.id } } as never); }} />
              <SheetRow icon="trash-2" label="Delete" destructive onPress={confirmDelete} />
            </>
          ) : (
            <>
              <SheetRow icon="user" label={`View ${reel.creatorName}`} onPress={() => { setMenuOpen(false); openCreator(); }} />
              <SheetRow icon="flag" label="Report" destructive onPress={confirmReport} />
            </>
          )}
          <SheetRow icon="x" label="Cancel" onPress={() => setMenuOpen(false)} />
        </View>
      </Modal>
    </View>
  );
});

export function SheetRow({ icon, label, onPress, destructive }: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void; destructive?: boolean }) {
  const colors = useColors();
  const tint = destructive ? colors.destructive : colors.foreground;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.sheetRow, { borderTopColor: colors.border, opacity: pressed ? 0.6 : 1 }]}>
      <Feather name={icon} size={18} color={tint} />
      <Text style={{ color: tint, fontSize: 15, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

export function PostSkeleton() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  return (
    <View style={{ paddingBottom: 18 }}>
      <View style={styles.header}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.muted }} />
        <View style={{ width: 120, height: 11, borderRadius: 6, backgroundColor: colors.muted }} />
      </View>
      <View style={{ width, height: Math.min(width, 640) * 1.1, backgroundColor: colors.muted, opacity: 0.6 }} />
      <View style={{ margin: 12, width: 90, height: 11, borderRadius: 6, backgroundColor: colors.muted }} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 6 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  headerLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5, minWidth: 0 },
  name: { fontSize: 14, fontWeight: "800", flexShrink: 1, letterSpacing: -0.1 },
  meta: { fontSize: 12 },
  iconBtn: { padding: 4 },
  actions: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 9, paddingTop: 8 },
  filledHeart: { textShadowColor: "rgba(0,0,0,0.28)", textShadowRadius: 6 },
  body: { paddingHorizontal: 13, paddingTop: 4, gap: 2 },
  likes: { fontSize: 14, fontWeight: "800" },
  caption: { fontSize: 14, lineHeight: 19 },
  muteButton: { position: "absolute", right: 10, bottom: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(15,12,15,0.6)", alignItems: "center", justifyContent: "center" },
  slideCount: { position: "absolute", top: 10, right: 10, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: "rgba(15,12,15,0.62)" },
  slideCountText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  dotsAbsolute: { position: "absolute", bottom: 10, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 4 },
  dot: { height: 6, borderRadius: 3 },
  backdrop: { flex: 1, backgroundColor: "rgba(15,10,14,0.45)" },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: 30, paddingTop: 8 },
  grabber: { width: 38, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 8 },
  sheetRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 22, paddingVertical: 15, borderTopWidth: StyleSheet.hairlineWidth },
});
