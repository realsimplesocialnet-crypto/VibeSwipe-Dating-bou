import {
  ChatTheme,
  getGetChatReadReceiptQueryKey,
  getGetMessagesQueryKey,
  getGetMatchesQueryKey,
  getGetMatchPresenceQueryKey,
  getGetTypingStatusQueryKey,
  type ChatTheme as ChatThemeType,
  type Message,
  type MediaUploadInputContentType,
  useBlockProfile,
  useClearChat,
  useDeleteMessage,
  useGetChatReadReceipt,
  useGetIcebreakers,
  useGetMatchPresence,
  useGetMatches,
  useGetMessages,
  useGetTypingStatus,
  useMarkChatRead,
  useReportProfile,
  useRequestChatMediaUpload,
  useSendMessage,
  useTranscodeProfileVideo,
  useUnblockProfile,
  useUnmatchMatch,
  useUpdateChatTheme,
  useUpdateTypingStatus,
} from "@workspace/api-client-react";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { fetch as expoFetch } from "expo/fetch";
import { KeyboardAvoidingView, useKeyboardState } from "react-native-keyboard-controller";
import { router, useLocalSearchParams } from "expo-router";
import { type ComponentRef, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MAX_VOICE_NOTE_BYTES } from "@workspace/api-client-react";
import { VoiceNoteRecorder } from "@/components/VoiceNoteRecorder";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { ChatAudioMessage } from "@/components/ChatMedia";
import { ChatMediaMessage } from "@/components/ChatMediaMessage";
import { useColors } from "@/hooks/useColors";
import { mediaUri } from "@/lib/media";

const THEME_OPTIONS: { key: ChatThemeType; label: string; color: string }[] = [
  { key: ChatTheme.pink, label: "Pink", color: "#e84768" },
  { key: ChatTheme.blue, label: "Blue", color: "#3678d4" },
  { key: ChatTheme.purple, label: "Purple", color: "#8b5bd5" },
  { key: ChatTheme.green, label: "Green", color: "#238b63" },
  { key: ChatTheme.dark, label: "Dark", color: "#28242a" },
  { key: ChatTheme.light, label: "Light", color: "#f4eeee" },
];
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const MAX_AUDIO_BYTES = MAX_VOICE_NOTE_BYTES;

function formatTime(date: string): string {
  return new Date(date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatLastSeen(date: string | null | undefined): string {
  if (!date) return "Last seen recently";
  const then = new Date(date);
  if (Number.isNaN(then.getTime())) return "Last seen recently";
  const now = new Date();
  const sameDay = then.toDateString() === now.toDateString();
  return `Last seen ${sameDay ? `today at ${formatTime(date)}` : then.toLocaleDateString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
}

function mediaTheme(theme: ChatThemeType, fallback: string): string {
  return THEME_OPTIONS.find((option) => option.key === theme)?.color ?? fallback;
}

export default function ChatScreen() {
  const appColors = useColors();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardState(state => state.isVisible);
  const queryClient = useQueryClient();
  const { getToken, userId } = useAuth();
  const { matchId: rawId, returnTo: rawReturn } = useLocalSearchParams<{ matchId: string; returnTo?: string }>();
  const matchId = Array.isArray(rawId) ? rawId[0] : rawId;
  const returnKey = Array.isArray(rawReturn) ? rawReturn[0] : rawReturn;
  const returnPath = returnKey === "messages" ? "/(tabs)/views"
    : returnKey === "discover" ? "/(tabs)"
    : returnKey === "views" ? "/(tabs)/views"
    : returnKey === "activity" ? "/(tabs)/activity"
    : returnKey === "notifications" ? "/notifications"
    : "/(tabs)/matches";
  const matches = useGetMatches({ query: { refetchInterval: 10_000 } });
  const match = matches.data?.find((item) => item.id === matchId);
  const darkChat = match?.chatTheme === ChatTheme.dark;
  const colors = {
    ...appColors,
    background: darkChat ? appColors.chatDarkBackground : appColors.chatBackground,
    foreground: darkChat ? appColors.chatDarkForeground : appColors.chatForeground,
    card: darkChat ? appColors.chatDarkCard : appColors.chatCard,
    mutedForeground: darkChat ? appColors.chatDarkMuted : appColors.chatMuted,
    border: darkChat ? appColors.chatDarkBorder : appColors.chatBorder,
    accent: darkChat ? appColors.chatDarkSoft : appColors.chatSoft,
    primary: appColors.chatPink,
    primaryForeground: appColors.chatOnAccent,
  };
  const messages = useGetMessages(matchId ?? "", { query: { enabled: !!match } });
  const presence = useGetMatchPresence(matchId ?? "", {
    query: { enabled: !!match, refetchInterval: 15_000 },
  });
  const typing = useGetTypingStatus(matchId ?? "", {
    query: { enabled: !!match, refetchInterval: 2_500 },
  });
  const readReceipt = useGetChatReadReceipt(matchId ?? "", {
    query: { enabled: !!match, refetchInterval: 5_000 },
  });
  const icebreakers = useGetIcebreakers({ query: { enabled: !!match } });
  const sendMessage = useSendMessage();
  const blockProfile = useBlockProfile();
  const unblockProfile = useUnblockProfile();
  const reportProfile = useReportProfile();
  const clearChat = useClearChat();
  const unmatch = useUnmatchMatch();
  const updateTheme = useUpdateChatTheme();
  const requestUpload = useRequestChatMediaUpload();
  const transcodeVideo = useTranscodeProfileVideo();
  const updateTyping = useUpdateTypingStatus();
  const updateTypingStatus = updateTyping.mutate;
  const markRead = useMarkChatRead();
  const deleteMessage = useDeleteMessage();

  const [draft, setDraft] = useState("");
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busyMedia, setBusyMedia] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const uploadedVoice = useRef<{ uri: string; reference: string } | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [themeVisible, setThemeVisible] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMarkedMessage = useRef("");
  const listRef = useRef<FlatList<Message> | null>(null);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const blocked = !!match?.blockedByMe || !!match?.blockedMe;
  const chatAccent = [ChatTheme.blue, ChatTheme.purple, ChatTheme.green].some((theme) => theme === match?.chatTheme)
    ? mediaTheme(match!.chatTheme, colors.primary) : colors.primary;
  const themedBackground = messages.data?.length === 0 ? colors.profileGradientMiddle : colors.background;
  const themedForeground = colors.foreground;

  useEffect(() => {
    if (!matches.isLoading && matches.data && !match) router.replace(returnPath as never);
  }, [match, matches.data, matches.isLoading, returnPath]);

  useEffect(() => {
    let active = true;
    void getToken().then((value) => {
      if (active) setAuthToken(value);
    });
    return () => { active = false; };
  }, [getToken]);

  const addMessage = useCallback((message: Message) => {
    if (!matchId || message.matchId !== matchId) return;
    queryClient.setQueryData<Message[]>(getGetMessagesQueryKey(matchId), (current = []) => {
      const byId = new Map(current.map((item) => [item.id, item]));
      byId.set(message.id, message);
      return [...byId.values()].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id.localeCompare(a.id),
      );
    });
  }, [matchId, queryClient]);

  useEffect(() => {
    if (!match || !matchId || messages.isLoading) return;
    let active = true;
    let stopAfterCloseEvent = false;
    const controller = new AbortController();
    const queryKey = getGetMessagesQueryKey(matchId);
    const apiBaseUrl = process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
      : "/api";

    async function connect(): Promise<void> {
      let retryDelay = 500;
      while (active && !stopAfterCloseEvent) {
        try {
          const token = await getToken();
          if (!token || !active) return;
          const current = queryClient.getQueryData<Message[]>(queryKey) ?? [];
          const afterId = current[0]?.id;
          const response = await expoFetch(`${apiBaseUrl}/vibeswipe/matches/${matchId}/messages/events`, {
            headers: {
              Accept: "text/event-stream",
              Authorization: `Bearer ${token}`,
              ...(afterId ? { "Last-Event-ID": afterId } : {}),
            },
            signal: controller.signal,
          });
          if (response.status === 401 || response.status === 403) return;
          if (!response.ok || !response.body) throw new Error(`Chat stream failed with status ${response.status}`);
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
                if (eventName === "message" && data.length) {
                  try { addMessage(JSON.parse(data.join("\n")) as Message); } catch { /* Keep stream alive on malformed events. */ }
                } else if (["typing", "read", "presence"].includes(eventName)) {
                  const key = eventName === "typing" ? getGetTypingStatusQueryKey(matchId)
                    : eventName === "read" ? getGetChatReadReceiptQueryKey(matchId)
                    : getGetMatchPresenceQueryKey(matchId);
                  void queryClient.invalidateQueries({ queryKey: key });
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
  }, [addMessage, getToken, match, matchId, messages.isLoading, queryClient]);

  useEffect(() => {
    if (!matchId || blocked) return;
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      updateTypingStatus({ matchId, data: { isTyping: draft.length > 0 } });
    }, 300);
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [blocked, draft, matchId, updateTypingStatus]);

  useEffect(() => {
    const latest = messages.data?.[0];
    if (!matchId || !latest || !userId || latest.senderId === userId || latest.id === lastMarkedMessage.current) return;
    lastMarkedMessage.current = latest.id;
    markRead.mutate({ matchId }, { onSuccess: () => { void queryClient.invalidateQueries({ queryKey: getGetMatchesQueryKey() }); } });
  }, [markRead, matchId, messages.data, queryClient, userId]);

  useEffect(() => () => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
  }, []);

  async function send(content: string, media?: { reference: string; type: "image" | "video" | "audio"; duration?: number }) {
    if (!matchId || sendMessage.isPending || blocked) {
      if (media) throw new Error("Messaging is currently unavailable. Please try again.");
      return;
    }
    if (!content.trim() && !media) return;
    const oldDraft = draft;
    if (!media) setDraft("");
    try {
      const payload = media
        ? { ...(content.trim() ? { content: content.trim() } : {}), mediaReference: media.reference, mediaType: media.type, ...(media.duration ? { mediaDuration: media.duration } : {}) }
        : { content: content.trim() };
      const message = await sendMessage.mutateAsync({ matchId, data: payload });
      addMessage(message);
      updateTyping.mutate({ matchId, data: { isTyping: false } });
      setError("");
    } catch (caught) {
      if (!media) setDraft(current => current && current !== oldDraft ? [oldDraft, current].filter(Boolean).join("\n") : oldDraft);
      setError("Message could not be sent. Please try again.");
      if (media) throw caught;
    }
  }

  async function uploadMedia(
    uri: string,
    name: string,
    type: "image" | "video" | "audio",
    fileSize?: number,
    duration?: number,
    contentTypeHint?: string | null,
  ) {
    if (!matchId) return;
    const file = new File(uri);
    const size = fileSize ?? file.size;
    const supportedTypes: MediaUploadInputContentType[] = [
      "image/jpeg", "image/png", "image/webp", "image/heic", "video/mp4", "video/quicktime",
      "audio/mp4", "audio/m4a", "audio/aac", "audio/wav",
    ];
    const fallbackType: MediaUploadInputContentType = type === "image" ? "image/jpeg"
      : type === "video" ? "video/mp4" : "audio/m4a";
    const contentType = supportedTypes.includes(contentTypeHint as MediaUploadInputContentType)
      ? contentTypeHint as MediaUploadInputContentType
      : fallbackType;
    const maxSize = type === "image" ? MAX_IMAGE_BYTES : type === "video" ? MAX_VIDEO_BYTES : MAX_AUDIO_BYTES;
    if (size <= 0 || size > maxSize) throw new Error(type === "image" ? "Choose an image smaller than 15 MB." : type === "video" ? "Choose a video smaller than 500 MB." : "Voice notes have no time cutoff, but files must be smaller than 500 MB.");
    if (type === "audio" && uploadedVoice.current?.uri === uri) {
      await send("", { reference: uploadedVoice.current.reference, type, duration });
      uploadedVoice.current = null;
      return;
    }
    const result = await requestUpload.mutateAsync({
      matchId,
      data: { name, size, contentType, mediaType: type },
    });
    const uploaded = await expoFetch(result.uploadURL, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: file as unknown as BodyInit,
    });
    if (!uploaded.ok) throw new Error("The media upload could not be completed.");
    if (type === "video") {
      const transcoded = await transcodeVideo.mutateAsync({ mediaId: result.mediaId });
      await send("", { reference: transcoded.mediaReference || result.mediaReference, type });
    } else {
      if (type === "audio") uploadedVoice.current = { uri, reference: result.mediaReference };
      await send("", { reference: result.mediaReference, type, ...(duration ? { duration } : {}) });
      if (type === "audio") uploadedVoice.current = null;
    }
  }

  async function chooseAttachment() {
    setError("");
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Allow photo library access to attach a photo or video.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.88,
      videoMaxDuration: 60,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const type = asset.type === "video" ? "video" : "image";
    setBusyMedia(true);
    try {
      await uploadMedia(asset.uri, asset.fileName ?? `${type}-${Date.now()}`, type, asset.fileSize, undefined, asset.mimeType);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The attachment could not be sent.");
    } finally {
      setBusyMedia(false);
    }
  }

  function confirmDelete(message: Message) {
    if (!matchId) return;
    const own = message.senderId === userId;
    const options = [
      { text: "Delete for me", onPress: () => void deleteMessageFor(message, false) },
      ...(own ? [{ text: "Delete for everyone", style: "destructive" as const, onPress: () => void deleteMessageFor(message, true) }] : []),
      { text: "Cancel", style: "cancel" as const },
    ];
    Alert.alert("Delete message?", "Choose who should no longer see this message.", options);
  }

  async function deleteMessageFor(message: Message, forEveryone: boolean) {
    if (!matchId) return;
    try {
      await deleteMessage.mutateAsync({ matchId, messageId: message.id, data: { forEveryone } });
      if (!forEveryone) {
        queryClient.setQueryData<Message[]>(getGetMessagesQueryKey(matchId), (current = []) => current.filter((item) => item.id !== message.id));
      }
      await messages.refetch();
    } catch {
      setError("Message could not be deleted. Please try again.");
    }
  }

  async function blockOrUnblock() {
    if (!match || !matchId) return;
    try {
      if (match.blockedByMe) {
        await unblockProfile.mutateAsync({ targetUserId: match.profile.id });
      } else {
        await blockProfile.mutateAsync({ data: { targetUserId: match.profile.id } });
      }
      await queryClient.invalidateQueries({ queryKey: getGetMatchesQueryKey() });
      setMenuVisible(false);
    } catch {
      setError(match.blockedByMe ? "Could not unblock this person. Try again." : "Could not block this person. Try again.");
    }
  }

  function reportProfileAction() {
    if (!match) return;
    Alert.alert("Report profile", "Choose a reason for your report.", [
      ...(["spam", "fake", "inappropriate", "harassment", "other"] as const).map((reason) => ({
        text: reason[0].toUpperCase() + reason.slice(1),
        onPress: async () => {
          try {
            await reportProfile.mutateAsync({ data: { targetUserId: match.profile.id, reason } });
            setMenuVisible(false);
            Alert.alert("Report submitted", "Thank you. We’ll review this profile.");
          } catch {
            setError("The report could not be submitted. Please try again.");
          }
        },
      })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  }

  function chooseTheme(theme: ChatThemeType) {
    if (!matchId) return;
    updateTheme.mutate({ matchId, data: { theme } }, {
      onSuccess: () => {
        queryClient.setQueryData(getGetMatchesQueryKey(), (current: typeof matches.data) =>
          current?.map((item) => item.id === matchId ? { ...item, chatTheme: theme } : item));
        setThemeVisible(false);
        setMenuVisible(false);
      },
      onError: () => setError("Chat color couldn’t be saved. Please try again."),
    });
  }

  function menuAction(action: string) {
    if (!matchId) return;
    setMenuVisible(false);
    if (action === "Search chat") {
      setSearchVisible((visible) => !visible);
      setSearchText("");
      setSearchIndex(0);
    } else if (action === "Block" || action === "Unblock") {
      Alert.alert(`${action} ${match?.profile.name}?`, action === "Block" ? "They won’t be able to message you." : "They will be able to interact with you again.", [
        { text: action, style: action === "Block" ? "destructive" : "default", onPress: () => void blockOrUnblock() },
        { text: "Cancel", style: "cancel" },
      ]);
    } else if (action === "Report") {
      reportProfileAction();
    } else if (action === "Change chat color") {
      setThemeVisible(true);
    } else if (action === "Clear chat") {
      Alert.alert("Clear chat?", "This removes messages from your chat view only.", [
        { text: "Clear chat", style: "destructive", onPress: async () => {
          try {
            await clearChat.mutateAsync({ matchId });
            queryClient.setQueryData<Message[]>(getGetMessagesQueryKey(matchId), []);
          } catch {
            setError("Chat couldn’t be cleared. Please try again.");
          }
        } },
        { text: "Cancel", style: "cancel" },
      ]);
    } else if (action === "Unmatch") {
      Alert.alert(`Unmatch ${match?.profile.name}?`, "This removes the match and shared chat history.", [
        { text: "Unmatch", style: "destructive", onPress: async () => {
          try {
            await unmatch.mutateAsync({ matchId });
            await queryClient.invalidateQueries({ queryKey: getGetMatchesQueryKey() });
            router.replace(returnPath as never);
          } catch {
            setError("Could not unmatch. Please try again.");
          }
        } },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }

  const sortedMessages = messages.data ?? [];
  const searchMatchIndexes = searchText.trim()
    ? sortedMessages
        .map((message, index) =>
          message.content.toLowerCase().includes(searchText.trim().toLowerCase())
            ? index
            : -1,
        )
        .filter((index) => index >= 0)
    : [];
  useEffect(() => {
    if (!searchVisible || searchMatchIndexes.length === 0) return;
    const index = searchMatchIndexes[Math.min(searchIndex, searchMatchIndexes.length - 1)];
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    }, 80);
    return () => clearTimeout(timer);
  }, [searchIndex, searchMatchIndexes.join(","), searchVisible]);

  if (matches.isLoading || !match) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  }

  const otherIsTyping = typing.data?.isTyping === true;
  const lastReadAt = readReceipt.data?.readAt;
  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: themedBackground }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: Math.max(insets.top, Platform.OS === "web" ? 67 : 12) }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.canGoBack() ? router.back() : router.replace(returnPath as never)} style={styles.back}>
          <Feather name="arrow-left" size={21} color={themedForeground} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${match.profile.name}'s profile`}
          testID="chat-profile-header"
          onPress={() => router.push({ pathname: "/profile/[profileId]", params: { profileId: match.profile.id } })}
          style={styles.headerProfile}
        >
          <View style={[styles.avatarWrap, { borderColor: colors.primary }]}>
            <ProfileAvatar profile={match.profile} size={44} />
            {presence.data?.isOnline ? <View style={[styles.onlineDot, { backgroundColor: colors.chatOnline, borderColor: colors.background }]} /> : null}
          </View>
          <View style={styles.headerCopy}>
            <Text numberOfLines={1} style={[styles.name, { color: themedForeground }]}>{match.profile.name}</Text>
            <Text numberOfLines={2} style={[styles.status, { color: colors.mutedForeground }]}>A conversation just for your mutual match</Text>
            {typing.data?.isTyping || presence.data?.isOnline || presence.data?.lastSeenAt ? <Text numberOfLines={1} style={[styles.status, { color: presence.data?.isOnline ? colors.chatOnline : colors.mutedForeground }]}>{typing.data?.isTyping ? "Typing…" : presence.data?.isOnline ? "Online" : formatLastSeen(presence.data?.lastSeenAt)}</Text> : null}
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Chat actions" testID="chat-actions" onPress={() => setMenuVisible(true)} style={styles.more}>
          <Feather name="more-vertical" size={21} color={themedForeground} />
        </Pressable>
      </View>

      {searchVisible ? (
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TextInput
            autoFocus
            value={searchText}
            onChangeText={(value) => { setSearchText(value); setSearchIndex(0); }}
            placeholder="Search messages"
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="search"
            style={[styles.searchInput, { color: themedForeground }]}
          />
          <Text style={[styles.searchCount, { color: colors.mutedForeground }]}>
            {searchMatchIndexes.length ? `${Math.min(searchIndex + 1, searchMatchIndexes.length)} / ${searchMatchIndexes.length}` : "0"}
          </Text>
          <Pressable accessibilityLabel="Previous result" onPress={() => setSearchIndex((i) => (i - 1 + searchMatchIndexes.length) % Math.max(searchMatchIndexes.length, 1))} style={styles.searchArrow}>
            <Feather name="chevron-up" size={19} color={themedForeground} />
          </Pressable>
          <Pressable accessibilityLabel="Next result" onPress={() => setSearchIndex((i) => (i + 1) % Math.max(searchMatchIndexes.length, 1))} style={styles.searchArrow}>
            <Feather name="chevron-down" size={19} color={themedForeground} />
          </Pressable>
        </View>
      ) : null}

      {messages.isError ? (
        <Pressable accessibilityRole="button" onPress={() => void messages.refetch()} style={styles.errorBanner}>
          <Text accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>Messages couldn’t load. Tap to try again.</Text>
        </Pressable>
      ) : null}
      {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
      <FlatList
        ref={listRef}
        inverted={sortedMessages.length > 0}
        data={sortedMessages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.messageList, !sortedMessages.length && styles.emptyMessageList]}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        scrollEnabled
        ListHeaderComponent={otherIsTyping ? <Text style={[styles.typing, { color: colors.mutedForeground }]}>{match.profile.name} is typing…</Text> : undefined}
        ListEmptyComponent={!messages.isError && !blocked ? (
          <View style={styles.icebreakerWrap} testID="chat-empty-conversation">
            <Ionicons name="heart" size={56} color={colors.primary} style={[styles.emptyIcon, { opacity: 0.5 }]} />
            <Text style={[styles.emptyTitle, { color: colors.primary, fontFamily: Platform.OS === "ios" ? "Georgia" : "serif" }]}>A good conversation starts here</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>Break the ice with a question</Text>
            <View style={styles.suggestionsHeading}><Ionicons name="sparkles-outline" size={22} color={colors.primary} /><Text style={[styles.suggestionsLabel, { color: colors.mutedForeground }]}>Suggested questions</Text></View>
            {icebreakers.isLoading ? <ActivityIndicator color={colors.primary} accessibilityLabel="Loading suggested questions" /> : null}
            {icebreakers.isError ? <Pressable onPress={() => void icebreakers.refetch()} testID="retry-chat-suggestions"><Text style={[styles.error, { color: colors.destructive }]}>Couldn’t load suggestions. Tap to retry.</Text></Pressable> : null}
            {icebreakers.data?.slice(0, 3).map((prompt, index) => (
              <Pressable
                key={prompt.id}
                accessibilityRole="button"
                accessibilityLabel={`Use suggested question: ${prompt.question}`}
                testID={`chat-suggestion-${index}`}
                disabled={busyMedia || sendMessage.isPending}
                onPress={() => { setDraft(prompt.question); inputRef.current?.focus(); }}
                style={[styles.icebreakerChip, { borderColor: colors.border, backgroundColor: colors.card }]}
              >
                <Feather name={index === 2 ? "music" : "coffee"} size={24} color={colors.primary} />
                <Text style={[styles.icebreakerText, { color: themedForeground }]}>{prompt.question}</Text>
              </Pressable>
            ))}
          </View>
        ) : undefined}
        renderItem={({ item }) => {
          const own = item.senderId === userId;
          const bubbleColor = own ? chatAccent : colors.card;
          const messageMedia = item.mediaReference ? mediaUri(item.mediaReference) : null;
          const tombstone = item.deletedForEveryone;
          const isSearchMatch =
            searchText.trim().length > 0 &&
            item.content.toLowerCase().includes(searchText.trim().toLowerCase());
          const isSelectedSearchMatch =
            isSearchMatch &&
            sortedMessages.indexOf(item) === searchMatchIndexes[searchIndex];
          return (
            <View style={[styles.messageRow, own ? styles.ownRow : styles.otherRow]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tombstone ? "Deleted message" : "Message. Hold for delete options."}
                delayLongPress={350}
                onLongPress={() => confirmDelete(item)}
                style={[
                  styles.bubble,
                  { backgroundColor: bubbleColor, borderColor: colors.border },
                  !own && styles.otherBubble,
                  tombstone && styles.deletedBubble,
                  isSearchMatch && { borderColor: "#FFD166", borderWidth: isSelectedSearchMatch ? 2 : 1 },
                ]}
              >
                {tombstone ? (
                  <Text style={[styles.deletedText, { color: own ? "#ffffff" : colors.mutedForeground }]}>
                    {item.content || "This message was deleted."}
                  </Text>
                ) : item.mediaType === "audio" && item.mediaReference ? (
                  <ChatAudioMessage reference={item.mediaReference} duration={item.mediaDuration ?? 1} token={authToken} getToken={getToken} foreground={own ? "#ffffff" : themedForeground} />
                ) : (item.mediaType === "image" || item.mediaType === "video") && messageMedia ? (
                  <ChatMediaMessage reference={item.mediaReference!} type={item.mediaType}/>
                ) : (
                  <Text style={[styles.messageText, { color: own ? "#ffffff" : themedForeground }]}>{item.content}</Text>
                )}
              </Pressable>
              <View style={[styles.messageMeta, own ? styles.ownMeta : styles.otherMeta]}>
                <Text style={[styles.time, { color: colors.mutedForeground }]}>{formatTime(item.createdAt)}</Text>
                {own && !tombstone ? (
                  <View
                    accessibilityLabel={item.isRead || (lastReadAt && new Date(lastReadAt).getTime() >= new Date(item.createdAt).getTime()) ? "Read" : "Sent"}
                    accessibilityRole="image"
                    style={styles.receiptChecks}
                  >
                    <Feather name="check" size={12} color={item.isRead || (lastReadAt && new Date(lastReadAt).getTime() >= new Date(item.createdAt).getTime()) ? chatAccent : colors.mutedForeground} />
                    <Feather name="check" size={12} color={item.isRead || (lastReadAt && new Date(lastReadAt).getTime() >= new Date(item.createdAt).getTime()) ? chatAccent : colors.mutedForeground} style={styles.secondCheck} />
                  </View>
                ) : null}
              </View>
            </View>
          );
        }}
        refreshing={messages.isRefetching}
        onRefresh={() => void messages.refetch()}
      />
      {blocked ? (
        <View style={[styles.blockedNotice, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, Platform.OS === "web" ? 34 : 10) }]}>
          <Feather name="slash" size={17} color={colors.mutedForeground} />
          <Text style={[styles.blockedText, { color: colors.mutedForeground }]}>
            {match.blockedByMe ? "You blocked this person." : "This person blocked you."}
          </Text>
        </View>
      ) : (
        <View testID="chat-composer" style={[styles.composer, { borderColor: colors.border, backgroundColor: colors.card, marginBottom: keyboardVisible ? 0 : Math.max(insets.bottom, 8) }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Attach photo or video" testID="chat-attachment" onPress={() => void chooseAttachment()} disabled={busyMedia || sendMessage.isPending || voiceActive} style={styles.attachButton}>
            {busyMedia ? <ActivityIndicator color={chatAccent} size="small" /> : <Feather name="image" size={24} color={colors.mutedForeground} />}
          </Pressable>
              <TextInput
                ref={inputRef}
                testID="chat-message-input"
                value={draft}
                onChangeText={setDraft}
                editable={!busyMedia && !sendMessage.isPending && !voiceActive}
                placeholder="Write a message"
                placeholderTextColor={colors.mutedForeground}
                multiline
                maxLength={2000}
                blurOnSubmit={false}
                style={[styles.input, { color: themedForeground, backgroundColor: colors.card, borderColor: colors.border }]}
              />
              <VoiceNoteRecorder key={matchId} disabled={busyMedia || sendMessage.isPending || blocked} onActiveChange={setVoiceActive}
                onSend={(uri, duration) => uploadMedia(uri, `voice-${Date.now()}.m4a`, "audio", undefined, duration)} />
              <Pressable testID="send-chat-message" accessibilityRole="button" accessibilityLabel="Send message" disabled={!draft.trim() || sendMessage.isPending || busyMedia || voiceActive} onPress={() => void send(draft)} style={[styles.sendButton, { backgroundColor: chatAccent, opacity: !draft.trim() || sendMessage.isPending || busyMedia || voiceActive ? 0.5 : 1 }]}>
                {sendMessage.isPending ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.sendLabel, { color: colors.primaryForeground }]}>Send</Text>}
              </Pressable>
        </View>
      )}

      <Modal transparent visible={menuVisible} animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={styles.modalScrim} onPress={() => setMenuVisible(false)}>
          <View style={[styles.menuSheet, { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 18) }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            {[
              "Search chat",
              match.blockedByMe ? "Unblock" : "Block",
              "Report",
              "Change chat color",
              "Clear chat",
              "Unmatch",
            ].map((action) => (
              <Pressable key={action} accessibilityRole="button" testID={`chat-action-${action.toLowerCase().replaceAll(" ", "-")}`} onPress={() => menuAction(action)} style={styles.menuItem}>
                <Feather name={action === "Search chat" ? "search" : action === "Block" || action === "Unblock" ? "slash" : action === "Report" ? "flag" : action === "Change chat color" ? "droplet" : action === "Clear chat" ? "trash-2" : "user-x"} size={18} color={action === "Block" || action === "Report" || action === "Unmatch" ? colors.destructive : colors.foreground} />
                <Text style={[styles.menuLabel, { color: action === "Block" || action === "Report" || action === "Unmatch" ? colors.destructive : colors.foreground }]}>{action}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal transparent visible={themeVisible} animationType="slide" onRequestClose={() => setThemeVisible(false)}>
        <Pressable style={styles.modalScrim} onPress={() => setThemeVisible(false)}>
          <View style={[styles.themeSheet, { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 18) }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.themeTitle, { color: colors.foreground }]}>Chat color</Text>
            <View style={styles.themeGrid}>
              {THEME_OPTIONS.map((option) => (
                <Pressable key={option.key} accessibilityRole="button" accessibilityLabel={`${option.label} chat theme`} testID={`chat-theme-${option.key}`} onPress={() => chooseTheme(option.key)} style={[styles.themeOption, { borderColor: match.chatTheme === option.key ? colors.primary : colors.border }]}>
                  <View style={[styles.themeSwatch, { backgroundColor: option.color }]} />
                  <Text style={[styles.themeName, { color: colors.foreground }]}>{option.label}</Text>
                  {match.chatTheme === option.key ? <Feather name="check" size={16} color={colors.primary} /> : null}
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 34, height: 42, justifyContent: "center" },
  headerProfile: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  avatarWrap: { width: 50, height: 50, padding: 2, borderWidth: 1, borderRadius: 25 },
  onlineDot: { position: "absolute", right: -1, bottom: 1, width: 11, height: 11, borderRadius: 6, borderWidth: 2 },
  headerCopy: { flex: 1, gap: 3 },
  name: { fontSize: 18, fontWeight: "700" },
  status: { fontSize: 11, lineHeight: 15 },
  more: { width: 36, height: 42, alignItems: "flex-end", justifyContent: "center" },
  searchBar: { minHeight: 48, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 7, borderBottomWidth: StyleSheet.hairlineWidth },
  searchInput: { flex: 1, height: 42, fontSize: 14 },
  searchCount: { fontSize: 11, minWidth: 32, textAlign: "center" },
  searchArrow: { width: 28, height: 36, alignItems: "center", justifyContent: "center" },
  messageList: { paddingHorizontal: 16, paddingVertical: 18, flexGrow: 1, justifyContent: "flex-end" },
  emptyMessageList: { justifyContent: "flex-start" },
  messageRow: { marginVertical: 5, maxWidth: "84%" },
  ownRow: { alignSelf: "flex-end", alignItems: "flex-end" },
  otherRow: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubble: { maxWidth: "100%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 19 },
  otherBubble: { borderWidth: 1 },
  deletedBubble: { borderRadius: 15, borderStyle: "dashed", borderWidth: 1 },
  deletedText: { fontSize: 13, fontStyle: "italic" },
  messageText: { fontSize: 14, lineHeight: 20 },
  messageMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3, marginHorizontal: 5 },
  ownMeta: { justifyContent: "flex-end" },
  otherMeta: { justifyContent: "flex-start" },
  time: { fontSize: 9 },
  receiptChecks: { width: 17, height: 14, flexDirection: "row", alignItems: "center" },
  secondCheck: { marginLeft: -7 },
  typing: { alignSelf: "flex-start", marginHorizontal: 7, marginVertical: 8, fontSize: 12, fontStyle: "italic" },
  emptyIcon: { marginTop: 14, marginBottom: 15 },
  emptyTitle: { maxWidth: 340, textAlign: "center", fontSize: 32, lineHeight: 36, fontWeight: "500", letterSpacing: -0.5 },
  emptySubtitle: { textAlign: "center", fontSize: 15, lineHeight: 22, marginTop: 8 },
  icebreakerWrap: { alignItems: "center", paddingVertical: 6, gap: 10 },
  suggestionsHeading: { width: "100%", flexDirection: "row", alignItems: "center", gap: 8, marginTop: 24, marginBottom: 3 },
  suggestionsLabel: { fontSize: 14, fontWeight: "500" },
  icebreakerChip: { width: "100%", minHeight: 64, borderWidth: 1, borderRadius: 17, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  icebreakerText: { flex: 1, fontSize: 14, lineHeight: 21, fontWeight: "500" },
  error: { textAlign: "center", marginVertical: 7, paddingHorizontal: 12, fontSize: 12 },
  errorBanner: { minHeight: 34, justifyContent: "center" },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 6, padding: 8, marginHorizontal: 12, marginTop: 8, borderWidth: 1, borderRadius: 22 },
  attachButton: { width: 40, height: 42, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, minWidth: 0, minHeight: 44, maxHeight: 120, paddingHorizontal: 4, paddingTop: 11, paddingBottom: 9, fontSize: 14 },
  sendButton: { minWidth: 66, height: 44, paddingHorizontal: 12, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  sendLabel: { fontSize: 15, fontWeight: "700" },
  voiceButton: { width: 28, height: 42, alignItems: "center", justifyContent: "center" },
  recordingPill: { flex: 1, minHeight: 44, borderRadius: 23, borderWidth: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 9 },
  recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#d44358" },
  recordingText: { flex: 1, fontSize: 13 },
  recordSend: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#e84768", alignItems: "center", justifyContent: "center" },
  blockedNotice: { minHeight: 56, flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center", borderTopWidth: StyleSheet.hairlineWidth },
  blockedText: { fontSize: 13 },
  modalScrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.42)" },
  menuSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 10 },
  themeSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10 },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 15 },
  menuItem: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: 14 },
  menuLabel: { fontSize: 15, fontWeight: "600" },
  themeTitle: { fontSize: 18, fontWeight: "700", marginBottom: 15 },
  themeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  themeOption: { width: "48%", minHeight: 58, borderWidth: 1, borderRadius: 14, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, gap: 9 },
  themeSwatch: { width: 23, height: 23, borderRadius: 12, borderWidth: 1, borderColor: "rgba(0,0,0,0.12)" },
  themeName: { flex: 1, fontSize: 13, fontWeight: "600" },
});
