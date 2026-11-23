import { getGetMyReferralSummaryQueryKey, useGetMyReferralSummary } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Share, Pressable, Text, View } from "react-native";
import { useState } from "react";
import { usePremiumColors } from "@/hooks/useColors";

const SIGNUP_URL = "https://myage.beauty/sign-up";

export function ReferralProfileCard() {
  const colors = usePremiumColors();
  const summary = useGetMyReferralSummary({
    query: {
      queryKey: getGetMyReferralSummaryQueryKey(),
      refetchInterval: 15_000,
      refetchOnWindowFocus: true,
    },
  });
  const [feedback, setFeedback] = useState("");

  async function copyCode() {
    if (!summary.data) return;
    try {
      await Clipboard.setStringAsync(summary.data.referralCode);
      setFeedback("Code copied");
    } catch {
      setFeedback("Could not copy code");
    }
  }

  async function shareCode() {
    if (!summary.data) return;
    const url = `${SIGNUP_URL}?ref=${encodeURIComponent(summary.data.referralCode)}`;
    const message = `Join me on MyAgeBeauty with my referral code ${summary.data.referralCode}. Your signup helps me earn points.\n${url}`;
    try {
      await Share.share({ title: "Join me on MyAgeBeauty", message, url });
    } catch {
      setFeedback("Could not share invite");
    }
  }

  return (
    <View
      testID="referral-profile-card"
      style={{ marginTop: 12, padding: 12, borderRadius: 16, backgroundColor: colors.profileCard, width: "100%" }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Feather name="star" size={13} color={colors.profileEdit} />
            <Text style={{ color: colors.profileLabel, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 }}>REFERRAL POINTS</Text>
          </View>
          {summary.isLoading ? (
            <Text style={{ color: colors.profileMuted, fontSize: 12, marginTop: 5 }}>Loading your referral code…</Text>
          ) : summary.isError || !summary.data ? (
            <Pressable onPress={() => void summary.refetch()} accessibilityRole="button" accessibilityLabel="Retry loading referral points">
              <Text style={{ color: colors.profileMuted, fontSize: 12, marginTop: 5 }}>Could not load. Tap to retry.</Text>
            </Pressable>
          ) : (
            <>
              <Text style={{ color: colors.profileLabel, fontSize: 14, fontWeight: "800", letterSpacing: 2, marginTop: 5 }}>
                {summary.data.referralCode}
              </Text>
              <Text style={{ color: colors.profileMuted, fontSize: 12, marginTop: 2 }}>
                {summary.data.points} points · {summary.data.referralCount} joined
              </Text>
            </>
          )}
        </View>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <Pressable
            testID="button-copy-referral-code"
            accessibilityRole="button"
            accessibilityLabel="Copy referral code"
            disabled={!summary.data}
            onPress={() => void copyCode()}
            style={{ minHeight: 36, flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 18, paddingHorizontal: 10, backgroundColor: colors.profileChip, opacity: summary.data ? 1 : 0.5 }}
          >
            <Feather name="copy" size={13} color={colors.profileEdit} />
            <Text style={{ color: colors.profileEdit, fontSize: 11, fontWeight: "700" }}>Copy</Text>
          </Pressable>
          <Pressable
            testID="button-share-referral-code"
            accessibilityRole="button"
            accessibilityLabel="Share referral code"
            disabled={!summary.data}
            onPress={() => void shareCode()}
            style={{ minHeight: 36, flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 18, paddingHorizontal: 10, backgroundColor: colors.profileChip, opacity: summary.data ? 1 : 0.5 }}
          >
            <Feather name="share-2" size={13} color={colors.profileEdit} />
            <Text style={{ color: colors.profileEdit, fontSize: 11, fontWeight: "700" }}>Share</Text>
          </Pressable>
        </View>
      </View>
      {feedback ? <Text accessibilityRole="status" style={{ color: colors.profileMuted, fontSize: 11, marginTop: 5 }}>{feedback}</Text> : null}
    </View>
  );
}
