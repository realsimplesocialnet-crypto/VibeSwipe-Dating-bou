import { Feather } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useColors } from "@/hooks/useColors";

const HOBBY_OPTIONS = [
  "Travel", "Music", "Cooking", "Sports", "Gym / Fitness", "Reading", "Gaming", "Movies",
  "Photography", "Dancing", "Hiking", "Fashion", "Art", "Business", "Technology", "Shopping",
  "Nightlife", "Food", "Coffee", "Writing", "Yoga", "Nature", "Volunteering", "Design",
  "Camping", "Beach", "Pets", "Live music", "Gardening", "Outdoors",
] as const;
const MAX_PROFILE_HOBBIES = 12;
const OCCUPATION_OPTIONS = [
  "Student", "Entrepreneur/Business Owner", "Freelancer", "Software Developer", "Designer",
  "Content Creator", "Influencer", "Sales", "Marketing", "Teacher", "Nurse/Doctor", "Driver",
  "Trader", "Civil Servant", "Banker", "Fashion Designer", "Photographer", "Chef", "Unemployed",
  "Prefer not to say", "Other",
] as const;

export function HobbyMultiSelect({
  value,
  onChange,
  testID = "profile-hobbies",
}: {
  value: string[];
  onChange: (value: string[]) => void;
  testID?: string;
}) {
  const colors = useColors();
  const selected = Array.isArray(value) ? value : [];

  function toggle(hobby: string) {
    if (selected.includes(hobby)) {
      onChange(selected.filter((item) => item !== hobby));
    } else if (selected.length < MAX_PROFILE_HOBBIES) {
      onChange([...selected, hobby]);
    }
  }

  return (
    <View testID={testID} style={styles.container}>
      <Text style={[styles.helper, { color: colors.mutedForeground }]}>
        Choose up to {MAX_PROFILE_HOBBIES}. Tap a selected item in the list or its chip to remove it.
      </Text>
      {selected.length > 0 ? (
        <View accessibilityLabel="Selected hobbies" style={styles.selectedList}>
          {selected.map((hobby) => (
            <Pressable
              key={`selected-${hobby}`}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${hobby}`}
              onPress={() => onChange(selected.filter((item) => item !== hobby))}
              style={[styles.selectedChip, { backgroundColor: colors.accent }]}
            >
              <Text style={[styles.selectedText, { color: colors.primary }]}>{hobby}</Text>
              <Feather name="x" size={12} color={colors.primary} />
            </Pressable>
          ))}
        </View>
      ) : null}
      <ScrollView
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        style={[styles.hobbyScroll, { borderColor: colors.border, backgroundColor: colors.card }]}
      >
        <View style={styles.hobbyList}>
          {HOBBY_OPTIONS.map((hobby) => {
            const active = selected.includes(hobby);
            const limitReached = !active && selected.length >= MAX_PROFILE_HOBBIES;
            return (
              <Pressable
                key={hobby}
                testID={`${testID}-${hobby.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active, disabled: limitReached }}
                disabled={limitReached}
                onPress={() => toggle(hobby)}
                style={[
                  styles.hobbyChip,
                  {
                    backgroundColor: active ? colors.accent : colors.background,
                    borderColor: active ? colors.primary : colors.border,
                    opacity: limitReached ? 0.45 : 1,
                  },
                ]}
              >
                {active ? <Feather name="check" size={14} color={colors.primary} /> : null}
                <Text style={[styles.hobbyText, { color: active ? colors.primary : colors.foreground }]}>{hobby}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <Text accessibilityLiveRegion="polite" style={[styles.helper, { color: colors.mutedForeground }]}>
        {selected.length} selected
      </Text>
    </View>
  );
}

export function OccupationSelect({
  value,
  otherValue,
  onChange,
  onOtherChange,
  testID = "profile-occupation",
}: {
  value: string;
  otherValue: string;
  onChange: (value: string) => void;
  onOtherChange: (value: string) => void;
  testID?: string;
}) {
  const colors = useColors();

  return (
    <View testID={testID} style={styles.container}>
      <Text style={[styles.helper, { color: colors.mutedForeground }]}>
        Choose one. You can leave “Other” blank if you prefer.
      </Text>
      <ScrollView
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        style={[styles.occupationList, { borderColor: colors.border, backgroundColor: colors.card }]}
      >
        {OCCUPATION_OPTIONS.map((occupation) => {
          const active = value === occupation;
          return (
            <Pressable
              key={occupation}
              testID={`${testID}-${occupation.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(occupation)}
              style={[styles.occupationRow, { borderBottomColor: colors.border }]}
            >
              <Text style={[styles.occupationText, { color: active ? colors.primary : colors.foreground, fontWeight: active ? "700" : "500" }]}>
                {occupation}
              </Text>
              {active ? <Feather name="check-circle" size={18} color={colors.primary} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
      {value === "Other" ? (
        <TextInput
          testID={`${testID}-other`}
          value={otherValue}
          onChangeText={onOtherChange}
          maxLength={80}
          placeholder="Your work or occupation (optional)"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.otherInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  helper: { fontSize: 12, lineHeight: 18 },
  selectedList: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  selectedChip: { borderRadius: 18, paddingHorizontal: 10, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 5 },
  selectedText: { fontSize: 12, fontWeight: "700" },
  hobbyScroll: { maxHeight: 260, borderWidth: 1, borderRadius: 14 },
  hobbyList: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 10 },
  hobbyChip: { minHeight: 42, borderWidth: 1, borderRadius: 16, paddingHorizontal: 11, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 5 },
  hobbyText: { fontSize: 12, fontWeight: "600" },
  occupationList: { maxHeight: 330, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12 },
  occupationRow: { minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  occupationText: { flex: 1, fontSize: 14 },
  otherInput: { minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, fontSize: 14 },
});
