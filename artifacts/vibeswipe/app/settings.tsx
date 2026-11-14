import { useAuth } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  getGetDiscoverProfilesQueryKey,
  getGetVibeSwipeSettingsQueryKey,
  useGetVibeSwipeSettings,
  getSearchTravelCitiesQueryKey,
  useSearchTravelCities,
  useUpdateVibeSwipeSettings,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/hooks/useTheme";
import { PushNotificationSettings } from "@/components/PushNotificationSettings";
import { DiscoveryLocationSettings } from "@/components/DiscoveryLocationSettings";

export default function SettingsScreen() {
  const colors = useColors();
  const { signOut } = useAuth();
  const { scheme, setScheme } = useTheme();
  const queryClient = useQueryClient();
  const settings = useGetVibeSwipeSettings();
  const updateSettings = useUpdateVibeSwipeSettings();
  const [incognito, setIncognito] = useState(false);
  const [travelMode, setTravelMode] = useState(false);
  const [travelCity, setTravelCity] = useState("");
  const [selectedTravelCity, setSelectedTravelCity] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [debouncedCitySearch, setDebouncedCitySearch] = useState("");
  const [travelMessage, setTravelMessage] = useState("");
  const [travelError, setTravelError] = useState("");
  const dark = scheme === "dark";
  const citySuggestions = useSearchTravelCities({ search: debouncedCitySearch }, {
    query: {
      queryKey: getSearchTravelCitiesQueryKey({ search: debouncedCitySearch }),
      enabled: travelMode && debouncedCitySearch.length >= 2,
      retry: false,
    },
  });

  useEffect(() => {
    if (!settings.data) return;
    setIncognito(settings.data.incognito);
    setTravelMode(settings.data.travelMode);
    setTravelCity(settings.data.travelCity ?? "");
    setCitySearch(settings.data.travelCity ?? "");
    setSelectedTravelCity(settings.data.travelCity ?? "");
  }, [settings.data]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedCitySearch(citySearch.trim()), 250);
    return () => clearTimeout(timer);
  }, [citySearch]);

  async function saveTheme(darkMode: boolean) {
    const previousScheme = scheme;
    const previousSettings = settings.data;
    if (previousSettings) {
      queryClient.setQueryData(getGetVibeSwipeSettingsQueryKey(), { ...previousSettings, darkMode });
    }
    void setScheme(darkMode ? "dark" : "light");
    try {
      const saved = await updateSettings.mutateAsync({ data: { darkMode } });
      queryClient.setQueryData(getGetVibeSwipeSettingsQueryKey(), saved);
    } catch {
      if (previousSettings) queryClient.setQueryData(getGetVibeSwipeSettingsQueryKey(), previousSettings);
      void setScheme(previousScheme);
      Alert.alert("Could not save theme", "Please check your connection and try again.");
    }
  }

  async function savePrivacySettings(next: {
    incognito: boolean;
    travelMode: boolean;
    travelCity: string | null;
  }): Promise<boolean> {
    try {
      const saved = await updateSettings.mutateAsync({
        data: {
          incognito: next.incognito,
          travelMode: next.travelMode,
          travelCity: next.travelCity,
        },
      });
      queryClient.setQueryData(getGetVibeSwipeSettingsQueryKey(), saved);
      await queryClient.invalidateQueries({ queryKey: getGetDiscoverProfilesQueryKey() });
      return true;
    } catch {
      setTravelError("Travel Mode could not be saved. Check your connection and try again.");
      Alert.alert("Could not save settings", "Please try again.");
      return false;
    }
  }

  function selectCity(value: string) {
    setSelectedTravelCity(value);
    setCitySearch(value);
    setTravelError("");
    setTravelMessage("");
  }

  async function saveTravelCity() {
    if (!selectedTravelCity) {
      setTravelError("Choose a real city from the search results before saving.");
      return;
    }
    const saved = await savePrivacySettings({ incognito, travelMode: true, travelCity: selectedTravelCity });
    if (saved) {
      setTravelMode(true);
      setTravelCity(selectedTravelCity);
      setTravelMessage(`Now showing people in ${selectedTravelCity}.`);
      setTravelError("");
    }
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled" style={{ backgroundColor: colors.background }} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>
      </View>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: colors.accent }]}><Feather name="moon" size={17} color={colors.primary} /></View>
          <View style={styles.copy}>
            <Text style={[styles.rowTitle, { color: colors.foreground }]}>Dark appearance</Text>
            <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>Choose a comfortable theme.</Text>
          </View>
          <Switch value={dark} disabled={updateSettings.isPending || !settings.data} onValueChange={(value) => void saveTheme(value)} trackColor={{ true: colors.primary }} />
        </View>
      </View>
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>DISCOVERY</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.row, styles.settingRow]}>
          <View style={[styles.icon, { backgroundColor: colors.accent }]}><Feather name="eye-off" size={17} color={colors.primary} /></View>
          <View style={styles.copy}>
            <Text style={[styles.rowTitle, { color: colors.foreground }]}>Incognito Mode</Text>
            <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>Only people you like can see you.</Text>
          </View>
          <Switch
            value={incognito}
            disabled={updateSettings.isPending || settings.isLoading}
            onValueChange={(value) => {
              setTravelError("");
              setIncognito(value);
              void savePrivacySettings({ incognito: value, travelMode, travelCity: travelMode ? travelCity || null : null });
            }}
            trackColor={{ true: colors.primary }}
          />
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={[styles.row, styles.settingRow]}>
          <View style={[styles.icon, { backgroundColor: colors.accent }]}><Feather name="map-pin" size={17} color={colors.primary} /></View>
          <View style={styles.copy}>
            <Text style={[styles.rowTitle, { color: colors.foreground }]}>Travel Mode</Text>
            <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
              {travelMode && travelCity ? `Discover people in ${travelCity}.` : "Choose a city to explore people there."}
            </Text>
          </View>
          <Switch
            value={travelMode}
            disabled={updateSettings.isPending || settings.isLoading}
            onValueChange={async (value) => {
              setTravelMessage("");
              setTravelError("");
              const nextCity = value ? travelCity || null : null;
              const saved = await savePrivacySettings({ incognito, travelMode: value, travelCity: nextCity });
              if (saved) {
                setTravelMode(value);
                if (value) {
                  setTravelMessage(nextCity ? `Now showing people in ${nextCity}.` : "Travel Mode is on. Choose a real city, then save it.");
                } else {
                  setTravelCity("");
                  setSelectedTravelCity("");
                  setCitySearch("");
                  setTravelMessage("Travel Mode is off. Discovery is back to your registered city.");
                }
              } else {
                setTravelMode(!value);
              }
            }}
            trackColor={{ true: colors.primary }}
            testID="toggle-travel-mode"
          />
        </View>
        {travelMode ? (
          <>
            <TextInput
              value={citySearch}
              onChangeText={(value) => { setCitySearch(value); setSelectedTravelCity(""); setTravelError(""); setTravelMessage(""); }}
              placeholder="Search real cities"
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="search"
              style={[styles.cityInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              testID="input-travel-city"
            />
            {selectedTravelCity ? <Text style={[styles.selectedCity, { color: colors.primary }]}>Selected city: {selectedTravelCity}</Text> : null}
            {debouncedCitySearch.length >= 2 && citySuggestions.isFetching ? <Text style={[styles.cityStatus, { color: colors.mutedForeground }]}>Searching real cities…</Text> : null}
            {citySuggestions.isError ? <Text style={[styles.cityStatus, { color: colors.destructive }]}>City search is unavailable. Try again.</Text> : null}
            {citySuggestions.data?.map((city) => (
              <Pressable key={city.name} onPress={() => selectCity(city.name)} style={[styles.suggestion, { borderColor: colors.border }]}>
                <Feather name="map-pin" size={15} color={selectedTravelCity === city.name ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.suggestionText, { color: colors.foreground }]}>{city.name}</Text>
                {selectedTravelCity === city.name ? <Feather name="check" size={16} color={colors.primary} /> : null}
              </Pressable>
            ))}
            {debouncedCitySearch.length >= 2 && !citySuggestions.isFetching && !citySuggestions.isError && !citySuggestions.data?.length ? <Text style={[styles.cityStatus, { color: colors.mutedForeground }]}>No real city matches that search.</Text> : null}
            <Pressable
              accessibilityRole="button"
              testID="button-save-travel-city"
              disabled={!selectedTravelCity || updateSettings.isPending}
              onPress={() => void saveTravelCity()}
              style={[styles.saveCityButton, { backgroundColor: colors.secondary, opacity: selectedTravelCity && !updateSettings.isPending ? 1 : 0.5 }]}
            >
              <Text style={[styles.saveCityText, { color: colors.foreground }]}>{updateSettings.isPending ? "Saving city…" : "Save city"}</Text>
            </Pressable>
          </>
        ) : null}
        {travelMessage ? <Text accessibilityRole="status" style={[styles.cityStatus, { color: colors.primary }]}>{travelMessage}</Text> : null}
        {travelError ? <Text accessibilityRole="alert" style={[styles.cityStatus, { color: colors.destructive }]}>{travelError}</Text> : null}
      </View>
      <DiscoveryLocationSettings />
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SAFETY</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/safety-center")}
        style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}
        testID="button-open-safety-center"
      >
        <View style={styles.row}>
          <Feather name="shield" size={19} color={colors.primary} />
          <View style={styles.copy}>
            <Text style={[styles.rowTitle, { color: colors.foreground }]}>Safety Center</Text>
            <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>Safety tips, trusted contacts, and location sharing.</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </View>
      </Pressable>
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>NOTIFICATIONS</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/notification-settings")}
        style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}
        testID="button-open-notification-settings"
      >
        <View style={styles.row}>
          <Feather name="bell" size={19} color={colors.primary} />
          <View style={styles.copy}>
            <Text style={[styles.rowTitle, { color: colors.foreground }]}>Notification settings</Text>
            <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>New matches, likes, messages, and views.</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </View>
      </Pressable>
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>MESSAGES</Text>
      <PushNotificationSettings />
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>LEGAL AND SAFETY</Text>
      <Pressable
        onPress={() => router.push("/privacy-policy")}
        style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}
        testID="button-open-privacy-policy"
      >
        <View style={styles.row}>
          <Feather name="lock" size={19} color={colors.primary} />
          <View style={styles.copy}>
            <Text style={[styles.rowTitle, { color: colors.foreground }]}>Privacy Policy</Text>
            <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>How Myage uses and protects your information.</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </View>
      </Pressable>
      <Pressable
        onPress={() => router.push("/terms")}
        style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}
        testID="button-open-terms"
      >
        <View style={styles.row}>
          <Feather name="book-open" size={19} color={colors.primary} />
          <View style={styles.copy}>
            <Text style={[styles.rowTitle, { color: colors.foreground }]}>Terms of Service</Text>
            <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>The rules for using Myage.</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </View>
      </Pressable>
      <Pressable
        onPress={() => router.push("/report-safety")}
        style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}
        testID="button-open-report-safety"
      >
        <View style={styles.row}>
          <Feather name="shield" size={19} color={colors.primary} />
          <View style={styles.copy}>
            <Text style={[styles.rowTitle, { color: colors.foreground }]}>Report a scam or safety issue</Text>
            <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>Send a private report for review.</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </View>
      </Pressable>
      <Pressable onPress={() => void signOut().then(() => router.replace("/"))} style={[styles.signOut, { borderColor: colors.border }]}>
        <Feather name="log-out" size={17} color={colors.destructive} />
        <Text style={[styles.signOutText, { color: colors.destructive }]}>Sign out</Text>
      </Pressable>
      <Text style={[styles.version, { color: colors.mutedForeground }]}>Myage · 18+</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, padding: 20, paddingTop: 58, paddingBottom: 60 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 26 },
  back: { width: 36, height: 40, justifyContent: "center" },
  title: { fontSize: 25, fontWeight: "700" },
  section: { borderWidth: 1, borderRadius: 18, padding: 15, marginBottom: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 11 },
  icon: { width: 36, height: 36, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 14, fontWeight: "700" },
  rowSub: { fontSize: 12, lineHeight: 17 },
  settingRow: { minHeight: 54 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 13 },
  cityInput: { borderWidth: 1, borderRadius: 12, height: 46, paddingHorizontal: 12, marginTop: 16, marginBottom: 8, fontSize: 14 },
  suggestion: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  suggestionText: { flex: 1, fontSize: 13, fontWeight: "500" },
  selectedCity: { fontSize: 12, fontWeight: "600", marginBottom: 6 },
  cityStatus: { fontSize: 12, lineHeight: 18, marginTop: 7 },
  saveCityButton: { minHeight: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 13 },
  saveCityText: { fontSize: 13, fontWeight: "700" },
  sectionLabel: { fontSize: 10, letterSpacing: 1.4, fontWeight: "700", marginBottom: 9 },
  safety: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  signOut: { height: 50, borderRadius: 14, borderWidth: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 5 },
  signOutText: { fontSize: 14, fontWeight: "700" },
  version: { textAlign: "center", marginTop: 25, fontSize: 11 },
});
