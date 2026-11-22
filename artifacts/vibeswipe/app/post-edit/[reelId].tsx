import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getGetMyReelsQueryKey,
  getGetReelQueryKey,
  getGetSocialFeedQueryKey,
  useGetReel,
  useUpdateSocialPost,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

export default function EditPostScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { reelId = "" } = useLocalSearchParams<{ reelId: string }>();
  const reel = useGetReel(reelId, { query: { queryKey: getGetReelQueryKey(reelId), enabled: !!reelId } });
  const update = useUpdateSocialPost();
  const [caption, setCaption] = useState("");
  const [audience, setAudience] = useState<"public" | "friends">("public");
  const [allowDownloads, setAllowDownloads] = useState(false);
  const [error, setError] = useState("");
  const initFor = useRef<string | null>(null);
  useEffect(() => {
    if (reel.data && initFor.current !== reel.data.id) {
      initFor.current = reel.data.id;
      setCaption(reel.data.caption);
      setAudience(reel.data.audience === "friends" ? "friends" : "public");
      setAllowDownloads(reel.data.canDownload);
    }
  }, [reel.data]);

  async function save() {
    setError("");
    try {
      const updated = await update.mutateAsync({ reelId, data: { caption: caption.trim(), audience, allowDownloads } });
      queryClient.setQueryData(getGetReelQueryKey(reelId), updated);
      void queryClient.invalidateQueries({ queryKey: getGetSocialFeedQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetMyReelsQueryKey() });
      router.back();
    } catch {
      setError("Changes weren't saved. Try again.");
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={[styles.bar, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Text style={{ color: colors.foreground, fontSize: 15 }}>Cancel</Text></Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Edit post</Text>
        <Pressable onPress={() => void save()} disabled={update.isPending || !reel.data} hitSlop={10} testID="post-edit-save">
          {update.isPending ? <ActivityIndicator color={colors.primary} /> : <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 15 }}>Done</Text>}
        </Pressable>
      </View>
      {reel.isLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : !reel.data ? (
        <View style={{ alignItems: "center", padding: 30, gap: 10 }}>
          <Text style={{ color: colors.foreground, fontWeight: "700" }}>This post isn't available.</Text>
          <Pressable onPress={() => void reel.refetch()}><Text style={{ color: colors.primary, fontWeight: "700" }}>Retry</Text></Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 18 }} keyboardShouldPersistTaps="handled">
          <View>
            <TextInput value={caption} onChangeText={setCaption} maxLength={300} multiline placeholder="Write a caption" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} testID="post-edit-caption" />
            <Text style={[styles.counter, { color: colors.mutedForeground }]}>{caption.length}/300</Text>
          </View>
          <View style={{ gap: 8 }}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>WHO CAN SEE THIS</Text>
            {(["public", "friends"] as const).map((a) => (
              <Pressable key={a} onPress={() => setAudience(a)} style={[styles.option, { borderColor: audience === a ? colors.primary : colors.border, backgroundColor: colors.card }]} accessibilityRole="radio" accessibilityState={{ selected: audience === a }}>
                <Feather name={a === "public" ? "globe" : "users"} size={18} color={colors.foreground} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontWeight: "700" }}>{a === "public" ? "Public" : "Friends"}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{a === "public" ? "Followers and Explore, subject to your privacy settings" : "Only people who follow each other with you"}</Text>
                </View>
                <Feather name={audience === a ? "check-circle" : "circle"} size={18} color={audience === a ? colors.primary : colors.mutedForeground} />
              </Pressable>
            ))}
          </View>
          <View style={[styles.option, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Feather name="download" size={18} color={colors.foreground} />
            <Text style={{ flex: 1, color: colors.foreground, fontWeight: "700" }}>Allow downloads</Text>
            <Switch value={allowDownloads} onValueChange={setAllowDownloads} trackColor={{ true: colors.primary, false: colors.border }} />
          </View>
          {error ? <Text accessibilityRole="alert" style={{ color: colors.destructive }}>{error}</Text> : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 16, fontWeight: "800" },
  input: { minHeight: 110, borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 15, textAlignVertical: "top" },
  counter: { alignSelf: "flex-end", fontSize: 11, marginTop: 4 },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  option: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
});
