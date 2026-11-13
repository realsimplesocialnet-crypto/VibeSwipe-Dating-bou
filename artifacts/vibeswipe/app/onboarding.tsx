import { useSaveMyProfile } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
  const saveProfile = useSaveMyProfile();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("Woman");
  const [lookingFor, setLookingFor] = useState("Everyone");
  const [photos, setPhotos] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [interestsText, setInterestsText] = useState("");
  const [ageMin, setAgeMin] = useState("22");
  const [ageMax, setAgeMax] = useState("35");
  const [distanceKm, setDistanceKm] = useState(50);
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [error, setError] = useState("");

  const steps = ["Basics", "Media", "About you", "Preferences"];

  function validateStep() {
    setError("");
    if (step === 0) {
      const parsedAge = Number(age);
      if (!name.trim()) {
        setError("Enter your full name to continue.");
        return false;
      }
      if (!Number.isInteger(parsedAge) || parsedAge < 18 || parsedAge > 120) {
        setError("Enter an age from 18 to 120.");
        return false;
      }
      if (!adultConfirmed) {
        setError("Confirm that you are at least 18 years old.");
        return false;
      }
    }
    if (step === 1 && photos.length === 0) {
      setError("Add at least one profile photo to continue.");
      return false;
    }
    if (step === 3) {
      const min = Number(ageMin);
      const max = Number(ageMax);
      if (!Number.isInteger(min) || min < 18 || min > 120) {
        setError("Set the minimum age between 18 and 120.");
        return false;
      }
      if (!Number.isInteger(max) || max < min || max > 120) {
        setError("The maximum age must be at least the minimum age and no more than 120.");
        return false;
      }
      if (!Number.isInteger(distanceKm) || distanceKm < 1 || distanceKm > 500) {
        setError("Choose a distance from 1 to 500 km.");
        return false;
      }
    }
    return true;
  }

  function nextStep() {
    if (!validateStep()) return;
    if (step < steps.length - 1) setStep((current) => current + 1);
    else void complete();
  }

  function previousStep() {
    setError("");
    setStep((current) => Math.max(0, current - 1));
  }

  async function complete() {
    if (!validateStep()) return;
    try {
      await saveProfile.mutateAsync({
        data: {
          name: name.trim(),
          age: Number(age),
          gender,
          lookingFor,
          bio: bio.trim(),
          city: city.trim(),
          interests: interestsText
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
            .slice(0, 12),
          photos,
          videoUrl: null,
          preferences: {
            ageMin: Number(ageMin),
            ageMax: Number(ageMax),
            gender: lookingFor,
            distanceKm,
          },
        },
      });
      await queryClient.invalidateQueries();
      router.replace("/(tabs)");
    } catch {
      setError("Your profile could not be saved. Check your details and try again.");
    }
  }

  return (
    <KeyboardAwareScrollViewCompat style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.container} bottomOffset={30}>
      <View style={styles.progressHeader}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>CREATE YOUR PROFILE</Text>
        <Text style={[styles.stepCount, { color: colors.mutedForeground }]}>
          STEP {step + 1} OF {steps.length}
        </Text>
      </View>
      <View style={styles.progressTrack} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: 4, now: step + 1 }}>
        {steps.map((label, index) => (
          <View key={label} style={styles.progressItem}>
            <View style={styles.progressLineWrap}>
              <View
                style={[
                  styles.progressDot,
                  {
                    borderColor: index <= step ? colors.primary : colors.border,
                    backgroundColor: index <= step ? colors.primary : colors.card,
                  },
                ]}
              >
                {index < step ? (
                  <Feather name="check" size={12} color="#ffffff" />
                ) : (
                  <Text style={[styles.progressNumber, { color: index === step ? "#ffffff" : colors.mutedForeground }]}>
                    {index + 1}
                  </Text>
                )}
              </View>
              {index < steps.length - 1 ? (
                <View
                  style={[
                    styles.progressLine,
                    { backgroundColor: index < step ? colors.primary : colors.border },
                  ]}
                />
              ) : null}
            </View>
            <Text style={[styles.progressLabel, { color: index === step ? colors.foreground : colors.mutedForeground }]}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      {step === 0 ? (
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Start with the basics.</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Tell people who you are and who you want to meet.</Text>
          <Text style={[styles.label, { color: colors.foreground }]}>Full name</Text>
          <TextInput
            testID="profile-name"
            value={name}
            onChangeText={setName}
            maxLength={60}
            autoCapitalize="words"
            placeholder="Your full name"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
          />
          <Text style={[styles.label, { color: colors.foreground }]}>Age</Text>
          <TextInput
            testID="profile-age"
            value={age}
            onChangeText={(value) => setAge(value.replace(/\D/g, "").slice(0, 3))}
            keyboardType="number-pad"
            placeholder="18 or older"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
          />
          <Text style={[styles.label, { color: colors.foreground }]}>Gender</Text>
          <View style={styles.choiceRow}>
            {["Woman", "Man", "Non-binary"].map((value) => (
              <Choice key={value} label={value} selected={gender === value} onPress={() => setGender(value)} />
            ))}
          </View>
          <Text style={[styles.label, { color: colors.foreground }]}>Looking for</Text>
          <View style={styles.choiceRow}>
            {["Everyone", "Woman", "Man"].map((value) => (
              <Choice key={value} label={value} selected={lookingFor === value} onPress={() => setLookingFor(value)} />
            ))}
          </View>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: adultConfirmed }}
            onPress={() => setAdultConfirmed((current) => !current)}
            style={styles.confirmRow}
          >
            <View style={[styles.check, { borderColor: adultConfirmed ? colors.primary : colors.border, backgroundColor: adultConfirmed ? colors.primary : "transparent" }]}>
              {adultConfirmed ? <Feather name="check" size={14} color="#ffffff" /> : null}
            </View>
            <Text style={[styles.confirmText, { color: colors.mutedForeground }]}>I confirm that I am at least 18 years old.</Text>
          </Pressable>
        </View>
      ) : null}

      {step === 1 ? (
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Add your profile picture.</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>This picture appears on your profile and Discover cards.</Text>
          <Text style={[styles.label, { color: colors.foreground }]}>Profile picture</Text>
          <MediaPicker
            photos={photos}
            videoUrl={null}
            maxPhotos={1}
            showVideo={false}
            onChange={(value) => {
              setPhotos(value.photos);
              setError("");
            }}
          />
        </View>
      ) : null}

      {step === 2 ? (
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Share a little more.</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>These details help people find something in common.</Text>
          <Text style={[styles.label, { color: colors.foreground }]}>Bio</Text>
          <TextInput
            testID="profile-bio"
            value={bio}
            onChangeText={setBio}
            multiline
            maxLength={500}
            placeholder="A little about what you enjoy…"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, styles.bioInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
          />
          <Text style={[styles.counter, { color: colors.mutedForeground }]}>{bio.length}/500</Text>
          <Text style={[styles.label, { color: colors.foreground }]}>City</Text>
          <TextInput
            testID="profile-city"
            value={city}
            onChangeText={setCity}
            maxLength={100}
            autoCapitalize="words"
            placeholder="Your city"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
          />
          <Text style={[styles.label, { color: colors.foreground }]}>Interests</Text>
          <TextInput
            testID="profile-interests"
            value={interestsText}
            onChangeText={setInterestsText}
            placeholder="Music, food, travel"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
          />
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>Separate interests with commas. Add up to 12.</Text>
        </View>
      ) : null}

      {step === 3 ? (
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Set your preferences.</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Choose an age range and how far away to discover people.</Text>
          <Text style={[styles.label, { color: colors.foreground }]}>Age range</Text>
          <View style={styles.ageRow}>
            <View style={styles.ageField}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Minimum</Text>
              <TextInput
                testID="preference-age-min"
                value={ageMin}
                onChangeText={(value) => setAgeMin(value.replace(/\D/g, "").slice(0, 3))}
                keyboardType="number-pad"
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              />
            </View>
            <Text style={[styles.toText, { color: colors.mutedForeground }]}>to</Text>
            <View style={styles.ageField}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Maximum</Text>
              <TextInput
                testID="preference-age-max"
                value={ageMax}
                onChangeText={(value) => setAgeMax(value.replace(/\D/g, "").slice(0, 3))}
                keyboardType="number-pad"
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              />
            </View>
          </View>
          <Text style={[styles.label, { color: colors.foreground }]}>Distance</Text>
          <View style={styles.choiceRow}>
            {[10, 25, 50, 100, 250, 500].map((distance) => (
              <Choice
                key={distance}
                label={`${distance} km`}
                selected={distanceKm === distance}
                onPress={() => setDistanceKm(distance)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
      <View style={styles.navigation}>
        {step > 0 ? (
          <Pressable
            testID="profile-step-back"
            disabled={saveProfile.isPending}
            onPress={previousStep}
            style={[styles.backButton, { borderColor: colors.border }]}
          >
            <Feather name="arrow-left" size={17} color={colors.foreground} />
            <Text style={[styles.backText, { color: colors.foreground }]}>Back</Text>
          </Pressable>
        ) : <View style={styles.backPlaceholder} />}
        <Pressable
          testID={step === 3 ? "complete-onboarding" : "profile-step-continue"}
          disabled={saveProfile.isPending}
          onPress={nextStep}
          style={[styles.submit, { backgroundColor: colors.primary, opacity: saveProfile.isPending ? 0.65 : 1 }]}
        >
          {saveProfile.isPending ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Text style={styles.submitText}>{step === 3 ? "Finish setup" : "Continue"}</Text>
              <Feather name={step === 3 ? "check" : "arrow-right"} size={17} color="#ffffff" />
            </>
          )}
        </Pressable>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.choice,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.accent : colors.card,
        },
      ]}
    >
      <Text style={{ color: selected ? colors.primary : colors.foreground, fontWeight: "600" }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, paddingTop: 44, paddingBottom: 40 },
  progressHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 17 },
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 1.8 },
  stepCount: { fontSize: 10, fontWeight: "700", letterSpacing: 1.1 },
  progressTrack: { flexDirection: "row", marginBottom: 34 },
  progressItem: { flex: 1, alignItems: "center" },
  progressLineWrap: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center" },
  progressDot: { width: 28, height: 28, borderWidth: 1.5, borderRadius: 14, alignItems: "center", justifyContent: "center", zIndex: 1 },
  progressNumber: { fontSize: 11, fontWeight: "700" },
  progressLine: { position: "absolute", left: "50%", right: "-50%", height: 2 },
  progressLabel: { fontSize: 9, fontWeight: "600", marginTop: 7 },
  title: { fontSize: 28, fontWeight: "700", lineHeight: 34, letterSpacing: -0.7 },
  subtitle: { fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 17 },
  label: { fontSize: 13, fontWeight: "700", marginTop: 18, marginBottom: 8 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, fontSize: 14 },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { borderWidth: 1, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 },
  bioInput: { minHeight: 95, textAlignVertical: "top", paddingTop: 12 },
  confirmRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 22 },
  check: { width: 20, height: 20, borderWidth: 1, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  confirmText: { fontSize: 13 },
  error: { fontSize: 13, marginTop: 14 },
  counter: { textAlign: "right", fontSize: 10, marginTop: 5 },
  hint: { fontSize: 11, marginTop: 7 },
  ageRow: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
  ageField: { flex: 1 },
  fieldLabel: { fontSize: 11, marginBottom: 6 },
  toText: { paddingBottom: 16, fontSize: 13 },
  navigation: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 30 },
  backPlaceholder: { flex: 1 },
  backButton: { height: 52, minWidth: 95, borderWidth: 1, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  backText: { fontSize: 14, fontWeight: "700" },
  submit: { flex: 1, height: 52, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  submitText: { color: "#ffffff", fontWeight: "700", fontSize: 15 },
});
