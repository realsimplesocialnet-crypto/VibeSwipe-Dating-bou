import {
  getGetMessagesQueryKey,
  type Message,
  useGetMatches,
  useGetMessages,
  useSendMessage,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { fetch as expoFetch } from "expo/fetch";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useColors } from "@/hooks/useColors";

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { getToken, userId } = useAuth();
  const { matchId: rawId } = useLocalSearchParams<{ matchId: string }>();
  const matchId = Array.isArray(rawId) ? rawId[0] : rawId;
  const matches = useGetMatches({ query: { refetchInterval: 10_000 } });
  const match = matches.data?.find((item) => item.id === matchId);
  const messages = useGetMessages(matchId ?? "", {
    query: { enabled: !!match },
  });
  const sendMessage = useSendMessage();
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!matches.isLoading && matches.data && !match) router.replace("/(tabs)/matches");
  }, [match, matches.data, matches.isLoading]);

  useEffect(() => {
    if (!match || !matchId || messages.isLoading) return;

    let active = true;
    let stopAfterCloseEvent = false;
    const controller = new AbortController();
    const queryKey = getGetMessagesQueryKey(matchId);
    const apiBaseUrl = process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
      : "/api";

    const addMessage = (message: Message): void => {
      if (message.matchId !== matchId) return;
      queryClient.setQueryData<Message[]>(queryKey, (current = []) => {
        const byId = new Map(current.map((item) => [item.id, item]));
        byId.set(message.id, message);
        return [...byId.values()].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
            b.id.localeCompare(a.id),
        );
      });
    };

    async function connect(): Promise<void> {
      let retryDelay = 500;
      while (active && !stopAfterCloseEvent) {
        try {
          const token = await getToken();
          if (!token || !active) return;
          const current = queryClient.getQueryData<Message[]>(queryKey) ?? [];
          const afterId = current[0]?.id;
          const response = await expoFetch(
            `${apiBaseUrl}/vibeswipe/matches/${matchId}/messages/events`,
            {
              headers: {
                Accept: "text/event-stream",
                Authorization: `Bearer ${token}`,
                ...(afterId ? { "Last-Event-ID": afterId } : {}),
              },
              signal: controller.signal,
            },
          );

          if (response.status === 401 || response.status === 403) return;
          if (!response.ok || !response.body) {
            throw new Error(`Chat stream failed with status ${response.status}`);
          }

          retryDelay = 500;
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          try {
            while (active) {
              const { value, done } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
              let boundary = buffer.indexOf("\n\n");
              while (boundary >= 0) {
                const frame = buffer.slice(0, boundary);
                buffer = buffer.slice(boundary + 2);
                let eventName = "message";
                const data: string[] = [];
                for (const line of frame.split("\n")) {
                  if (line.startsWith("event:")) eventName = line.slice(6).trim();
                  if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
                }
                if (eventName === "close") {
                  stopAfterCloseEvent = true;
                  break;
                }
                if (eventName === "message" && data.length > 0) {
                  try {
                    addMessage(JSON.parse(data.join("\n")) as Message);
                  } catch {
                    // Ignore malformed event payloads and keep the stream alive.
                  }
                }
                boundary = buffer.indexOf("\n\n");
              }
              if (stopAfterCloseEvent) break;
            }
          } finally {
            reader.releaseLock();
          }
        } catch {
          if (!active || controller.signal.aborted) return;
        }

        if (!active || stopAfterCloseEvent) return;
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        retryDelay = Math.min(retryDelay * 2, 8_000);
      }
    }

    void connect();
    return () => {
      active = false;
      controller.abort();
    };
  }, [getToken, match, matchId, messages.isLoading, queryClient]);

  async function send() {
    const content = draft.trim();
    if (!content || !matchId || sendMessage.isPending) return;
    setDraft("");
    try {
      const message = await sendMessage.mutateAsync({ matchId, data: { content } });
      queryClient.setQueryData<Message[]>(getGetMessagesQueryKey(matchId), (current = []) => {
        if (current.some((item) => item.id === message.id)) return current;
        return [message, ...current];
      });
    } catch {
      setDraft(content);
    }
  }

  if (matches.isLoading || !match) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top + 12}
    >
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable onPress={() => router.back()} style={styles.back}><Feather name="arrow-left" size={21} color={colors.foreground} /></Pressable>
        <ProfileAvatar profile={match.profile} size={42} />
        <View style={styles.headerCopy}>
          <Text style={[styles.name, { color: colors.foreground }]}>{match.profile.name}</Text>
          <Text style={[styles.status, { color: colors.mutedForeground }]}>Your match</Text>
        </View>
      </View>
      {messages.isError ? <Text style={[styles.error, { color: colors.destructive }]}>Messages couldn’t load. Try again.</Text> : null}
      <FlatList
        inverted
        data={messages.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        ListEmptyComponent={<Text style={[styles.empty, { color: colors.mutedForeground }]}>Say hello to start the conversation.</Text>}
        renderItem={({ item }) => {
          const own = item.senderId === userId;
          return (
            <View style={[styles.messageRow, own ? styles.ownRow : styles.otherRow]}>
              <View style={[styles.bubble, own ? { backgroundColor: colors.primary } : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
                <Text style={[styles.messageText, { color: own ? "#ffffff" : colors.foreground }]}>{item.content}</Text>
              </View>
              <Text style={[styles.time, { color: colors.mutedForeground }]}>{new Date(item.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Text>
            </View>
          );
        }}
        refreshing={messages.isRefetching}
        onRefresh={() => void messages.refetch()}
      />
      <View style={[styles.composer, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TextInput
          testID="chat-message-input"
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a message…"
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={2000}
          style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
        />
        <Pressable testID="send-chat-message" accessibilityLabel="Send message" disabled={!draft.trim() || sendMessage.isPending} onPress={() => void send()} style={[styles.sendButton, { backgroundColor: colors.primary, opacity: draft.trim() ? 1 : 0.55 }]}>
          <Feather name="arrow-up" size={20} color="#ffffff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 34, height: 42, justifyContent: "center" },
  headerCopy: { gap: 3 },
  name: { fontSize: 15, fontWeight: "700" },
  status: { fontSize: 11 },
  messageList: { paddingHorizontal: 16, paddingVertical: 18, flexGrow: 1, justifyContent: "flex-end" },
  messageRow: { marginVertical: 5, maxWidth: "84%" },
  ownRow: { alignSelf: "flex-end", alignItems: "flex-end" },
  otherRow: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  messageText: { fontSize: 14, lineHeight: 20 },
  time: { fontSize: 9, marginTop: 3, marginHorizontal: 5 },
  empty: { textAlign: "center", transform: [{ scaleY: -1 }], marginTop: 16, fontSize: 13 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 9, paddingHorizontal: 14, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 9, fontSize: 14 },
  sendButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", marginBottom: 1 },
  error: { textAlign: "center", marginTop: 10, fontSize: 12 },
});
