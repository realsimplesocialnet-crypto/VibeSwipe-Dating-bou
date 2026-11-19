import {
  getGetDirectChatMessagesQueryKey, getGetDirectChatsQueryKey,
  useGetDirectChatMessages, useGetDirectChats, useGetMyProfile,
  useMarkDirectChatRead, useSendDirectChatMessage,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView, useKeyboardState } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useColors } from "@/hooks/useColors";
import type { DirectMessage } from "@workspace/api-client-react";

export default function DirectChatScreen() {
  const { conversationId = "" } = useLocalSearchParams<{ conversationId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardState(state => state.isVisible);
  const me = useGetMyProfile();
  const conversations = useGetDirectChats({ query: { queryKey: getGetDirectChatsQueryKey(), refetchInterval: 5000 } });
  const conversation = conversations.data?.find(item => item.id === conversationId);
  const params = { conversationId, limit: 50 };
  const messages = useGetDirectChatMessages(params, { query: { queryKey: getGetDirectChatMessagesQueryKey(params), enabled: Boolean(conversationId), refetchInterval: 5000 } });
  const markRead = useMarkDirectChatRead();
  const send = useSendDirectChatMessage();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const data = useMemo(() => [...(messages.data?.items ?? [])].reverse(), [messages.data?.items]);

  useEffect(() => {
    if (!conversationId || !messages.data) return;
    void markRead.mutateAsync({ conversationId }).then(() => {
      void conversations.refetch();
    }).catch(() => undefined);
  }, [conversationId, messages.dataUpdatedAt]);

  async function submit() {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      await send.mutateAsync({ data: { conversationId, content } });
      setDraft("");
      await Promise.all([messages.refetch(), conversations.refetch()]);
      input.current?.focus();
    } catch (error) {
      Alert.alert("Message didn’t send", error instanceof Error ? error.message : "Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  function renderMessage({ item }: { item: DirectMessage }) {
    const own = item.senderId === me.data?.id;
    return <View style={[styles.messageRow, own ? styles.ownRow : styles.otherRow]}>
      <View style={[styles.bubble, { backgroundColor: own ? colors.primary : colors.card, borderColor: colors.border }]}>
        <Text style={{ color: own ? colors.primaryForeground : colors.foreground, fontSize: 15, lineHeight: 20 }}>{item.content}</Text>
        <Text style={[styles.time, { color: own ? colors.primaryForeground : colors.mutedForeground }]}>{new Date(item.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}{own && item.readAt ? " · Seen" : ""}</Text>
      </View>
    </View>;
  }

  return <KeyboardAvoidingView style={[styles.page, { backgroundColor: colors.background }]} behavior="padding" keyboardVerticalOffset={0}>
    <View style={[styles.header, { paddingTop: insets.top + 6, borderBottomColor: colors.border }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to chats" onPress={() => router.replace("/messages")} style={styles.back}><Feather name="arrow-left" size={21} color={colors.primary}/></Pressable>
      {conversation?.profile ? <ProfileAvatar profile={conversation.profile} size={40}/> : <View style={[styles.avatarFallback,{backgroundColor:colors.accent}]}><Feather name="user" size={18} color={colors.primary}/></View>}
      <View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={{ color: colors.foreground, fontSize: 15, fontWeight: "800" }}>{conversation?.profile.name ?? "Conversation"}</Text><Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Direct message</Text></View>
    </View>
    {messages.isError && <Pressable onPress={()=>void messages.refetch()} style={styles.error}><Text style={{color:colors.destructive,fontSize:13}}>Messages could not load. Tap to retry.</Text></Pressable>}
    {messages.isLoading ? <ActivityIndicator color={colors.primary} style={{flex:1}}/> : <FlatList
      data={data}
      inverted
      renderItem={renderMessage}
      keyExtractor={item=>item.id}
      style={{ flex: 1 }}
      contentContainerStyle={[styles.list, { paddingBottom: 12 }]}
      automaticallyAdjustKeyboardInsets={false}
      contentInsetAdjustmentBehavior="never"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      scrollEnabled={data.length > 0}
      ListEmptyComponent={<Text style={[styles.empty,{color:colors.mutedForeground}]}>Start the conversation with a message.</Text>}
      testID="direct-chat-messages"
    />}
    <View style={[styles.composer, { paddingBottom: keyboardVisible ? 0 : Math.max(insets.bottom, 8), borderTopColor: colors.border, backgroundColor: colors.background }]}>
      <TextInput
        ref={input}
        value={draft}
        onChangeText={setDraft}
        maxLength={2000}
        placeholder="Message"
        placeholderTextColor={colors.mutedForeground}
        accessibilityLabel="Message"
        testID="input-direct-message"
        returnKeyType="send"
        blurOnSubmit={false}
        onSubmitEditing={()=>void submit()}
        style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
      />
      <Pressable accessibilityRole="button" accessibilityLabel="Send message" testID="button-send-direct-message" disabled={!draft.trim() || sending} onPress={()=>void submit()} style={[styles.send,{backgroundColor:colors.primary,opacity:!draft.trim()||sending?0.55:1}]}>
        {sending?<ActivityIndicator size="small" color={colors.primaryForeground}/>:<Feather name="arrow-up" size={20} color={colors.primaryForeground}/>}
      </Pressable>
    </View>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 38, height: 42, alignItems: "center", justifyContent: "center" },
  avatarFallback: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  list: { flexGrow: 1, justifyContent: "flex-end", paddingHorizontal: 12 },
  messageRow: { width: "100%", marginVertical: 3, flexDirection: "row" },
  ownRow: { justifyContent: "flex-end" },
  otherRow: { justifyContent: "flex-start" },
  bubble: { maxWidth: "84%", borderRadius: 18, borderWidth: 1, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 5 },
  time: { fontSize: 9, textAlign: "right", marginTop: 4 },
  empty: { textAlign: "center", marginVertical: 28, fontSize: 13, transform: [{ scaleY: -1 }] },
  error: { padding: 12, alignItems: "center" },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingTop: 8, paddingHorizontal: 10, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, borderWidth: 1, paddingHorizontal: 15, paddingVertical: 11, fontSize: 16 },
  send: { height: 42, width: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
});
