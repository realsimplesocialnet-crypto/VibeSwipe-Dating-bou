import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGetMatches, useReportProfile, type ReportInputReason } from "@workspace/api-client-react";

const reasons: { value: ReportInputReason; label: string }[] = [
  { value: "spam", label: "Spam or scam" },
  { value: "fake", label: "Fake profile" },
  { value: "inappropriate", label: "Inappropriate" },
  { value: "harassment", label: "Harassment" },
  { value: "other", label: "Other" },
];

export default function ReportSafetyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const matches = useGetMatches({ query: { refetchInterval: 15_000 } });
  const report = useReportProfile();
  const people = matches.data ?? [];
  const [targetUserId, setTargetUserId] = useState("");
  const [reason, setReason] = useState<ReportInputReason>("spam");
  const [details, setDetails] = useState("");
  const selectedId = targetUserId || people[0]?.profile.id || "";

  async function submit() {
    if (!selectedId) {
      Alert.alert("Choose a profile", "Select a matched profile to report.");
      return;
    }
    try {
      await report.mutateAsync({
        data: {
          targetUserId: selectedId,
          reason,
          ...(details.trim() ? { details: details.trim() } : {}),
        },
      });
      setDetails("");
      Alert.alert("Report sent", "Thank you. Myage’s safety team will review this profile.");
    } catch {
      Alert.alert("Could not send report", "Check your connection and try again.");
    }
  }

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 28 }]}
      bottomOffset={20}
      keyboardShouldPersistTaps="handled"
      testID="screen-report-safety"
    >
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={styles.back}>
        <Feather name="arrow-left" size={20} color={colors.foreground} />
      </Pressable>
      <View style={styles.heading}>
        <View style={[styles.icon, { backgroundColor: colors.accent }]}>
          <Feather name="shield" size={20} color={colors.primary} />
        </View>
        <View style={styles.headingCopy}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>MYAGE SAFETY</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Report a scam or safety issue</Text>
        </View>
      </View>
      <View style={[styles.warning, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <Feather name="alert-triangle" size={17} color={colors.primary} />
        <Text style={[styles.warningText, { color: colors.mutedForeground }]}>Never send money, bank details, passwords, or verification codes. Meet for the first time in a public place and tell someone you trust.</Text>
      </View>

      {matches.isLoading ? (
        <Text style={[styles.help, { color: colors.mutedForeground }]} accessibilityRole="progressbar">Loading your conversations…</Text>
      ) : people.length ? (
        <View style={[styles.form, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.foreground }]}>Choose a matched profile</Text>
          {people.map((match) => {
            const selected = selectedId === match.profile.id;
            return (
              <Pressable key={match.profile.id} onPress={() => setTargetUserId(match.profile.id)} accessibilityRole="radio" accessibilityState={{ selected }} style={[styles.person, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.accent : colors.background }]}>
                <View style={styles.personCopy}>
                  <Text style={[styles.personName, { color: colors.foreground }]}>{match.profile.name}</Text>
                  <Text style={[styles.help, { color: colors.mutedForeground }]}>{match.profile.city || "Myage member"}</Text>
                </View>
                <Feather name={selected ? "check-circle" : "circle"} size={19} color={selected ? colors.primary : colors.mutedForeground} />
              </Pressable>
            );
          })}
          <Text style={[styles.help, { color: colors.mutedForeground }]}>For someone you have not matched with, open their profile in Discover and choose Report from the profile menu.</Text>

          <Text style={[styles.label, { color: colors.foreground, marginTop: 4 }]}>What happened?</Text>
          <View style={styles.reasonGrid}>
            {reasons.map((item) => {
              const selected = reason === item.value;
              return (
                <Pressable key={item.value} onPress={() => setReason(item.value)} accessibilityRole="radio" accessibilityState={{ selected }} style={[styles.reason, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.accent : colors.background }]}>
                  <Text style={[styles.reasonText, { color: selected ? colors.primary : colors.mutedForeground }]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: colors.foreground }]}>Details (optional)</Text>
          <TextInput
            value={details}
            onChangeText={setDetails}
            maxLength={1000}
            multiline
            textAlignVertical="top"
            placeholder="Describe what happened. Do not include passwords or bank details."
            placeholderTextColor={colors.mutedForeground}
            style={[styles.details, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
            testID="input-report-details"
          />
          <Text style={[styles.counter, { color: colors.mutedForeground }]}>{details.length}/1000</Text>
          <Pressable onPress={() => void submit()} disabled={report.isPending} accessibilityRole="button" testID="button-submit-safety-report" style={[styles.submit, { backgroundColor: colors.primary, opacity: report.isPending ? 0.6 : 1 }]}>
            <Text style={[styles.submitText, { color: colors.background }]}>{report.isPending ? "Sending report…" : "Send report"}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{matches.isError ? "Conversations could not load" : "No matched profiles to choose from"}</Text>
          <Text style={[styles.help, { color: colors.mutedForeground }]}>You can report anyone in Discover by opening their profile menu and choosing Report.</Text>
          <Pressable onPress={() => router.push("/(tabs)")} style={[styles.submit, { backgroundColor: colors.primary }]} testID="link-report-from-discover">
            <Text style={[styles.submitText, { color: colors.background }]}>Open Discover</Text>
          </Pressable>
        </View>
      )}
      <Pressable onPress={() => router.push("/safety-center")} style={[styles.safetyLink, { borderColor: colors.border }]}>
        <Feather name="book-open" size={16} color={colors.primary} />
        <Text style={[styles.safetyLinkText, { color: colors.foreground }]}>Open Safety Center</Text>
        <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
      </Pressable>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 15 },
  back: { width: 40, height: 40, justifyContent: "center" },
  heading: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  headingCopy: { flex: 1, gap: 3 },
  eyebrow: { fontSize: 9, letterSpacing: 1.6, fontWeight: "800" },
  title: { fontSize: 23, fontWeight: "800", lineHeight: 29 },
  warning: { borderWidth: 1, borderRadius: 15, padding: 13, flexDirection: "row", alignItems: "flex-start", gap: 9 },
  warningText: { flex: 1, fontSize: 12, lineHeight: 18 },
  form: { borderWidth: 1, borderRadius: 20, padding: 15, gap: 10 },
  label: { fontSize: 13, fontWeight: "700", marginTop: 4 },
  person: { minHeight: 54, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  personCopy: { flex: 1, gap: 2 },
  personName: { fontSize: 14, fontWeight: "700" },
  help: { fontSize: 12, lineHeight: 18 },
  reasonGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reason: { minHeight: 40, borderWidth: 1, borderRadius: 12, paddingHorizontal: 11, justifyContent: "center" },
  reasonText: { fontSize: 12, fontWeight: "700" },
  details: { minHeight: 100, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  counter: { fontSize: 11, textAlign: "right", marginTop: -6 },
  submit: { minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 14, marginTop: 3 },
  submitText: { fontSize: 14, fontWeight: "800" },
  empty: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 10 },
  emptyTitle: { fontSize: 15, fontWeight: "800" },
  safetyLink: { minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  safetyLinkText: { flex: 1, fontSize: 13, fontWeight: "700" },
});
