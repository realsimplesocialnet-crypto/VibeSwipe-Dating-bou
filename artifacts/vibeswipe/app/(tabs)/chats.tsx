import { useGetMatches } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useColors } from "@/hooks/useColors";

export default function ChatsScreen() {
  const colors = useColors();
  const matches = useGetMatches({ query: { refetchInterval: 10_000 } });
  const chats = matches.data ?? [];
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>Conversations</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Only your mutual matches can message you.</Text>
      {matches.isLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : null}
      {!matches.isLoading && !chats.length ? (
        <View style={styles.empty}>
          <Feather name="message-circle" size={30} color={colors.primary} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No conversations yet</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Match with someone to start chatting.</Text>
        </View>
      ) : null}
      <FlatList
        data={chats}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: "/chat/[matchId]", params: { matchId: item.id } })} style={[styles.row, { borderBottomColor: colors.border }]}>
            <ProfileAvatar profile={item.profile} />
            <View style={styles.copy}>
              <Text style={[styles.name, { color: colors.foreground }]}>{item.profile.name}</Text>
              <Text numberOfLines={1} style={[styles.last, { color: colors.mutedForeground }]}>{item.lastMessage || "Send the first message"}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </Pressable>
        )}
        refreshing={matches.isRefetching}
        onRefresh={() => void matches.refetch()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20, paddingTop: 70, paddingBottom: 90 },
  title: { fontSize: 27, fontWeight: "700", letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 6, marginBottom: 16 },
  row: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  copy: { flex: 1, gap: 5 },
  name: { fontSize: 15, fontWeight: "700" },
  last: { fontSize: 12 },
  empty: { alignItems: "center", marginTop: 100, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: "700" },
});
