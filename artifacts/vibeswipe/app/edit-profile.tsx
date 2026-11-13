import { useGetMyProfile, useSaveMyProfile } from "@workspace/api-client-react";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { MediaPicker } from "@/components/MediaPicker";
import { useColors } from "@/hooks/useColors";

export default function EditProfileScreen() {
  const colors = useColors();
  const profile = useGetMyProfile();
  const saveProfile = useSaveMyProfile();
  const [form, setForm] = useState({
    name: "", age: "", gender: "Woman", lookingFor: "Everyone", bio: "", city: "", country: "", state: "",
    interests: "", photos: [] as string[], videoUrl: null as string | null,
    ageMin: 22, ageMax: 35, distanceKm: 50,
  });

  useEffect(() => {
    const value = profile.data;
    if (!value) return;
    setForm({
      name: value.name,
      age: String(value.age),
      gender: value.gender,
      lookingFor: value.lookingFor,
      bio: value.bio,
      city: value.city,
      country: value.country ?? "",
      state: value.state ?? "",
      interests: value.interests.join(", "),
      photos: value.photos,
      videoUrl: value.videoUrl ?? null,
      ageMin: value.preferences.ageMin,
      ageMax: value.preferences.ageMax,
      distanceKm: value.preferences.distanceKm,
    });
  }, [profile.data]);

  async function save() {
    if (!form.name.trim() || Number(form.age) < 18 || !form.photos.length) {
      Alert.alert("Check your profile", "Age must be 18 or older, and at least one photo is required.");
      return;
    }
    try {
      await saveProfile.mutateAsync({
        data: {
          name: form.name.trim(), age: Number(form.age), gender: form.gender,
          lookingFor: form.lookingFor, bio: form.bio.trim(), city: form.city.trim(),
          country: form.country || null, state: form.state || null,
          interests: form.interests.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 12),
          photos: form.photos, videoUrl: form.videoUrl,
          preferences: { ageMin: form.ageMin, ageMax: form.ageMax, gender: form.lookingFor, distanceKm: form.distanceKm },
        },
      });
      router.back();
    } catch {
      Alert.alert("Couldn’t save changes", "Please try again.");
    }
  }

  if (profile.isLoading) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.heading, { color: colors.foreground }]}>Edit profile</Text>
      <Text style={[styles.label, { color: colors.foreground }]}>Photos and video</Text>
      <MediaPicker photos={form.photos} videoUrl={form.videoUrl} onChange={(media) => setForm({ ...form, ...media })} />
      {([
        ["Name", "name"],
        ["Age", "age"],
        ["Gender", "gender"],
        ["Looking for", "lookingFor"],
        ["City", "city"],
        ["Interests, separated by commas", "interests"],
      ] as const).map(([label, key]) => (
        <View key={key}>
          <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
          <TextInput
            value={form[key]}
            onChangeText={(value) => setForm({ ...form, [key]: value })}
            keyboardType={key === "age" ? "number-pad" : "default"}
            placeholder={label}
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
          />
        </View>
      ))}
      <Text style={[styles.label, { color: colors.foreground }]}>About you</Text>
      <TextInput value={form.bio} onChangeText={(bio) => setForm({ ...form, bio })} multiline maxLength={500} style={[styles.input, styles.bio, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} />
      <Text style={[styles.label, { color: colors.foreground }]}>Discovery age range</Text>
      <View style={styles.ageRow}>
        <TextInput value={String(form.ageMin)} onChangeText={(value) => setForm({ ...form, ageMin: Number(value) || 18 })} keyboardType="number-pad" style={[styles.smallInput, { color: colors.foreground, borderColor: colors.border }]} />
        <Text style={{ color: colors.mutedForeground }}>to</Text>
        <TextInput value={String(form.ageMax)} onChangeText={(value) => setForm({ ...form, ageMax: Number(value) || 35 })} keyboardType="number-pad" style={[styles.smallInput, { color: colors.foreground, borderColor: colors.border }]} />
      </View>
      <Pressable disabled={saveProfile.isPending} onPress={() => void save()} style={[styles.save, { backgroundColor: colors.primary, opacity: saveProfile.isPending ? 0.65 : 1 }]}>
        {saveProfile.isPending ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveText}>Save changes</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { padding: 22, paddingTop: 58, paddingBottom: 40 },
  heading: { fontSize: 27, fontWeight: "700", marginBottom: 12 },
  label: { fontSize: 13, fontWeight: "700", marginTop: 17, marginBottom: 8 },
  input: { minHeight: 49, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, fontSize: 14 },
  bio: { minHeight: 96, textAlignVertical: "top", paddingTop: 12 },
  ageRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  smallInput: { width: 85, height: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, textAlign: "center" },
  save: { height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 26 },
  saveText: { color: "#ffffff", fontWeight: "700" },
});
