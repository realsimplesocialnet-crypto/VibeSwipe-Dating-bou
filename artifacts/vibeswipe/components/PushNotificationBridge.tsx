import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetMessagesQueryKey,
  getGetNotificationsQueryKey,
  getGetMatchPresenceQueryKey,
  getGetTypingStatusQueryKey,
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

  useEffect(() => {
    if (Platform.OS === "web") return;
    const openChat = (response: Notifications.NotificationResponse) => {
      const identifier = response.notification.request.identifier;
      if (handledResponse.current === identifier) return;
      handledResponse.current = identifier;
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
