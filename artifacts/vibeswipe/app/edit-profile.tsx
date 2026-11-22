import { getGetMyProfileQueryKey, useGetMyProfile, useSaveMyProfile } from "@workspace/api-client-react";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { MediaPicker } from "@/components/MediaPicker";
import { HobbyMultiSelect, OccupationSelect } from "@/components/ProfileChoiceFields";
import { useColors } from "@/hooks/useColors";

export default function EditProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const profile = useGetMyProfile();
  const saveProfile = useSaveMyProfile();
  const [form, setForm] = useState({
    name: "", age: "", gender: "Woman", lookingFor: "Everyone", bio: "", city: "", country: "", state: "",
    interests: [] as string[], occupation: "Prefer not to say", occupationOther: "",
    photos: [] as string[], videoUrl: null as string | null,
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
      interests: value.interests,
      occupation: value.occupation || "Prefer not to say",
      occupationOther: value.occupationOther || "",
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
      const savedProfile = await saveProfile.mutateAsync({
        data: {
          name: form.name.trim(), age: Number(form.age), gender: form.gender,
          lookingFor: form.lookingFor, bio: form.bio.trim(), city: form.city.trim(),
          country: form.country || null, state: form.state || null,
          interests: form.interests.slice(0, 12),
          occupation: form.occupation,
          occupationOther: form.occupation === "Other" ? form.occupationOther.trim().slice(0, 80) : "",
          photos: form.photos, videoUrl: form.videoUrl,
          preferences: { ageMin: form.ageMin, ageMax: form.ageMax, gender: form.lookingFor, distanceKm: form.distanceKm },
        },
      });
      queryClient.setQueryData(getGetMyProfileQueryKey(), savedProfile);
      void queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
      router.back();
    } catch {
      Alert.alert("Couldn’t save changes", "Please try again.");
    }
  }

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const inputStyle = [styles.input, { color: colors.foreground, borderColor: colors.profileRule, backgroundColor: colors.background }];
  if (profile.isLoading) return <View style={[styles.center, { backgroundColor: colors.messagesBackground }]}><ActivityIndicator color={colors.profileEdit} /></View>;
  return (
    <View style={{ flex: 1, backgroundColor: colors.messagesBackground }}>
      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.container, { paddingTop: topInset + 8, paddingBottom: bottomInset + 120 }]}>
        <View style={styles.headRow}>
          <Pressable testID="edit-profile-back" accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={[styles.round, { backgroundColor: colors.profileCard, shadowColor: colors.profileChipForeground }]}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.heading, { color: colors.foreground }]}>Edit Profile</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={[styles.card, { backgroundColor: colors.profileCard, shadowColor: colors.profileChipForeground }]}>
          <View style={styles.cardHead}>
            <Text style={[styles.section, { color: colors.profileEdit }]}>PHOTOS</Text>
            <Text testID="edit-profile-photo-count" style={[styles.count, { color: colors.profileEdit }]}>{form.photos.length}/6</Text>
          </View>
          <MediaPicker variant="grid" photos={form.photos} videoUrl={form.videoUrl} onChange={(media) => setForm({ ...form, ...media })} />
        </View>
        <View style={[styles.card, { backgroundColor: colors.profileCard, shadowColor: colors.profileChipForeground, marginTop: 14 }]}>
          <Text style={[styles.section, { color: colors.profileEdit }]}>ABOUT YOU</Text>
          {([
            ["Name", "name"],
            ["Age", "age"],
            ["Gender", "gender"],
            ["City", "city"],
          ] as const).map(([label, key]) => (
            <View key={key}>
              <Text style={[styles.label, { color: colors.profileLabel }]}>{label}</Text>
              <TextInput
                testID={`edit-profile-${key}`}
                value={form[key]}
                onChangeText={(value) => setForm({ ...form, [key]: value })}
                keyboardType={key === "age" ? "number-pad" : "default"}
                placeholder={label}
                placeholderTextColor={colors.mutedForeground}
                style={inputStyle}
              />
            </View>
          ))}
          <Text style={[styles.label, { color: colors.profileLabel }]}>About me</Text>
          <TextInput testID="edit-profile-bio" value={form.bio} onChangeText={(bio) => setForm({ ...form, bio })} multiline maxLength={500} style={[inputStyle, styles.bio]} />
          <Text style={[styles.label, { color: colors.profileLabel }]}>Hobbies</Text>
          <HobbyMultiSelect value={form.interests} onChange={(interests) => setForm({ ...form, interests })} testID="edit-profile-hobbies" />
          <Text style={[styles.label, { color: colors.profileLabel }]}>Work / occupation</Text>
          <OccupationSelect
            value={form.occupation}
            otherValue={form.occupationOther}
            onChange={(occupation) => setForm({ ...form, occupation })}
            onOtherChange={(occupationOther) => setForm({ ...form, occupationOther })}
            testID="edit-profile-occupation"
          />
        </View>
      </ScrollView>
      <View pointerEvents="box-none" style={[styles.saveHost, { paddingBottom: bottomInset + 12 }]}>
        <Pressable testID="edit-profile-save" accessibilityRole="button" disabled={saveProfile.isPending} onPress={() => void save()} style={({ pressed }) => [styles.save, { backgroundColor: colors.profileEdit, shadowColor: colors.profileEdit, opacity: saveProfile.isPending ? 0.65 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
          {saveProfile.isPending ? <ActivityIndicator color={colors.profileEditForeground} /> : <Text style={[styles.saveText, { color: colors.profileEditForeground }]}>Save profile</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { width: "100%", maxWidth: 560, alignSelf: "center", paddingHorizontal: 18 },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  heading: { fontSize: 22, fontWeight: "800", letterSpacing: -0.2 },
  card: { borderRadius: 22, padding: 18, shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 },
  section: { fontSize: 12, fontWeight: "800", letterSpacing: 1.4 },
  count: { fontSize: 14, fontWeight: "800" },
  label: { fontSize: 13, fontWeight: "700", marginTop: 16, marginBottom: 8 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, fontSize: 14 },
  bio: { minHeight: 96, textAlignVertical: "top", paddingTop: 12 },
  ageRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  smallInput: { width: 85, height: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, textAlign: "center" },
  saveHost: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 18, alignItems: "center" },
  save: { width: "100%", maxWidth: 524, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  saveText: { fontSize: 16, fontWeight: "800" },
});
