import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getGetStoriesQueryKey,
  useDeleteStory,
  useGetMyProfile,
  useGetStories,
  useLikeStory,
  useMarkStoryViewed,
  useUnlikeStory,
  type StoryItem,
  type StoryPoster,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { authedSource, CreatorAvatar, timeAgo } from "@/components/social/PostCard";

type Group = { poster: StoryPoster; stories: StoryItem[]; own: boolean };
const IMAGE_MS = 5500;

export function StoriesRow({ token }: { token: string | null }) {
  const colors = useColors();
  const stories = useGetStories({ query: { queryKey: getGetStoriesQueryKey(), refetchInterval: 60_000 } });
  const me = useGetMyProfile();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const groups = useMemo<Group[]>(() => {
    const list: Group[] = [];
    if (me.data && stories.data?.ownStories.length) {
      list.push({ own: true, poster: { id: me.data.id, name: "Your story", photo: me.data.photos[0] ?? null }, stories: stories.data.ownStories });
    }
    for (const g of stories.data?.mutualFollows ?? []) if (g.stories.length) list.push({ own: false, poster: g.poster, stories: g.stories });
    return list;
  }, [me.data, stories.data]);
  const hasOwn = groups[0]?.own ?? false;

  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowContent}>
        {!hasOwn ? (
          <Pressable onPress={() => router.push("/story/new" as never)} style={styles.bubble} accessibilityRole="button" accessibilityLabel="Add to your story" testID="story-add">
            <View>
              <CreatorAvatar name={me.data?.name ?? "You"} photo={me.data?.photos[0] ?? null} token={token} size={64} />
              <View style={[styles.plus, { backgroundColor: colors.primary, borderColor: colors.background }]}><Feather name="plus" size={13} color={colors.primaryForeground} /></View>
            </View>
            <Text numberOfLines={1} style={[styles.label, { color: colors.foreground }]}>Your story</Text>
          </Pressable>
        ) : null}
        {stories.isLoading ? [0, 1, 2, 3].map((i) => <View key={i} style={styles.bubble}><View style={[styles.skeleton, { backgroundColor: colors.muted }]} /></View>) : null}
        {groups.map((group, index) => {
          const unseen = group.stories.some((s) => !s.viewed);
          return (
            <Pressable key={group.poster.id} onPress={() => setOpenIndex(index)} style={styles.bubble} accessibilityRole="button" accessibilityLabel={`${group.poster.name} story${unseen ? ", new" : ""}`} testID={`story-${group.poster.id}`}>
              {unseen || group.own ? (
                <LinearGradient colors={[colors.primary, "#ff9a62", colors.primary]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.ring}>
                  <View style={[styles.ringGap, { backgroundColor: colors.background }]}><CreatorAvatar name={group.poster.name} photo={group.poster.photo} token={token} size={60} /></View>
                </LinearGradient>
              ) : (
                <View style={[styles.ring, { borderWidth: 1.5, borderColor: colors.border }]}><View style={[styles.ringGap, { backgroundColor: colors.background }]}><CreatorAvatar name={group.poster.name} photo={group.poster.photo} token={token} size={60} /></View></View>
              )}
              <Text numberOfLines={1} style={[styles.label, { color: unseen ? colors.foreground : colors.mutedForeground }]}>{group.own ? "Your story" : group.poster.name}</Text>
            </Pressable>
          );
        })}
        {!stories.isLoading && groups.length === 0 ? (
          <View style={styles.hint}><Text style={[styles.hintText, { color: colors.mutedForeground }]}>Stories from people you follow each other with appear here for 24 hours.</Text></View>
        ) : null}
      </ScrollView>
      {openIndex !== null ? <StoryViewer groups={groups} start={openIndex} token={token} onClose={() => setOpenIndex(null)} /> : null}
    </View>
  );
}

function StoryVideo({ reference, token, paused, onEnd }: { reference: string; token: string | null; paused: boolean; onEnd: () => void }) {
  const source = useMemo(() => authedSource(reference, token), [reference, token]);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  const player = useVideoPlayer(source, (p) => { p.loop = false; });
  useEffect(() => { if (paused) player.pause(); else player.play(); }, [paused, player]);
  useEffect(() => {
    const sub = player.addListener("playToEnd", () => endRef.current());
    return () => sub.remove();
  }, [player]);
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />;
}

function StoryViewer({ groups, start, token, onClose }: { groups: Group[]; start: number; token: string | null; onClose: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [g, setG] = useState(start);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const markViewed = useMarkStoryViewed();
  const like = useLikeStory();
  const unlike = useUnlikeStory();
  const remove = useDeleteStory();
  const group = groups[g];
  const story = group?.stories[i];

  useEffect(() => {
    if (!story || group.own || story.viewed) return;
    markViewed.mutate({ storyId: story.id });
  }, [story?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function next() {
    if (!group) return onClose();
    if (i < group.stories.length - 1) setI(i + 1);
    else if (g < groups.length - 1) { setG(g + 1); setI(0); }
    else close();
  }
  function prev() {
    if (i > 0) setI(i - 1);
    else if (g > 0) { setG(g - 1); setI(0); }
  }
  function close() {
    void queryClient.invalidateQueries({ queryKey: getGetStoriesQueryKey() });
    onClose();
  }
  const isVideo = story?.mediaType === "video" && !!story.mediaUrl;
  useEffect(() => {
    if (!story || isVideo || paused) return;
    const timer = setTimeout(next, IMAGE_MS);
    return () => clearTimeout(timer);
  }); // re-armed each render on purpose so pause/advance reset the clock

  if (!group || !story) return null;
  const isLiked = liked[story.id] ?? story.likedByMe;

  async function toggleLike() {
    if (!story) return;
    const nextVal = !isLiked;
    setLiked((m) => ({ ...m, [story.id]: nextVal }));
    try { if (nextVal) await like.mutateAsync({ storyId: story.id }); else await unlike.mutateAsync({ storyId: story.id }); }
    catch { setLiked((m) => ({ ...m, [story.id]: !nextVal })); }
  }
  function deleteStory() {
    if (!story) return;
    setPaused(true);
    Alert.alert("Delete story?", "It will disappear for everyone.", [
      { text: "Cancel", style: "cancel", onPress: () => setPaused(false) },
      { text: "Delete", style: "destructive", onPress: async () => {
        try { await remove.mutateAsync({ storyId: story.id }); close(); }
        catch { setPaused(false); Alert.alert("Could not delete story", "Please try again."); }
      } },
    ]);
  }

  return (
    <Modal visible animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={[styles.viewer, { backgroundColor: story.backgroundColor ?? colors.discoverBackground }]}>
        {story.mediaUrl ? (
          isVideo ? <StoryVideo key={story.id} reference={story.mediaUrl} token={token} paused={paused} onEnd={next} />
            : <Image source={authedSource(story.mediaUrl, token)} style={StyleSheet.absoluteFill} contentFit="contain" />
        ) : null}
        {story.caption ? (
          <View style={[styles.captionWrap, !story.mediaUrl && styles.captionCenter]} pointerEvents="none">
            <Text style={[styles.caption, !story.mediaUrl && styles.captionBig]}>{story.caption}</Text>
          </View>
        ) : null}
        <View style={styles.tapZones}>
          <Pressable style={{ flex: 1 }} onPress={prev} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} accessibilityLabel="Previous story" />
          <Pressable style={{ flex: 2 }} onPress={next} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} accessibilityLabel="Next story" />
        </View>
        <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
          <View style={styles.bars}>
            {group.stories.map((s, idx) => <View key={s.id} style={[styles.bar, { backgroundColor: idx <= i ? "#fff7fb" : "rgba(255,255,255,0.32)" }]} />)}
          </View>
          <View style={styles.topRow}>
            <Pressable style={styles.topLeft} disabled={group.own} onPress={() => { close(); router.push({ pathname: "/profile/[profileId]", params: { profileId: group.poster.id } }); }}>
              <CreatorAvatar name={group.poster.name} photo={group.poster.photo} token={token} size={32} />
              <Text style={styles.poster}>{group.own ? "Your story" : group.poster.name}</Text>
              <Text style={styles.time}>{timeAgo(story.createdAt)}</Text>
            </Pressable>
            {group.own ? <Pressable onPress={deleteStory} hitSlop={10} accessibilityLabel="Delete story" style={styles.topBtn}><Feather name="trash-2" size={19} color="#fff7fb" /></Pressable> : null}
            <Pressable onPress={close} hitSlop={10} accessibilityLabel="Close stories" style={styles.topBtn}><Feather name="x" size={24} color="#fff7fb" /></Pressable>
          </View>
        </View>
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 14 }]}>
          {group.own ? (
            <>
              <Pressable onPress={() => { close(); router.push("/story/new" as never); }} style={styles.pill}><Feather name="plus" size={15} color="#fff7fb" /><Text style={styles.pillText}>Add more</Text></Pressable>
              <View style={styles.pill}><Feather name="heart" size={15} color="#fff7fb" /><Text style={styles.pillText}>{story.likeCount}</Text></View>
            </>
          ) : (
            <>
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => void toggleLike()} hitSlop={10} accessibilityRole="button" accessibilityLabel={isLiked ? "Unlike story" : "Like story"} style={styles.topBtn}>
                <Feather name="heart" size={27} color={isLiked ? colors.primary : "#fff7fb"} />
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: { borderBottomWidth: StyleSheet.hairlineWidth },
  rowContent: { paddingHorizontal: 10, paddingVertical: 10, gap: 12, alignItems: "flex-start" },
  bubble: { width: 74, alignItems: "center", gap: 5 },
  ring: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  ringGap: { width: 67, height: 67, borderRadius: 34, alignItems: "center", justifyContent: "center" },
  plus: { position: "absolute", right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 11, fontWeight: "600", maxWidth: 72 },
  skeleton: { width: 66, height: 66, borderRadius: 33 },
  hint: { width: 220, justifyContent: "center", height: 70 },
  hintText: { fontSize: 12, lineHeight: 17 },
  viewer: { flex: 1 },
  tapZones: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, flexDirection: "row" },
  top: { position: "absolute", left: 0, right: 0, top: 0, paddingHorizontal: 10, gap: 10 },
  bars: { flexDirection: "row", gap: 3 },
  bar: { flex: 1, height: 2.5, borderRadius: 2 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  topLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  poster: { color: "#fff7fb", fontWeight: "800", fontSize: 14 },
  time: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  topBtn: { padding: 6 },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14 },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: "rgba(15,12,15,0.55)" },
  pillText: { color: "#fff7fb", fontWeight: "700", fontSize: 13 },
  captionWrap: { position: "absolute", left: 20, right: 20, bottom: 110 },
  captionCenter: { top: 0, bottom: 0, justifyContent: "center" },
  caption: { color: "#fff7fb", fontSize: 16, fontWeight: "600", textAlign: "center", textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 6 },
  captionBig: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
});
