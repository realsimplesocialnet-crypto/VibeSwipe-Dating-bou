import { useAuth } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  getGetVibeSwipeSettingsQueryKey,
  useGetVibeSwipeSettings,
  useUpdateVibeSwipeSettings,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/hooks/useTheme";

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
  const [citySearch, setCitySearch] = useState("");
  const dark = scheme === "dark";
  const citySuggestions = useMemo(() => {
    const options = ["Lagos", "Abuja", "Port Harcourt", "Accra", "London", "Nairobi", "Cape Town", "New York", "Toronto", "Dubai"];
    const query = citySearch.trim().toLowerCase();
    return query ? options.filter((city) => city.toLowerCase().includes(query)).slice(0, 4) : options.slice(0, 4);
  }, [citySearch]);

  useEffect(() => {
    if (!settings.data) return;
    setIncognito(settings.data.incognito);
    setTravelMode(settings.data.travelMode);
    setTravelCity(settings.data.travelCity ?? "");
    setCitySearch(settings.data.travelCity ?? "");
  }, [settings.data]);

  async function savePrivacySettings(next: {
    incognito: boolean;
    travelMode: boolean;
    travelCity: string | null;
  }) {
    try {
      await updateSettings.mutateAsync({
        data: {
          incognito: next.incognito,
          travelMode: next.travelMode,
          travelCity: next.travelCity,
        },
      });
      await queryClient.invalidateQueries({
        queryKey: getGetVibeSwipeSettingsQueryKey(),
      });
    } catch {
      Alert.alert("Could not save settings", "Please try again.");
    }
  }

  async function selectCity(value: string) {
    const selected = value.trim();
    if (!selected) return;
    setTravelCity(selected);
    setCitySearch(selected);
    await savePrivacySettings({
      incognito,
      travelMode,
      travelCity: selected,
    });
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
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
          <Switch value={dark} onValueChange={(value) => void setScheme(value ? "dark" : "light")} trackColor={{ true: colors.primary }} />
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
              setIncognito(value);
              void savePrivacySettings({ incognito: value, travelMode, travelCity: travelCity || null });
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
            disabled={updateSettings.isPending || settings.isLoading || (!travelCity && !travelMode)}
            onValueChange={(value) => {
              if (value && !travelCity.trim()) {
                Alert.alert("Choose a city first", "Search for and select a travel city to turn on Travel Mode.");
                return;
              }
              setTravelMode(value);
              void savePrivacySettings({ incognito, travelMode: value, travelCity: travelCity || null });
            }}
            trackColor={{ true: colors.primary }}
          />
        </View>
        <TextInput
          value={citySearch}
          onChangeText={setCitySearch}
          onSubmitEditing={() => void selectCity(citySearch)}
          placeholder="Search any city"
          placeholderTextColor={colors.mutedForeground}
          returnKeyType="search"
          style={[styles.cityInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
        />
        {citySearch.trim() && !citySuggestions.some((city) => city.toLowerCase() === citySearch.trim().toLowerCase()) ? (
          <Pressable onPress={() => void selectCity(citySearch)} style={[styles.suggestion, { borderColor: colors.border }]}>
            <Feather name="map-pin" size={15} color={colors.primary} />
            <Text style={[styles.suggestionText, { color: colors.foreground }]}>Use “{citySearch.trim()}”</Text>
          </Pressable>
        ) : null}
        {citySuggestions.map((city) => (
          <Pressable key={city} onPress={() => void selectCity(city)} style={[styles.suggestion, { borderColor: colors.border }]}>
            <Feather name="map-pin" size={15} color={colors.mutedForeground} />
            <Text style={[styles.suggestionText, { color: colors.foreground }]}>{city}</Text>
            {travelCity.toLowerCase() === city.toLowerCase() ? <Feather name="check" size={16} color={colors.primary} /> : null}
          </Pressable>
        ))}
      </View>
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SAFETY</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.safety}>
          <Feather name="shield" size={19} color={colors.primary} />
          <View style={styles.copy}>
            <Text style={[styles.rowTitle, { color: colors.foreground }]}>Your safety matters</Text>
            <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>You can block and report a profile from its details.</Text>
          </View>
        </View>
      </View>
      <Pressable onPress={() => void signOut().then(() => router.replace("/"))} style={[styles.signOut, { borderColor: colors.border }]}>
        <Feather name="log-out" size={17} color={colors.destructive} />
        <Text style={[styles.signOutText, { color: colors.destructive }]}>Sign out</Text>
      </Pressable>
      <Text style={[styles.version, { color: colors.mutedForeground }]}>VibeSwipe · 18+</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, paddingTop: 58 },
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
  sectionLabel: { fontSize: 10, letterSpacing: 1.4, fontWeight: "700", marginBottom: 9 },
  safety: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  signOut: { height: 50, borderRadius: 14, borderWidth: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 5 },
  signOutText: { fontSize: 14, fontWeight: "700" },
  version: { textAlign: "center", marginTop: 25, fontSize: 11 },
});
