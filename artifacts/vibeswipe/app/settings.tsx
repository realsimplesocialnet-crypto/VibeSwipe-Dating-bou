import { useAuth } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Platform,
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
  getGetFollowRequestsQueryKey,
  getGetProfileFollowSummaryQueryKey,
  getGetReelsFeedQueryKey,
  getGetVibeSwipeSettingsQueryKey,
  useGetFollowRequests,
  useGetMyProfile,
  useApproveFollowRequest,
  useDeclineFollowRequest,
  useGetVibeSwipeSettings,
  getSearchTravelCitiesQueryKey,
  useSearchTravelCities,
  useUpdateVibeSwipeSettings,
  type FollowRequest, type VibeSwipeSettings,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/hooks/useTheme";
import { PushNotificationSettings } from "@/components/PushNotificationSettings";
import { DiscoveryLocationSettings } from "@/components/DiscoveryLocationSettings";
import { QuickmavoShopMenuItem } from "@/components/QuickmavoShopMenuItem";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { signOut } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const { scheme, setScheme } = useTheme();
  const queryClient = useQueryClient();
  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut();
      queryClient.clear();
      router.replace("/");
    } catch {
      Alert.alert("Couldn’t log out", "Please check your connection and try again.");
      setLoggingOut(false);
    }
  }
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

  async function saveAccountSettings(patch: Partial<VibeSwipeSettings>) {
    try {
      const saved = await updateSettings.mutateAsync({ data: patch });
      queryClient.setQueryData(getGetVibeSwipeSettingsQueryKey(), { ...settings.data, ...saved });
      if ("privateAccount" in patch || "incognito" in patch) {
        await queryClient.invalidateQueries({ queryKey: getGetDiscoverProfilesQueryKey() });
        await queryClient.invalidateQueries({ queryKey: getGetReelsFeedQueryKey() });
      }
      if ("allowDownloads" in patch || "whoCanComment" in patch || "likedVideoAudience" in patch) {
        await queryClient.invalidateQueries({ queryKey: getGetReelsFeedQueryKey() });
      }
    } catch {
      Alert.alert("Could not save settings", "Please check your connection and try again.");
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
    <ScrollView keyboardShouldPersistTaps="handled" style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.scrollContent, { paddingTop: (Platform.OS === "web" ? 67 : insets.top) + 12, paddingBottom: Math.max(insets.bottom, 16) + 24 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/profile")} accessibilityRole="button" accessibilityLabel="Back to profile" testID="button-settings-back" style={styles.back}>
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
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>PRIVACY</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.row, styles.settingRow]}>
          <View style={[styles.icon, { backgroundColor: colors.accent }]}><Feather name="lock" size={17} color={colors.primary} /></View>
          <View style={styles.copy}><Text style={[styles.rowTitle, { color: colors.foreground }]}>Private account</Text><Text style={[styles.rowSub, { color: colors.mutedForeground }]}>Only approved followers can see your profile and videos.</Text></View>
          <Switch value={settings.data?.privateAccount ?? false} disabled={updateSettings.isPending || settings.isLoading} onValueChange={value=>void saveAccountSettings({ privateAccount: value })} trackColor={{ true: colors.primary }} testID="toggle-private-account"/>
        </View>
      </View>
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>INTERACTIONS</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <ChoiceSetting title="Who can comment" detail="Comments on your Reels" value={settings.data?.whoCanComment ?? "everyone"} disabled={updateSettings.isPending || settings.isLoading} colors={colors} options={[["everyone","Everyone"],["followers","Followers only"],["no_one","No one"]]} onChange={value=>void saveAccountSettings({ whoCanComment: value as VibeSwipeSettings["whoCanComment"] })}/>
        <View style={[styles.divider, { backgroundColor: colors.border }]}/>
        <ChoiceSetting title="Who can message" detail="Who can start a new chat" value={settings.data?.whoCanMessage ?? "everyone"} disabled={updateSettings.isPending || settings.isLoading} colors={colors} options={[["everyone","Everyone"],["followers","Followers only"],["no_one","No one"]]} onChange={value=>void saveAccountSettings({ whoCanMessage: value as VibeSwipeSettings["whoCanMessage"] })}/>
      </View>
      <FollowRequestsPanel colors={colors}/>
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CONTENT</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.row, styles.settingRow]}>
          <View style={[styles.icon, { backgroundColor: colors.accent }]}><Feather name="download" size={17} color={colors.primary} /></View>
          <View style={styles.copy}><Text style={[styles.rowTitle, { color: colors.foreground }]}>Allow downloads</Text><Text style={[styles.rowSub, { color: colors.mutedForeground }]}>Let others download your video Reels.</Text></View>
          <Switch value={settings.data?.allowDownloads ?? true} disabled={updateSettings.isPending || settings.isLoading} onValueChange={value=>void saveAccountSettings({ allowDownloads: value })} trackColor={{ true: colors.primary }} testID="toggle-allow-downloads"/>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]}/>
        <ChoiceSetting title="Show liked videos" detail="Who can see Reels you liked" value={settings.data?.likedVideoAudience ?? "everyone"} disabled={updateSettings.isPending || settings.isLoading} colors={colors} options={[["everyone","Everyone"],["followers","Followers only"],["only_me","Only me"]]} onChange={value=>void saveAccountSettings({ likedVideoAudience: value as VibeSwipeSettings["likedVideoAudience"] })}/>
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
      <QuickmavoShopMenuItem />
      <Pressable onPress={() => void logout()} disabled={loggingOut}
        testID="button-settings-log-out" accessibilityRole="button"
        accessibilityState={{ disabled: loggingOut, busy: loggingOut }}
        style={[styles.signOut, { borderColor: colors.border, opacity: loggingOut ? .5 : 1 }]}>
        <Feather name="log-out" size={17} color={colors.destructive} />
        <Text style={[styles.signOutText, { color: colors.destructive }]}>{loggingOut ? "Logging out…" : "Log out"}</Text>
      </Pressable>
      <Text style={[styles.version, { color: colors.mutedForeground }]}>18+</Text>
    </ScrollView>
  );
}

function ChoiceSetting({ title, detail, value, options, disabled, colors, onChange }: {
  title: string;
  detail: string;
  value: string;
  options: [string, string][];
  disabled: boolean;
  colors: ReturnType<typeof useColors>;
  onChange: (value: string) => void;
}) {
  return <View style={{ gap: 10 }}>
    <View style={styles.row}>
      <View style={styles.copy}><Text style={[styles.rowTitle, { color: colors.foreground }]}>{title}</Text><Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{detail}</Text></View>
    </View>
    <View style={styles.choiceRow}>
      {options.map(([option, label]) => <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: value === option, disabled }} disabled={disabled} onPress={() => onChange(option)} style={[styles.choice, { backgroundColor: value === option ? colors.accent : colors.background, borderColor: value === option ? colors.primary : colors.border, opacity: disabled ? 0.55 : 1 }]}>
        <Text style={[styles.choiceText, { color: value === option ? colors.primary : colors.mutedForeground }]}>{label}</Text>
      </Pressable>)}
    </View>
  </View>;
}

function FollowRequestsPanel({ colors }: { colors: ReturnType<typeof useColors> }) {
  const requests = useGetFollowRequests({ query: { queryKey: getGetFollowRequestsQueryKey() } });
  const me = useGetMyProfile();
  const approve = useApproveFollowRequest();
  const decline = useDeclineFollowRequest();
  const queryClient = useQueryClient();
  async function respond(requesterId: string, action: "approve" | "decline") {
    try {
      if (action === "approve") await approve.mutateAsync({ requesterId });
      else await decline.mutateAsync({ requesterId });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetFollowRequestsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetDiscoverProfilesQueryKey() }),
        me.data?.id ? queryClient.invalidateQueries({ queryKey: getGetProfileFollowSummaryQueryKey(me.data.id) }) : Promise.resolve(),
      ]);
    } catch {
      Alert.alert("Could not update request", "Please check your connection and try again.");
    }
  }
  return <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
    <Text style={[styles.rowTitle, { color: colors.foreground, marginBottom: 5 }]}>Follow requests</Text>
    <Text style={[styles.rowSub, { color: colors.mutedForeground, marginBottom: 12 }]}>Approve or decline people who want to follow your private account.</Text>
    {requests.isLoading ? <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>Loading requests…</Text>
      : requests.isError ? <Pressable onPress={()=>void requests.refetch()}><Text style={[styles.rowSub, { color: colors.destructive }]}>Couldn’t load requests. Tap to retry.</Text></Pressable>
      : requests.data?.length ? requests.data.map((request: FollowRequest)=> <View key={request.requesterId} style={styles.requestRow}>
        <Text numberOfLines={1} style={[styles.requestName, { color: colors.foreground }]}>{request.displayName}</Text>
        <Pressable disabled={approve.isPending||decline.isPending} onPress={()=>void respond(request.requesterId,"decline")} style={[styles.requestButton,{borderColor:colors.border}]}><Text style={{color:colors.mutedForeground,fontSize:12,fontWeight:"700"}}>Decline</Text></Pressable>
        <Pressable disabled={approve.isPending||decline.isPending} onPress={()=>void respond(request.requesterId,"approve")} style={[styles.requestButton,{backgroundColor:colors.primary,borderColor:colors.primary}]}><Text style={{color:colors.primaryForeground,fontSize:12,fontWeight:"700"}}>Approve</Text></Pressable>
      </View>) : <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>No pending requests.</Text>}
  </View>;
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, padding: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 26 },
  back: { width: 44, height: 44, justifyContent: "center" },
  title: { fontSize: 25, fontWeight: "700" },
  section: { borderWidth: 1, borderRadius: 18, padding: 15, marginBottom: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 11 },
  icon: { width: 36, height: 36, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 14, fontWeight: "700" },
  rowSub: { fontSize: 12, lineHeight: 17 },
  settingRow: { minHeight: 54 },
  choiceRow: { flexDirection: "row", gap: 6 },
  choice: { flex: 1, minHeight: 38, paddingHorizontal: 5, borderRadius: 11, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  choiceText: { fontSize: 11, fontWeight: "700", textAlign: "center" },
  requestRow: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#444" },
  requestName: { flex: 1, fontSize: 13, fontWeight: "600" },
  requestButton: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
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
