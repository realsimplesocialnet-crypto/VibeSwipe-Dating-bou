import {
  getGetMyReferralSummaryQueryKey,
  getGetNotificationsQueryKey,
  useGetNotifications,
  useMarkNotificationRead,
} from "@workspace/api-client-react";
import { useUser } from "@clerk/react";
import { Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function ReferralToastHost() {
  const { isSignedIn } = useUser();
  const queryClient = useQueryClient();
  const notifications = useGetNotifications({
    query: {
      enabled: Boolean(isSignedIn),
      refetchInterval: isSignedIn ? 5_000 : false,
      refetchOnWindowFocus: true,
    },
  });
  const markRead = useMarkNotificationRead();
  const [toastId, setToastId] = useState<string | null>(null);
  const seenIds = useRef(new Set<string>());

  useEffect(() => {
    const referral = notifications.data?.notifications.find(
      (notification) =>
        notification.type === "referral_joined" &&
        !notification.readAt &&
        !seenIds.current.has(notification.id),
    );
    if (!referral) return;
    seenIds.current.add(referral.id);
    setToastId(referral.id);
    void markRead
      .mutateAsync({ notificationId: referral.id })
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetMyReferralSummaryQueryKey() });
      })
      .catch(() => undefined);
  }, [notifications.data, markRead, queryClient]);

  useEffect(() => {
    if (!toastId) return;
    const timer = window.setTimeout(() => setToastId(null), 3_600);
    return () => window.clearTimeout(timer);
  }, [toastId]);

  if (!toastId) return null;
  return (
    <div className="referral-toast" role="status" aria-live="polite" key={toastId}>
      <span className="referral-toast-icon"><Sparkles size={17} /></span>
      <span>Someone just joined with your code! <strong>+100 points</strong></span>
    </div>
  );
}
