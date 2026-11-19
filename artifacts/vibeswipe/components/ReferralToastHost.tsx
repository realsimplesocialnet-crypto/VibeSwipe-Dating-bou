import {
  getGetMyReferralSummaryQueryKey,
  getGetNotificationsQueryKey,
  useMarkNotificationRead,
  type GetNotificationsQueryResult,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePremiumColors } from "@/hooks/useColors";

export function ReferralToastHost({ data }: { data?: GetNotificationsQueryResult }) {
  const colors = usePremiumColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const markRead = useMarkNotificationRead();
  const [toastId, setToastId] = useState<string | null>(null);
  const seenIds = useRef(new Set<string>());
  const translateY = useRef(new Animated.Value(-26)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const referral = data?.notifications.find(
      (notification) =>
        notification.type === "referral_joined" &&
        !notification.readAt &&
        !seenIds.current.has(notification.id),
    );
    if (!referral) return;
    seenIds.current.add(referral.id);
    setToastId(referral.id);
    translateY.setValue(-26);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 16, stiffness: 190 }),
      Animated.timing(opacity, { toValue: 1, duration: 170, useNativeDriver: true }),
    ]).start();
    void markRead
      .mutateAsync({ notificationId: referral.id })
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetMyReferralSummaryQueryKey() });
      })
      .catch(() => undefined);
  }, [data, markRead, queryClient, translateY, opacity]);

  useEffect(() => {
    if (!toastId) return;
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -12, duration: 180, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => setToastId(null));
    }, 3_350);
    return () => clearTimeout(timer);
  }, [toastId, translateY, opacity]);

  if (!toastId) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        position: "absolute",
        zIndex: 1000,
        top: insets.top + 8,
        left: 16,
        right: 16,
        opacity,
        transform: [{ translateY }],
      }}
    >
      <View style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 8 }}>
        <Feather name="star" size={17} color={colors.primary} />
        <Text style={{ flex: 1, color: colors.foreground, fontSize: 13, fontWeight: "600" }}>
          Someone just joined with your code! <Text style={{ color: colors.primary, fontWeight: "800" }}>+100 points</Text>
        </Text>
      </View>
    </Animated.View>
  );
}
