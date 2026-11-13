import { useGetMatches } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useColors } from "@/hooks/useColors";

export default function MatchesScreen() {
  const colors = useColors();
  const matches = useGetMatches();
  const data = matches.data ?? [];
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>Your matches</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>A mutual like is a good place to start.</Text>
      {matches.isLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : null}
      {matches.isError ? <Text style={[styles.empty, { color: colors.mutedForeground }]}>Couldn’t load matches. Pull to refresh or try again.</Text> : null}
      {!matches.isLoading && !data.length ? (
        <View style={styles.emptyWrap}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.accent }]}><Feather name="heart" size={25} color={colors.primary} /></View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Your matches will show here</Text>
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>When you both like each other, you can start a chat.</Text>
        </View>
      ) : null}
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable testID={`match-${item.id}`} onPress={() => router.push({ pathname: "/chat/[matchId]", params: { matchId: item.id } })} style={[styles.row, { borderBottomColor: colors.border }]}>
            <ProfileAvatar profile={item.profile} size={58} />
            <View style={styles.copy}>
              <Text style={[styles.name, { color: colors.foreground }]}>{item.profile.name}, {item.profile.age}</Text>
              <Text style={[styles.last, { color: colors.mutedForeground }]}>{item.lastMessage || "Say hello and start a conversation"}</Text>
            </View>
            <Feather name="message-circle" size={20} color={colors.primary} />
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
  list: { paddingBottom: 20 },
  row: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  copy: { flex: 1, gap: 5 },
  name: { fontSize: 15, fontWeight: "700" },
  last: { fontSize: 12 },
  emptyWrap: { alignItems: "center", marginTop: 90, paddingHorizontal: 25, gap: 10 },
  emptyIcon: { width: 62, height: 62, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  empty: { fontSize: 13, textAlign: "center", lineHeight: 20, marginTop: 5 },
});
