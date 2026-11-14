import { City, Country, State } from "country-state-city";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  getGetDiscoverProfilesQueryKey,
  getGetMyProfileQueryKey,
  useGetMyProfile,
  useSaveMyProfile,
  type ProfileInput,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

type LocationScope = "city" | "state" | "country" | "radius";
type DiscoveryLocation = {
  scope: LocationScope;
  country: string | null;
  state: string | null;
  city: string | null;
  radiusKm: number | null;
};

const COUNTRY_OPTIONS = Country.getAllCountries()
  .map(({ isoCode, name }) => ({ code: isoCode, name }))
  .sort((a, b) => a.name.localeCompare(b.name));
const RADIUS_OPTIONS = [25, 50, 100, 200, 500];

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

export function DiscoveryLocationSettings() {
  const colors = useColors();
  const profile = useGetMyProfile();
  const saveProfile = useSaveMyProfile();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<DiscoveryLocation | null>(null);
  const [countrySearch, setCountrySearch] = useState("");
  const [stateSearch, setStateSearch] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const current: DiscoveryLocation = draft ?? {
    scope: profile.data?.preferences.discoveryLocation?.scope ?? "city",
    country: profile.data?.preferences.discoveryLocation?.country ?? profile.data?.country ?? null,
    state: profile.data?.preferences.discoveryLocation?.state ?? profile.data?.state ?? null,
    city: profile.data?.preferences.discoveryLocation?.city ?? profile.data?.city ?? null,
    radiusKm: profile.data?.preferences.discoveryLocation?.radiusKm ?? profile.data?.preferences.distanceKm ?? 50,
  };
  const countryCode = COUNTRY_OPTIONS.find((option) => option.name === current.country)?.code ?? "";
  const stateOptions = useMemo(
    () => countryCode ? State.getStatesOfCountry(countryCode).map(({ isoCode, name }) => ({ code: isoCode, name })) : [],
    [countryCode],
  );
  const stateCode = stateOptions.find((option) => option.name === current.state)?.code ?? "";
  const cityOptions = useMemo(
    () => countryCode && stateCode ? City.getCitiesOfState(countryCode, stateCode) : [],
    [countryCode, stateCode],
  );
  const countrySuggestions = countrySearch.trim().length >= 2
    ? COUNTRY_OPTIONS.filter((option) => normalize(option.name).includes(normalize(countrySearch))).slice(0, 8)
    : [];
  const stateSuggestions = stateSearch.trim().length >= 1
    ? stateOptions.filter((option) => normalize(option.name).includes(normalize(stateSearch))).slice(0, 8)
    : [];
  const citySuggestions = citySearch.trim().length >= 1
    ? [...new Set(cityOptions.map((option) => option.name))]
        .filter((name) => normalize(name).includes(normalize(citySearch)))
        .slice(0, 8)
    : [];
  const radiusChoices = [...new Set([...RADIUS_OPTIONS, current.radiusKm ?? 50])].sort((a, b) => a - b);

  function update(next: Partial<DiscoveryLocation>) {
    setDraft({ ...current, ...next });
    setMessage("");
    setError("");
  }

  function selectCountry(name: string) {
    setCountrySearch(name);
    setStateSearch("");
    setCitySearch("");
    update({ country: name, state: null, city: null });
  }

  function selectState(name: string) {
    setStateSearch(name);
    setCitySearch("");
    update({ state: name, city: null });
  }

  function selectCity(name: string) {
    setCitySearch(name);
    update({ city: name });
  }

  function useHomeLocation() {
    if (!profile.data) return;
    setCountrySearch(profile.data.country ?? "");
    setStateSearch(profile.data.state ?? "");
    setCitySearch(profile.data.city ?? "");
    update({
      scope: "city",
      country: profile.data.country,
      state: profile.data.state,
      city: profile.data.city,
      radiusKm: profile.data.preferences.distanceKm,
    });
  }

  async function saveLocation() {
    const currentProfile = profile.data;
    if (!currentProfile) return;
    if (!current.country || ((current.scope !== "country") && !current.state) ||
        ((current.scope === "city" || current.scope === "radius") && !current.city)) {
      setError("Choose a country, then the required state and city before saving.");
      return;
    }

    const discoveryLocation: DiscoveryLocation = {
      scope: current.scope,
      country: current.country,
      state: current.scope === "country" ? null : current.state,
      city: current.scope === "city" || current.scope === "radius" ? current.city : null,
      radiusKm: current.scope === "radius" ? current.radiusKm ?? 50 : null,
    };
    const data: ProfileInput = {
      name: currentProfile.name,
      age: currentProfile.age ?? 18,
      gender: currentProfile.gender,
      lookingFor: currentProfile.lookingFor,
      bio: currentProfile.bio,
      city: currentProfile.city,
      country: currentProfile.country,
      state: currentProfile.state,
      interests: currentProfile.interests ?? [],
      occupation: currentProfile.occupation ?? "",
      occupationOther: currentProfile.occupationOther ?? "",
      photos: currentProfile.photos ?? [],
      videoUrl: currentProfile.videoUrl ?? null,
      preferences: {
        ...currentProfile.preferences,
        ...(current.scope === "radius" ? { distanceKm: current.radiusKm ?? 50 } : {}),
        discoveryLocation,
      },
    };

    setError("");
    setMessage("");
    try {
      const saved = await saveProfile.mutateAsync({ data });
      queryClient.setQueryData(getGetMyProfileQueryKey(), saved);
      await queryClient.invalidateQueries({ queryKey: getGetDiscoverProfilesQueryKey() });
      setDraft(null);
      setMessage("Saved. Discover will use this area.");
    } catch {
      setError("Your discovery area could not be saved. Check your connection and try again.");
    }
  }

  const canSave = Boolean(
    current.country &&
      (current.scope === "country" ||
        (current.state &&
          (current.scope === "state" || ((current.scope === "city" || current.scope === "radius") && current.city)))),
  );

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.heading}>
        <View style={[styles.icon, { backgroundColor: colors.accent }]}>
          <Feather name="map-pin" size={17} color={colors.primary}/>
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.foreground }]}>Preferred discovery area</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            City first, then your state. Other areas appear only when you choose them here.
          </Text>
        </View>
      </View>

      {profile.isLoading ? <Text style={[styles.status, { color: colors.mutedForeground }]}>Loading your profile location…</Text> :
        profile.isError ? <Text style={[styles.status, { color: colors.destructive }]}>Your saved location could not be loaded. Reopen Settings to try again.</Text> :
        <>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Search area</Text>
          <View style={styles.scopeWrap}>
            {([
              ["city", "City"],
              ["state", "State"],
              ["country", "Country"],
              ["radius", "Radius"],
            ] as const).map(([value, label]) => {
              const selected = current.scope === value;
              return (
                <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => update({ scope: value })} style={[styles.scopeChip, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.accent : "transparent" }]}>
                  <Text style={{ color: selected ? colors.primary : colors.foreground, fontSize: 12, fontWeight: "700" }}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: colors.mutedForeground }]}>Country</Text>
          <TextInput
            value={countrySearch || current.country || ""}
            onChangeText={(value) => { setCountrySearch(value); if (value !== current.country) update({ country: null, state: null, city: null }); }}
            placeholder="Search all countries"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            testID="input-discovery-country"
          />
          {countrySuggestions.map((option) => (
            <Pressable key={option.code} onPress={() => selectCountry(option.name)} style={[styles.suggestion, { borderColor: colors.border }]}>
              <Text style={[styles.suggestionText, { color: colors.foreground }]}>{option.name}</Text>
              {current.country === option.name ? <Feather name="check" size={16} color={colors.primary}/> : null}
            </Pressable>
          ))}

          {current.scope !== "country" ? (
            <>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>State / region</Text>
              <TextInput
                value={stateSearch || current.state || ""}
                onChangeText={(value) => { setStateSearch(value); if (value !== current.state) update({ state: null, city: null }); }}
                editable={Boolean(countryCode)}
                placeholder={countryCode ? "Search a state or region" : "Choose a country first"}
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, opacity: countryCode ? 1 : 0.5 }]}
                testID="input-discovery-state"
              />
              {stateSuggestions.map((option) => (
                <Pressable key={option.code} onPress={() => selectState(option.name)} style={[styles.suggestion, { borderColor: colors.border }]}>
                  <Text style={[styles.suggestionText, { color: colors.foreground }]}>{option.name}</Text>
                  {current.state === option.name ? <Feather name="check" size={16} color={colors.primary}/> : null}
                </Pressable>
              ))}
            </>
          ) : null}

          {current.scope === "city" || current.scope === "radius" ? (
            <>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>City</Text>
              <TextInput
                value={citySearch || current.city || ""}
                onChangeText={(value) => { setCitySearch(value); if (value !== current.city) update({ city: null }); }}
                editable={Boolean(stateCode)}
                placeholder={stateCode ? "Search a real city" : "Choose a state first"}
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, opacity: stateCode ? 1 : 0.5 }]}
                testID="input-discovery-city"
              />
              {citySuggestions.map((name) => (
                <Pressable key={`${stateCode}-${name}`} onPress={() => selectCity(name)} style={[styles.suggestion, { borderColor: colors.border }]}>
                  <Text style={[styles.suggestionText, { color: colors.foreground }]}>{name}</Text>
                  {current.city === name ? <Feather name="check" size={16} color={colors.primary}/> : null}
                </Pressable>
              ))}
            </>
          ) : null}

          {current.scope === "radius" ? (
            <>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Distance radius</Text>
              <View style={styles.scopeWrap}>
                {radiusChoices.map((value) => {
                  const selected = current.radiusKm === value;
                  return (
                    <Pressable key={value} onPress={() => update({ radiusKm: value })} style={[styles.scopeChip, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.accent : "transparent" }]}>
                      <Text style={{ color: selected ? colors.primary : colors.foreground, fontSize: 12, fontWeight: "700" }}>{value} km</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.status, { color: colors.mutedForeground }]}>Distance is estimated from city centers; nearby profiles may be in another state if they fit this radius.</Text>
            </>
          ) : null}

          <View style={styles.actions}>
            <Pressable accessibilityRole="button" disabled={!canSave || saveProfile.isPending} onPress={() => void saveLocation()} style={[styles.saveButton, { backgroundColor: colors.secondary, opacity: canSave && !saveProfile.isPending ? 1 : 0.5 }]} testID="button-save-discovery-location">
              <Text style={[styles.saveText, { color: colors.foreground }]}>{saveProfile.isPending ? "Saving…" : "Save area"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={useHomeLocation} style={[styles.homeButton, { borderColor: colors.border }]} testID="button-use-home-discovery-location">
              <Text style={[styles.homeText, { color: colors.mutedForeground }]}>Use registered location</Text>
            </Pressable>
          </View>
          {message ? <Text accessibilityRole="status" style={[styles.status, { color: colors.primary }]}>{message}</Text> : null}
          {error ? <Text accessibilityRole="alert" style={[styles.status, { color: colors.destructive }]}>{error}</Text> : null}
          <Text style={[styles.status, { color: colors.mutedForeground }]}>Travel Mode temporarily overrides this saved area.</Text>
        </>
      }
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 15, marginBottom: 20 },
  heading: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 16 },
  icon: { width: 36, height: 36, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, gap: 4 },
  title: { fontSize: 14, fontWeight: "700" },
  subtitle: { fontSize: 12, lineHeight: 17 },
  label: { fontSize: 11, fontWeight: "700", marginTop: 12, marginBottom: 7 },
  scopeWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  scopeChip: { minHeight: 36, justifyContent: "center", paddingHorizontal: 11, borderRadius: 10, borderWidth: 1 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 14 },
  suggestion: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  suggestionText: { fontSize: 13, fontWeight: "500" },
  actions: { gap: 9, marginTop: 16 },
  saveButton: { minHeight: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  saveText: { fontSize: 13, fontWeight: "700" },
  homeButton: { minHeight: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  homeText: { fontSize: 12, fontWeight: "600" },
  status: { fontSize: 12, lineHeight: 18, marginTop: 9 },
});
