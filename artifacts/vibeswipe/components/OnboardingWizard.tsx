import {
  getGetOnboardingDraftQueryKey,
  useClearOnboardingDraft,
  useGetOnboardingDraft,
  useSaveMyProfile,
  useSaveOnboardingDraft,
  resolveOnboardingCountry,
} from "@workspace/api-client-react";
import { HobbyMultiSelect, OccupationSelect } from "@/components/ProfileChoiceFields";
import { Country } from "country-state-city";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { MediaPicker } from "@/components/MediaPicker";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OnboardingVideoBackground } from "@/components/OnboardingVideoBackground";
import {
  asSetupData,
  buildProfileInput,
  EMPTY_SETUP,
  getOnboardingStepError,
  runProfileCompletionOnce,
  type SetupData,
} from "@/lib/onboardingProfile";

const STEP_COUNT = 10;
const STEPS = [
  "First name",
  "Last name",
  "Age",
  "Gender",
  "Community",
  "Profile picture",
  "Bio",
  "Hobbies",
  "Work / occupation",
  "Finish",
];

const COUNTRIES = Country.getAllCountries().sort((a, b) =>
  a.name.localeCompare(b.name),
);

export function OnboardingWizard() {
  const colors = useColors();
  const { signOut } = useAuth();
  const { ref } = useLocalSearchParams<{ ref?: string | string[] }>();
  const referralFromUrl = (Array.isArray(ref) ? ref[0] : ref ?? "")
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 8);
  const insets = useSafeAreaInsets();
  const viewport = useWindowDimensions();
  const queryClient = useQueryClient();
  const savedDraft = useGetOnboardingDraft();
  const saveDraft = useSaveOnboardingDraft();
  const clearDraft = useClearOnboardingDraft();
  const saveProfile = useSaveMyProfile();
  const [values, setValues] = useState<SetupData>(EMPTY_SETUP);
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState("");
  const [locationStatus, setLocationStatus] = useState<"failed" | "saving" | "done">("done");
  const [locationError, setLocationError] = useState("");
  const [error, setError] = useState("");
  const [switchingToSignIn, setSwitchingToSignIn] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const completionInFlight = useRef(false);
  const signingOut = useRef(false);
  const lastSavedKey = useRef("");
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!savedDraft.isSuccess || hydrated) return;
    const data = asSetupData(savedDraft.data.data);
    if (referralFromUrl && !data.referralCode) data.referralCode = referralFromUrl;
    if (!data.countrySource) {
      data.country = "";
      data.countryCode = "";
      data.state = "";
      data.stateCode = "";
      data.city = "";
    }
    const restoredStep = data.countrySource
      ? Math.max(0, Math.min(STEP_COUNT - 1, savedDraft.data.step - 1))
      : 0;
    setValues(data);
    setStep(restoredStep);
    lastSavedKey.current = `${restoredStep + 1}:${JSON.stringify(data)}`;
    setHydrated(true);
  }, [savedDraft.data, savedDraft.isSuccess, hydrated, referralFromUrl]);

  useEffect(() => {
    setSearch("");
  }, [step]);

  async function chooseCountry(countryCode: string) {
    setLocationStatus("saving");
    setLocationError("");
    try {
      const country = await resolveOnboardingCountry({ countryCode });
      setValues((current) => ({
        ...current,
        country: country.country,
        countryCode: country.countryCode,
        countrySource: country.source,
        state: "",
        stateCode: "",
        city: "",
      }));
      setLocationStatus("done");
    } catch {
      setLocationError("That country could not be saved. Please try again.");
      setLocationStatus("failed");
    }
  }

  useEffect(() => {
    if (!hydrated || saveProfile.isPending) return;
    const key = `${step + 1}:${JSON.stringify(values)}`;
    if (key === lastSavedKey.current) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      saveDraft.mutate(
        {
          data: {
            step: step + 1,
            data: values as unknown as Record<string, unknown>,
          },
        },
        {
          onSuccess: (draft) => {
            lastSavedKey.current = `${draft.step}:${JSON.stringify(values)}`;
            queryClient.setQueryData(getGetOnboardingDraftQueryKey(), draft);
          },
        },
      );
    }, 700);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [hydrated, step, values, saveProfile.isPending]);

  function update<K extends keyof SetupData>(key: K, value: SetupData[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setError("");
  }

  async function logInInstead() {
    if (signingOut.current) return;
    signingOut.current = true;
    setSwitchingToSignIn(true);
    setError("");
    try {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      await signOut();
      queryClient.clear();
      router.replace("/(auth)/sign-in");
    } catch {
      signingOut.current = false;
      setSwitchingToSignIn(false);
      setError("Could not open sign in. Please try again.");
    }
  }

  async function persistDraft(nextScreen: number) {
    const draft = await saveDraft.mutateAsync({
      data: {
        step: nextScreen,
        data: values as unknown as Record<string, unknown>,
      },
    });
    lastSavedKey.current = `${nextScreen}:${JSON.stringify(values)}`;
    queryClient.setQueryData(getGetOnboardingDraftQueryKey(), draft);
  }

  function validateCurrentScreen(): boolean {
    setError("");
    const validationError = getOnboardingStepError(step, values);
    if (!validationError) return true;
    setError(validationError);
    return false;
  }

  async function next() {
    if (!validateCurrentScreen()) return;
    if (step === STEP_COUNT - 1) {
      await complete();
      return;
    }
    try {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      await persistDraft(step + 2);
      setStep((current) => current + 1);
    } catch {
      setError("Your progress could not be saved. Check your connection and try again.");
    }
  }

  function previous() {
    if (step <= 0) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    setStep((current) => current - 1);
    setError("");
  }

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (step > 0) previous();
      else void logInInstead();
      return true;
    });
    return () => subscription.remove();
  }, [step]);

  async function complete() {
    try {
      await runProfileCompletionOnce(completionInFlight, async () => {
        if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
        await saveProfile.mutateAsync({
          data: buildProfileInput(values),
        });
        await clearDraft.mutateAsync();
        await queryClient.invalidateQueries();
        router.replace("/(tabs)");
      });
    } catch {
      setError("Your profile could not be saved. Check your details and try again.");
    }
  }

  const isSaving = saveProfile.isPending || clearDraft.isPending;
  const isDraftSaving = saveDraft.isPending;
  const filteredCountries = COUNTRIES.filter((country) =>
    country.name.toLowerCase().includes(search.trim().toLowerCase()),
  ).slice(0, search.trim() ? 100 : 35);
  const topPadding = Platform.OS === "web" ? Math.max(67, insets.top + 16) : insets.top + 16;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom + 16;

  if (savedDraft.isLoading || !hydrated) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <OnboardingVideoBackground form/>
    <KeyboardAwareScrollViewCompat
      style={[styles.screen, { backgroundColor: "transparent" }]}
      contentContainerStyle={[
        styles.container,
        { minHeight: viewport.height, paddingTop: topPadding, paddingBottom: bottomPadding },
      ]}
      keyboardShouldPersistTaps="handled"
      bottomOffset={70}
    >
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>CREATE YOUR PROFILE</Text>
        <View style={styles.headerActions}>
          <Text style={[styles.stepCount, { color: colors.mutedForeground }]}>STEP {step + 1} OF {STEP_COUNT}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Leave profile setup and log in"
            testID="onboarding-sign-in"
            disabled={switchingToSignIn}
            onPress={() => void logInInstead()}
            style={styles.signInButton}
          >
            <Text style={[styles.signInText, { color: colors.primary }]}>Log in</Text>
          </Pressable>
        </View>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <View style={[styles.progressFill, { width: `${((step + 1) / STEP_COUNT) * 100}%`, backgroundColor: colors.primary }]} />
      </View>
      <Text style={[styles.stepTitle, { color: colors.mutedForeground }]}>{STEPS[step]}</Text>

      {step === 0 ? (
        <StepFrame title="What should we call you?" subtitle="Use the first name you want people to see.">
          <TextInput
            testID="profile-first-name"
            value={values.firstName}
            onChangeText={(value) => update("firstName", value)}
            maxLength={40}
            autoCapitalize="words"
            placeholder="First name"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
          />
          <View style={{ marginTop: 22 }}>
            {values.countrySource ? (
              <View accessibilityRole="text" testID="onboarding-country-confirmed" style={[styles.noDataCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="map-pin" size={18} color={colors.primary} />
                <Text style={[styles.helper, { color: colors.foreground, flex: 1, marginTop: 0 }]}>
                  {values.countrySource === "gps"
                    ? `You're signing up from ${values.country}. Your profile will show ${values.country}.`
                    : `Your profile will show ${values.country}.`}
                </Text>
              </View>
            ) : locationStatus === "saving" ? (
              <View style={[styles.noDataCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <ActivityIndicator color={colors.primary} />
                <Text style={[styles.helper, { color: colors.mutedForeground, marginTop: 0 }]}>Saving your country…</Text>
              </View>
            ) : (
              <>
                {locationError ? (
                  <Text accessibilityRole="alert" style={[styles.helper, { color: colors.destructive, marginBottom: 12 }]}>
                    {locationError}
                  </Text>
                ) : null}
                <SearchInput value={search} onChangeText={setSearch} placeholder="Search all countries" />
                <View style={[styles.locationList, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                    {filteredCountries.map((country) => (
                      <LocationRow
                        key={country.isoCode}
                        label={`${country.flag}  ${country.name}`}
                        selected={false}
                        onPress={() => {
                          setSearch("");
                          void chooseCountry(country.isoCode);
                        }}
                      />
                    ))}
                    {!filteredCountries.length ? <Text style={[styles.noResults, { color: colors.mutedForeground }]}>No matching country.</Text> : null}
                  </ScrollView>
                </View>
              </>
            )}
          </View>
        </StepFrame>
      ) : null}

      {step === 1 ? (
        <StepFrame title="What is your last name?" subtitle="Your last name helps complete your profile.">
          <TextInput
            testID="profile-last-name"
            value={values.lastName}
            onChangeText={(value) => update("lastName", value)}
            maxLength={40}
            autoCapitalize="words"
            placeholder="Last name"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
          />
        </StepFrame>
      ) : null}

      {step === 2 ? (
        <StepFrame title="How old are you?" subtitle="MyAgeBeauty is only for adults aged 18 and over.">
          <TextInput
            testID="profile-age"
            value={values.age}
            onChangeText={(value) => update("age", value.replace(/\D/g, "").slice(0, 3))}
            keyboardType="number-pad"
            placeholder="Age"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, styles.numberInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
          />
          <Text style={[styles.helper, { color: colors.mutedForeground }]}>You must be at least 18 to create an account.</Text>
        </StepFrame>
      ) : null}

      {step === 3 ? (
        <StepFrame title="How do you describe yourself?" subtitle="Choose the gender that feels right for you.">
          <ChoiceGrid values={["Woman", "Man", "Non-binary", "Another identity"]} selected={values.gender} onSelect={(value) => update("gender", value)} />
        </StepFrame>
      ) : null}

      {step === 4 ? (
        <StepFrame title="A space for everyday moments." subtitle="MyAgeBeauty is for adults 18+ to share photos, Reels, Stories, and conversations.">
          {[
            ["users", "Follow people whose everyday you enjoy. Their posts fill your Home feed."],
            ["lock", "Switch to a private account any time in Settings so only approved followers see your posts."],
            ["shield", "Be kind. Report or block anyone who makes you uncomfortable."],
          ].map(([icon, copy]) => (
            <View key={icon} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
              <Feather name={icon as "users"} size={20} color={colors.primary} />
              <Text style={{ flex: 1, color: colors.foreground, fontSize: 15, lineHeight: 21 }}>{copy}</Text>
            </View>
          ))}
          <Pressable accessibilityRole="link" onPress={() => router.push("/community-guidelines" as never)}>
            <Text style={{ color: colors.primary, fontWeight: "700" }}>Read the community guidelines</Text>
          </Pressable>
        </StepFrame>
      ) : null}

      {step === 5 ? (
        <StepFrame title="Choose your profile picture." subtitle="Use a clear photo so people can recognize you.">
          <MediaPicker
            photos={values.photos}
            videoUrl={null}
            maxPhotos={1}
            showVideo={false}
            onChange={(media) => update("photos", media.photos)}
          />
        </StepFrame>
      ) : null}

      {step === 6 ? (
        <StepFrame title="What would you like people to know?" subtitle="A short bio helps start better conversations.">
          <TextInput
            testID="profile-bio"
            value={values.bio}
            onChangeText={(value) => update("bio", value)}
            multiline
            maxLength={500}
            placeholder="Write a little about yourself…"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, styles.bioInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
          />
          <Text style={[styles.counter, { color: colors.mutedForeground }]}>{values.bio.length}/500</Text>
        </StepFrame>
      ) : null}

      {step === 7 ? (
        <StepFrame title="Choose your hobbies." subtitle="Tap as many as you like. You can choose up to 12.">
          <HobbyMultiSelect
            value={values.interests}
            onChange={(interests) => update("interests", interests)}
          />
        </StepFrame>
      ) : null}

      {step === 8 ? (
        <StepFrame title="What do you do for work?" subtitle="Choose one. The extra detail for “Other” is optional.">
          <OccupationSelect
            value={values.occupation}
            otherValue={values.occupationOther}
            onChange={(occupation) => update("occupation", occupation)}
            onOtherChange={(occupationOther) => update("occupationOther", occupationOther)}
          />
        </StepFrame>
      ) : null}

      {step === 9 ? (
        <StepFrame title="Almost there." subtitle="Add a friend's referral code if you have one, then finish setup.">
          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Referral code (optional)</Text>
          <TextInput
            testID="onboarding-referral-code"
            value={values.referralCode}
            onChangeText={(value) => update("referralCode", value.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 8))}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
            placeholder="8 characters"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
          />
          <Text style={[styles.helper, { color: colors.mutedForeground }]}>Your friend earns 100 points when you join.</Text>
        </StepFrame>
      ) : null}

      {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
      <View style={styles.navigation}>
        {step > 0 ? (
          <Pressable
            testID="profile-step-back"
            disabled={isSaving}
            onPress={() => void previous()}
            style={[styles.backButton, { borderColor: colors.border }]}
          >
            <Feather name="arrow-left" size={17} color={colors.foreground} />
            <Text style={[styles.backText, { color: colors.foreground }]}>Back</Text>
          </Pressable>
        ) : <View style={styles.backPlaceholder} />}
        <Pressable
          testID={step === STEP_COUNT - 1 ? "complete-onboarding" : "profile-step-continue"}
          disabled={isSaving || isDraftSaving}
          onPress={() => void next()}
          style={[styles.nextButton, { backgroundColor: colors.primary, opacity: isSaving ? 0.65 : 1 }]}
        >
          {isSaving ? <ActivityIndicator color="#ffffff" /> : (
            <>
              <Text style={styles.nextText}>{step === STEP_COUNT - 1 ? "Finish setup" : "Next"}</Text>
              <Feather name={step === STEP_COUNT - 1 ? "check" : "arrow-right"} size={17} color="#ffffff" />
            </>
          )}
        </Pressable>
      </View>
    </KeyboardAwareScrollViewCompat>
    </View>
  );
}

function StepFrame({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.stepFrame}>
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
      {children}
    </View>
  );
}

function SearchInput({ value, onChangeText, placeholder }: { value: string; onChangeText: (value: string) => void; placeholder: string }) {
  const colors = useColors();
  return (
    <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Feather name="search" size={17} color={colors.mutedForeground} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        autoCorrect={false}
        style={[styles.searchInput, { color: colors.foreground }]}
      />
      {value ? <Pressable accessibilityLabel="Clear search" onPress={() => onChangeText("")}><Feather name="x" size={17} color={colors.mutedForeground} /></Pressable> : null}
    </View>
  );
}

function LocationRow({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.locationRow, { borderBottomColor: colors.border }]}
    >
      <Text numberOfLines={1} style={[styles.locationText, { color: selected ? colors.primary : colors.foreground, fontWeight: selected ? "700" : "500" }]}>{label}</Text>
      {selected ? <Feather name="check" size={17} color={colors.primary} /> : null}
    </Pressable>
  );
}

function ChoiceGrid({ values, selected, onSelect }: { values: string[]; selected: string; onSelect: (value: string) => void }) {
  const colors = useColors();
  return (
    <View style={styles.choiceGrid}>
      {values.map((value) => {
        const active = selected === value;
        return (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(value)}
            style={[styles.choice, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.accent : colors.card }]}
          >
            <Text style={[styles.choiceText, { color: active ? colors.primary : colors.foreground }]}>{value}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  screen: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: 22 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  signInButton: { minHeight: 40, justifyContent: "center", paddingHorizontal: 8 },
  signInText: { fontSize: 13, fontWeight: "800" },
  eyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  stepCount: { fontSize: 10, fontWeight: "700", letterSpacing: 0.7 },
  progressTrack: { height: 4, borderRadius: 3, overflow: "hidden", marginTop: 13 },
  progressFill: { height: "100%", borderRadius: 3 },
  stepTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3, marginTop: 11 },
  stepFrame: { paddingTop: 12, flex: 1, justifyContent: "center" },
  title: { fontSize: 27, lineHeight: 34, fontWeight: "800", letterSpacing: -0.6 },
  subtitle: { fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 27 },
  input: { minHeight: 54, borderWidth: 1, borderRadius: 15, paddingHorizontal: 15, fontSize: 16 },
  numberInput: { width: 150, textAlign: "center", fontSize: 22, fontWeight: "700" },
  bioInput: { minHeight: 150, textAlignVertical: "top", paddingTop: 14, fontSize: 14 },
  counter: { textAlign: "right", fontSize: 11, marginTop: 6 },
  helper: { fontSize: 12, lineHeight: 18, marginTop: 12 },
  fieldLabel: { fontSize: 13, fontWeight: "700", marginBottom: 10 },
  choiceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  choice: { minHeight: 48, borderWidth: 1, borderRadius: 15, paddingHorizontal: 15, justifyContent: "center" },
  choiceText: { fontSize: 14, fontWeight: "600" },
  searchWrap: { minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 10 },
  searchInput: { flex: 1, height: 46, fontSize: 14 },
  locationList: { maxHeight: 360, borderWidth: 1, borderRadius: 15, overflow: "hidden" },
  locationRow: { minHeight: 48, paddingHorizontal: 13, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 8 },
  locationText: { flex: 1, fontSize: 14 },
  noResults: { fontSize: 13, lineHeight: 19, padding: 16 },
  noDataCard: { minHeight: 90, borderWidth: 1, borderRadius: 15, padding: 15, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  ageRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  rangeInput: { width: 90, textAlign: "center" },
  error: { fontSize: 13, lineHeight: 19, marginTop: 14 },
  navigation: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 28 },
  backPlaceholder: { flex: 1 },
  backButton: { height: 54, minWidth: 100, borderWidth: 1, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  backText: { fontSize: 14, fontWeight: "700" },
  nextButton: { flex: 1, height: 54, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  nextText: { color: "#ffffff", fontWeight: "800", fontSize: 15 },
});
