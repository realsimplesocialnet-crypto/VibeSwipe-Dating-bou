import { useSaveMyProfile } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { MediaPicker } from "@/components/MediaPicker";
import { useColors } from "@/hooks/useColors";

export default function OnboardingScreen() {
  const colors = useColors();
  const saveProfile = useSaveMyProfile();
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("Woman");
  const [lookingFor, setLookingFor] = useState("Everyone");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [interestsText, setInterestsText] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [error, setError] = useState("");

  async function complete() {
    setError("");
    const parsedAge = Number(age);
    if (parsedAge < 18) {
      setError("VibeSwipe is for adults 18 and older.");
      return;
    }
    if (!adultConfirmed) {
      setError("Confirm that you are at least 18 years old.");
      return;
    }
    if (photos.length === 0) {
      setError("Add at least one photo to continue.");
      return;
    }
    try {
      await saveProfile.mutateAsync({
        data: {
          name: name.trim(),
          age: parsedAge,
          gender,
          lookingFor,
          bio: bio.trim(),
          city: city.trim(),
          interests: interestsText.split(",").map((value) => value.trim()).filter(Boolean).slice(0, 12),
          photos,
          videoUrl,
          preferences: { ageMin: 22, ageMax: 35, gender: "Everyone", distanceKm: 50 },
        },
      });
      router.replace("/(tabs)");
    } catch {
      setError("Your profile could not be saved. Check your details and try again.");
    }
  }

  return (
    <KeyboardAwareScrollViewCompat style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.container} bottomOffset={30}>
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: colors.accent }]}><Feather name="user-plus" size={22} color={colors.primary} /></View>
        <Text style={[styles.step, { color: colors.mutedForeground }]}>YOUR PROFILE · 1 OF 1</Text>
      </View>
      <Text style={[styles.title, { color: colors.foreground }]}>Let people meet the real you.</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>You can update this any time.</Text>

      <Text style={[styles.label, { color: colors.foreground }]}>Photos</Text>
      <MediaPicker photos={photos} videoUrl={videoUrl} onChange={(value) => { setPhotos(value.photos); setVideoUrl(value.videoUrl); }} />

      <Text style={[styles.label, { color: colors.foreground }]}>Name</Text>
      <TextInput testID="profile-name" value={name} onChangeText={setName} placeholder="What should we call you?" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} />
      <View style={styles.twoFields}>
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.foreground }]}>Age</Text>
          <TextInput testID="profile-age" value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="18+" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} />
        </View>
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.foreground }]}>City</Text>
          <TextInput testID="profile-city" value={city} onChangeText={setCity} placeholder="Lagos" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} />
        </View>
      </View>
      <Text style={[styles.label, { color: colors.foreground }]}>Gender</Text>
      <View style={styles.choiceRow}>
        {["Woman", "Man", "Non-binary"].map((value) => (
          <Pressable key={value} onPress={() => setGender(value)} style={[styles.choice, { borderColor: gender === value ? colors.primary : colors.border, backgroundColor: gender === value ? colors.accent : colors.card }]}>
            <Text style={{ color: gender === value ? colors.primary : colors.foreground, fontWeight: "600" }}>{value}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={[styles.label, { color: colors.foreground }]}>Looking for</Text>
      <View style={styles.choiceRow}>
        {["Everyone", "Woman", "Man"].map((value) => (
          <Pressable key={value} onPress={() => setLookingFor(value)} style={[styles.choice, { borderColor: lookingFor === value ? colors.primary : colors.border, backgroundColor: lookingFor === value ? colors.accent : colors.card }]}>
            <Text style={{ color: lookingFor === value ? colors.primary : colors.foreground, fontWeight: "600" }}>{value}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={[styles.label, { color: colors.foreground }]}>About you</Text>
      <TextInput testID="profile-bio" value={bio} onChangeText={setBio} multiline maxLength={500} placeholder="A little about what you enjoy…" placeholderTextColor={colors.mutedForeground} style={[styles.input, styles.bioInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} />
      <Text style={[styles.label, { color: colors.foreground }]}>Interests</Text>
      <TextInput value={interestsText} onChangeText={setInterestsText} placeholder="Music, food, travel" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} />
      <Pressable onPress={() => setAdultConfirmed((current) => !current)} style={styles.confirmRow}>
        <View style={[styles.check, { borderColor: adultConfirmed ? colors.primary : colors.border, backgroundColor: adultConfirmed ? colors.primary : "transparent" }]}>
          {adultConfirmed ? <Feather name="check" size={14} color="#ffffff" /> : null}
        </View>
        <Text style={[styles.confirmText, { color: colors.mutedForeground }]}>I confirm that I am 18 years old or older.</Text>
      </Pressable>
      {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
      <Pressable testID="complete-onboarding" disabled={saveProfile.isPending} onPress={() => void complete()} style={[styles.submit, { backgroundColor: colors.primary, opacity: saveProfile.isPending ? 0.65 : 1 }]}>
        {saveProfile.isPending ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitText}>Finish profile</Text>}
      </Pressable>
      <Text style={[styles.privacy, { color: colors.mutedForeground }]}>Your photos are stored securely and only used in your profile.</Text>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 56, paddingBottom: 48 },
  header: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 18 },
  icon: { width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  step: { fontSize: 10, fontWeight: "700", letterSpacing: 1.4 },
  title: { fontSize: 30, fontWeight: "700", lineHeight: 36, letterSpacing: -0.8 },
  subtitle: { fontSize: 14, marginTop: 7, marginBottom: 22 },
  label: { fontSize: 13, fontWeight: "700", marginTop: 17, marginBottom: 8 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, fontSize: 14 },
  twoFields: { flexDirection: "row", gap: 10 },
  field: { flex: 1 },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { borderWidth: 1, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 },
  bioInput: { minHeight: 95, textAlignVertical: "top", paddingTop: 12 },
  confirmRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 22 },
  check: { width: 20, height: 20, borderWidth: 1, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  confirmText: { fontSize: 13 },
  error: { fontSize: 13, marginTop: 14 },
  submit: { height: 54, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 20 },
  submitText: { color: "#ffffff", fontWeight: "700", fontSize: 15 },
  privacy: { textAlign: "center", fontSize: 11, marginTop: 14 },
});
