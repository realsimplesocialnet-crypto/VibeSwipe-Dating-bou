import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Alert, AppState, Platform } from "react-native";
import { useAuth } from "@clerk/expo";
import { canEnrollNativePush, devicePushOptedOut, getDeviceToken, prepareMessageChannel } from "@/lib/push-enrollment";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetMessagesQueryKey,
  getGetNotificationsQueryKey,
  getGetMatchPresenceQueryKey,
  getGetTypingStatusQueryKey,
  getGetMatchesQueryKey,
  useGetMyProfile,
  useGetVibeSwipeSettings,
  useSaveNativePushToken,
} from "@workspace/api-client-react";

function matchIdFromResponse(
  response: Notifications.NotificationResponse,
): string | null {
  const value = response.notification.request.content.data?.matchId;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function PushNotificationBridge() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const handledResponse = useRef("");
  const { isLoaded, isSignedIn } = useAuth();
  const profile = useGetMyProfile({ query: { enabled: Platform.OS !== "web" && isLoaded && !!isSignedIn } });
  const preferences = useGetVibeSwipeSettings({ query: { enabled: Platform.OS !== "web" && !!isSignedIn && !!profile.data?.id } });
  const saveToken = useSaveNativePushToken();
  const askedAccount = useRef("");

  useEffect(() => {
    const accountId = profile.data?.id;
    if (!isSignedIn || !accountId || !preferences.isSuccess || !preferences.data.notifyMessages || !canEnrollNativePush()) return;
    let active = true;
    let syncing = false;
    const register = async (ask: boolean) => {
      if (!active || syncing) return;
      syncing = true;
      try {
        if (await devicePushOptedOut(accountId)) return;
        // Android 13+ must have its channel before requesting notification permission.
        await prepareMessageChannel();
        const current = await Notifications.getPermissionsAsync();
        const permission = !current.granted && ask ? await Notifications.requestPermissionsAsync() : current;
        if (!active || !permission.granted) return;
        const token = await getDeviceToken();
        if (active) await saveToken.mutateAsync({ data: { token } });
      } catch {
        if (active) console.warn("Message notifications need reconnecting in Settings.");
      } finally { syncing = false; }
    };
    const reconnect = async () => {
      try {
        if (await devicePushOptedOut(accountId)) return;
        const permission = await Notifications.getPermissionsAsync();
        if (!active) return;
        if (permission.granted) { await register(false); return; }
        if (!permission.canAskAgain || askedAccount.current === accountId) return;
        askedAccount.current = accountId;
        Alert.alert("Enable message notifications", "Get new message alerts even when MyAgeBeauty is closed.", [
          { text: "Not now", style: "cancel" },
          { text: "Enable", onPress: () => void register(true) },
        ]);
      } catch { /* The Settings page offers an explicit retry. */ }
    };
    void reconnect();
    const listener = AppState.addEventListener("change", state => { if (state === "active") void reconnect(); });
    return () => { active = false; listener.remove(); };
  }, [isSignedIn, profile.data?.id, preferences.isSuccess, preferences.data?.notifyMessages]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const openChat = (response: Notifications.NotificationResponse) => {
      const identifier = response.notification.request.identifier;
      if (handledResponse.current === identifier) return;
      handledResponse.current = identifier;
      if (response.notification.request.content.data?.type === "reel_like") {
        router.push("/(tabs)/activity" as never);
        return;
      }
      const matchId = matchIdFromResponse(response);
      if (!matchId) return;
      router.push({ pathname: "/chat/[matchId]", params: { matchId } });
    };
    const responseListener =
      Notifications.addNotificationResponseReceivedListener(openChat);
    const receivedListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        const matchId = notification.request.content.data?.matchId;
        void queryClient.invalidateQueries({
          queryKey: getGetNotificationsQueryKey(),
        });
        void queryClient.invalidateQueries({ queryKey: getGetMatchesQueryKey() });
        if (typeof matchId !== "string") return;
        void queryClient.invalidateQueries({
          queryKey: getGetMessagesQueryKey(matchId),
        });
        void queryClient.invalidateQueries({
          queryKey: getGetTypingStatusQueryKey(matchId),
        });
        void queryClient.invalidateQueries({
          queryKey: getGetMatchPresenceQueryKey(matchId),
        });
      },
    );
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) openChat(response);
    });
    return () => {
      responseListener.remove();
      receivedListener.remove();
    };
  }, [queryClient, router]);

  return null;
}
