import {
  createUseDiscoveryDeck,
  getGetBoostStatusQueryKey,
  getGetDailyLikeStatusQueryKey,
  getGetDiscoverProfilesQueryKey,
  getGetProfileByIdQueryKey,
  getGetProfileDatingStateQueryKey,
  getGetProfileFollowSummaryQueryKey,
  getGetMatchesQueryKey,
  getGetNotificationsQueryKey,
  getGetSuperLikeStatusQueryKey,
  getGetVibeSwipeSettingsQueryKey,
  getProfileDatingState,
  getProfileFollowSummary,
  formatDiscoveryLocationStatus,
  geolocationFailureMessage,
  locationPermissionFailureMessage,
  useBlockProfile,
  useCreateReaction,
  useActivateBoost,
  useGetBoostStatus,
  useGetDailyLikeStatus,
  useGetDiscoverProfiles,
  useGetMyProfile,
  useGetSuperLikeStatus,
  useGetVibeSwipeSettings,
  useRecordProfileView,
  useReportProfile,
  useResolveDiscoveryLocation,
  useUndoLastPass,
  type Profile,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import * as Location from "expo-location";
import { City, Country, State } from "country-state-city";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Image as PositionedImage } from "expo-image";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { profileImagePreviewSource } from "@/lib/media";
import { MatchCelebration } from "@/components/MatchCelebration";

const useDiscoveryDeck = createUseDiscoveryDeck(useState);
const FILTER_COUNTRIES = Country.getAllCountries()
  .map(({ isoCode, name }) => ({ code: isoCode, name }))
  .sort((a, b) => a.name.localeCompare(b.name));
type SwipeDirection = "pass" | "like" | "super";

function SwipeCard({
  profile,
  token,
  onSwipe,
  onPressDetails,
  onOpenProfile,
  topInset,
  actionBottom,
}: {
  profile: Profile;
  token: string | null;
  onSwipe: (direction: SwipeDirection) => void;
  onPressDetails: () => void;
  onOpenProfile: () => void;
  topInset: number;
  actionBottom: number;
}) {
  const colors = useColors();
  const { width, height } = useWindowDimensions();
  const pan = useRef(new Animated.ValueXY()).current;
  const swipeRef = useRef(onSwipe);
  swipeRef.current = onSwipe;
  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
        onPanResponderMove: (_, gesture) => pan.setValue({ x: gesture.dx, y: gesture.dy }),
        onPanResponderRelease: (_, gesture) => {
          const direction: SwipeDirection | null =
            gesture.dx > 90 ? "like" : gesture.dx < -90 ? "pass" : gesture.dy < -110 ? "super" : null;
          if (!direction) {
            Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true, friction: 7 }).start();
            return;
          }
          Animated.timing(pan, {
            toValue: {
              x: direction === "like" ? width * 1.3 : direction === "pass" ? -width * 1.3 : 0,
              y: direction === "super" ? -height : 0,
            },
            duration: 190,
            useNativeDriver: true,
          }).start(({ finished }) => {
            if (finished) {
              swipeRef.current(direction);
              pan.setValue({ x: 0, y: 0 });
            }
          });
        },
      }),
    [height, pan, width],
  );
  const cardTransform = {
    transform: [
      ...pan.getTranslateTransform(),
      {
        rotate: pan.x.interpolate({
          inputRange: [-width, 0, width],
          outputRange: ["-12deg", "0deg", "12deg"],
          extrapolate: "clamp",
        }),
      },
    ],
  };
  const poster = profileImagePreviewSource(profile.photos[0], token);
  const heroSource = typeof poster === "number" ? poster : poster && "uri" in poster ? { uri: poster.uri, headers: poster.headers } : null;

  return (
    <Animated.View
      {...responder.panHandlers}
      style={[styles.card, { backgroundColor: colors.discoverBackground }, cardTransform]}
    >
      <ScrollView
        style={styles.profileScroll}
        contentContainerStyle={{ paddingBottom: actionBottom + 104 }}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.photoHero, { backgroundColor: colors.card }]}>
          {heroSource ? <PositionedImage key={profile.id} source={heroSource} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" cachePolicy="none" /> : null}
          <LinearGradient
            colors={[colors.discoverGradientTop, colors.discoverGradientMiddle, colors.discoverGradientBottom]}
            locations={[0.22, 0.54, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${profile.name}'s full profile`}
            testID="open-full-profile"
            onPress={onOpenProfile}
            style={StyleSheet.absoluteFill}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Profile options for ${profile.name}`}
            testID="profile-options"
            onPress={onPressDetails}
            style={[styles.profileOptions, { top: topInset + 58, backgroundColor: colors.discoverControl, borderColor: colors.discoverControlBorder }]}
          >
            <Feather name="more-horizontal" size={19} color={colors.discoverForeground} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`View ${profile.name}'s full profile`} testID="open-full-profile-details" onPress={onOpenProfile} style={styles.heroCopy}>
            <View style={styles.nameLine}>
              <Text numberOfLines={1} style={[styles.name, { color: colors.discoverForeground }]}>{profile.name}</Text>
              <Text style={[styles.age, { color: colors.discoverMuted }]}>{profile.age}</Text>
            </View>
            <View style={styles.locationLine}>
              <Feather name="map-pin" size={13} color={colors.discoverMuted} />
              <Text style={[styles.location, { color: colors.discoverMuted }]}>{[profile.city, profile.state, profile.country].filter(Boolean).join(", ") || "Nearby"}</Text>
            </View>
            {profile.interests[0] ? (
              <View style={styles.interests}>
                <Text style={[styles.interestTag, { backgroundColor: colors.discoverControl, color: colors.discoverForeground }]}>
                  {profile.interests[0]}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

export default function DiscoverScreen() {
  const colors = useColors();
  const { getToken } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [locationPermission, requestLocationPermission] =
    Location.useForegroundPermissions();
  const resolveLocation = useResolveDiscoveryLocation();
  const reaction = useCreateReaction();
  const reportProfile = useReportProfile();
  const blockProfile = useBlockProfile();
  const superLikeStatus = useGetSuperLikeStatus({ query: { refetchInterval: 60_000 } });
  const dailyLikeStatus = useGetDailyLikeStatus({ query: { refetchInterval: 60_000 } });
  const undoLastPass = useUndoLastPass();
  const boostStatus = useGetBoostStatus({ query: { refetchInterval: 10_000 } });
  const activateBoost = useActivateBoost();
  const recordProfileView = useRecordProfileView();
  const [ageMin, setAgeMin] = useState(22);
  const [ageMax, setAgeMax] = useState(35);
  const [gender, setGender] = useState<string | undefined>(undefined);
  const [selectedCountry, setSelectedCountry] = useState<(typeof FILTER_COUNTRIES)[number] | null>(null);
  const [countrySearch, setCountrySearch] = useState("");
  const [selectedState, setSelectedState] = useState<{ code: string; name: string } | null>(null);
  const [stateSearch, setStateSearch] = useState("");
  const [city, setCity] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [canOpenLocationSettings, setCanOpenLocationSettings] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [banner, setBanner] = useState("");
  const [busy, setBusy] = useState(false);
  const [matchResult, setMatchResult] = useState<{ profile: Profile; matchId: string | null } | null>(null);
  const myProfile = useGetMyProfile();
  const [lastPassedProfileId, setLastPassedProfileId] = useState<string | null>(null);
  const [clock, setClock] = useState(Date.now());
  const [token, setToken] = useState<string | null>(null);
  const viewedProfiles = useRef(new Set<string>());
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousTravelFilter = useRef<string | null>(null);
  const countrySuggestions = useMemo(() => {
    const search = countrySearch.trim().toLocaleLowerCase();
    if (!search || selectedCountry?.name === countrySearch) return [];
    return FILTER_COUNTRIES.filter((item) => item.name.toLocaleLowerCase().includes(search)).slice(0, 8);
  }, [countrySearch, selectedCountry]);
  const statesInCountry = useMemo(
    () => selectedCountry
      ? State.getStatesOfCountry(selectedCountry.code).map(({ isoCode, name }) => ({ code: isoCode, name }))
      : [],
    [selectedCountry],
  );
  const stateSuggestions = useMemo(() => {
    const search = stateSearch.trim().toLocaleLowerCase();
    if (!selectedCountry || !search || selectedState?.name === stateSearch) return [];
    return statesInCountry
      .filter((item) => item.name.toLocaleLowerCase().includes(search))
      .slice(0, 8);
  }, [selectedCountry, selectedState, stateSearch, statesInCountry]);
  const citiesInCountry = useMemo(() => {
    if (!selectedCountry) return [];
    const entries = selectedState
      ? City.getCitiesOfState(selectedCountry.code, selectedState.code)
      : City.getCitiesOfCountry(selectedCountry.code) ?? [];
    return [...new Set(entries.map(({ name }) => name))]
      .sort((a, b) => a.localeCompare(b));
  }, [selectedCountry, selectedState]);
  const citySuggestions = useMemo(() => {
    const search = citySearch.trim().toLocaleLowerCase();
    if (!selectedCountry || search.length < 2 || city === citySearch) return [];
    const matches = citiesInCountry.filter((name) => name.toLocaleLowerCase().includes(search));
    return [
      ...matches.filter((name) => name.toLocaleLowerCase().startsWith(search)),
      ...matches.filter((name) => !name.toLocaleLowerCase().startsWith(search)),
    ].slice(0, 8);
  }, [citiesInCountry, city, citySearch, selectedCountry]);
  const discoverySettings = useGetVibeSwipeSettings({
    query: { queryKey: getGetVibeSwipeSettingsQueryKey() },
  });
  const topInset = Math.max(insets.top, Platform.OS === "web" ? 67 : 12);
  const actionBottom = Platform.OS === "web" ? 100 : Math.max(insets.bottom + 62, 82);
  const discoverParams = useMemo(
    () => ({ ageMin, ageMax, ...(gender ? { gender } : {}), ...(selectedCountry ? { country: selectedCountry.name } : {}), ...(selectedState ? { state: selectedState.name } : {}), ...(city.trim() ? { city: city.trim() } : {}) }),
    [ageMin, ageMax, city, gender, selectedCountry, selectedState],
  );
  const feedKey = JSON.stringify([discoverParams, discoverySettings.data?.travelMode, discoverySettings.data?.travelCity, myProfile.data?.country, myProfile.data?.preferences.discoveryLocation]);
  const discover = useGetDiscoverProfiles(discoverParams, {
    query: { queryKey: [...getGetDiscoverProfilesQueryKey(discoverParams), feedKey], refetchOnWindowFocus: false, refetchInterval: 30_000 },
  });
  const { profiles, index, setIndex, refill } = useDiscoveryDeck(discover.data, feedKey);
  const profile = profiles[index];
  useEffect(() => {
    for (const candidate of profiles.slice(index, index + 8)) {
      const key = getGetProfileByIdQueryKey(candidate.id);
      const cached = queryClient.getQueryState(key);
      if (!cached?.data || Date.now() - cached.dataUpdatedAt > 10 * 60_000) {
        void queryClient.prefetchQuery({
          queryKey: key,
          queryFn: async () => candidate,
          staleTime: 10 * 60_000,
          gcTime: 30 * 60_000,
        });
      }
    }
  }, [profiles, index, queryClient]);
  useEffect(() => {
    if (!token) return;
    const sources = profiles.slice(index, index + 3)
      .map((candidate) => profileImagePreviewSource(candidate.photos?.[0], token))
      .filter((source): source is { uri: string } =>
        typeof source === "object" && source !== null && "uri" in source && typeof source.uri === "string",
      );
    if (sources.length) {
      void PositionedImage.prefetch(sources.map((source) => source.uri), {
        cachePolicy: "memory-disk",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  }, [profiles, index, token]);
  const worldwide = Boolean(profile?.discoveryExpanded || discover.data?.some(p => p.discoveryExpanded));
  const tailRequested = useRef("");
  useEffect(() => {
    const tailKey = `${feedKey}:${index}`;
    if (index < 1 || index < profiles.length - 2 || busy || discover.isFetching || tailRequested.current === tailKey) return;
    tailRequested.current = tailKey;
    const exhausted = index >= profiles.length;
    void discover.refetch().then(result => { if (exhausted && !result.isError) refill(result.data); });
  }, [feedKey, index, profiles.length, busy, discover.isFetching]);
  useEffect(() => {
    let active = true;
    void getToken().then((value) => {
      if (active) setToken(value);
    });
    return () => {
      active = false;
    };
  }, [getToken]);
  useEffect(() => {
    if (!discoverySettings.data) return;
    const filter = `${discoverySettings.data.travelMode}:${discoverySettings.data.travelCity ?? ""}`;
    if (previousTravelFilter.current !== null && previousTravelFilter.current !== filter) {
      setIndex(0);
      setCity("");
      setCitySearch("");
      setSelectedCountry(null);
      setCountrySearch("");
    }
    previousTravelFilter.current = filter;
  }, [discoverySettings.data?.travelMode, discoverySettings.data?.travelCity]);
  useEffect(() => {
    const interval = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => () => {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
  }, []);
  useEffect(() => {
    if (!profile || profile.isDemo || viewedProfiles.current.has(profile.id)) return;
    viewedProfiles.current.add(profile.id);
    recordProfileView.mutate({ profileId: profile.id });
  }, [profile?.id]);

  async function swipe(direction: SwipeDirection) {
    if (!profile || busy || matchResult) return;
    const current = profile;
    if (direction === "like" && dailyLikeStatus.data?.remaining === 0) {
      setBanner("You’ve reached your daily like limit. Come back in 24 hours.");
      return;
    }
    setBusy(true);
    setBanner("");
    setLastPassedProfileId(direction === "pass" ? profile.id : null);
    void Haptics.impactAsync(
      direction === "pass" ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium,
    );
    setIndex((current) => current + 1);
    try {
      const result = await reaction.mutateAsync({
        data: { toUserId: profile.id, type: direction },
      });
      if (direction === "super") {
        await queryClient.invalidateQueries({ queryKey: getGetSuperLikeStatusQueryKey() });
      }
      if (direction === "like") {
        await queryClient.invalidateQueries({ queryKey: getGetDailyLikeStatusQueryKey() });
      }
      if (result.matched) {
        await queryClient.invalidateQueries({ queryKey: getGetMatchesQueryKey() });
        await queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
      }
      if (direction === "like" || direction === "super" || result.matched) {
        if (bannerTimer.current) clearTimeout(bannerTimer.current);
        setBanner(
          result.matched
            ? `You and ${profile.name} matched.`
            : direction === "like"
              ? `You liked ${profile.name}`
              : `You super liked ${profile.name}`,
        );
        bannerTimer.current = setTimeout(() => {
          setBanner("");
          bannerTimer.current = null;
          if (result.matched) {
            setMatchResult({ profile: current, matchId: result.matchId ?? null });
          }
        }, 1500);
      }
    } catch (error) {
      if ((error as { status?: number }).status === 404) {
        setBanner("This profile is no longer available. Finding someone new.");
        void discover.refetch();
        return;
      }
      if (direction === "like") await dailyLikeStatus.refetch();
      if (direction === "super") await superLikeStatus.refetch();
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
      setBanner(
        direction === "like" && dailyLikeStatus.data?.remaining === 0
          ? "You’ve reached your daily like limit. Come back in 24 hours."
          : "That action did not save. Try again.",
      );
      setIndex((current) => Math.max(0, current - 1));
      setLastPassedProfileId(null);
    } finally {
      setBusy(false);
    }
  }

  async function report(reason: "spam" | "fake" | "inappropriate" | "harassment" | "other") {
    if (!profile) return;
    try {
      await reportProfile.mutateAsync({ data: { targetUserId: profile.id, reason } });
      Alert.alert("Report submitted", "Thank you. We’ll review this profile.");
      setDetailOpen(false);
    } catch {
      Alert.alert("Could not submit report", "Please try again.");
    }
  }

  async function block() {
    if (!profile) return;
    try {
      await blockProfile.mutateAsync({ data: { targetUserId: profile.id } });
      setIndex((current) => current + 1);
      await queryClient.invalidateQueries({ queryKey: getGetDiscoverProfilesQueryKey(discoverParams) });
      setDetailOpen(false);
    } catch {
      Alert.alert("Could not block profile", "Please try again.");
    }
  }

  async function undoPass() {
    if (!lastPassedProfileId || undoLastPass.isPending) return;
    try {
      const result = await undoLastPass.mutateAsync();
      if (!result.undone || result.targetUserId !== lastPassedProfileId) {
        setLastPassedProfileId(null);
        Alert.alert("Nothing to undo", "Only your most recent pass can be undone.");
        return;
      }
      setIndex((current) => Math.max(0, current - 1));
      setLastPassedProfileId(null);
      await queryClient.invalidateQueries({ queryKey: getGetDiscoverProfilesQueryKey(discoverParams) });
    } catch {
      Alert.alert("Could not undo swipe", "Please try again.");
    }
  }

  async function startBoost() {
    if (!boostStatus.data?.available || activateBoost.isPending) return;
    try {
      await activateBoost.mutateAsync();
      await queryClient.invalidateQueries({ queryKey: getGetBoostStatusQueryKey() });
      Alert.alert("Boost is on", "Your profile will be prioritized for the next 30 minutes.");
    } catch {
      await boostStatus.refetch();
      Alert.alert("Boost unavailable", "Your Boost is active or still cooling down.");
    }
  }

  async function useCurrentLocation() {
    setLocationMessage("");
    setCanOpenLocationSettings(false);
    if (discoverySettings.data?.travelMode) {
      setLocationMessage("Turn off Travel Mode before changing your discovery location.");
      return;
    }
    setLocating(true);
    try {
      let latitude: number;
      let longitude: number;
      if (Platform.OS === "web") {
        if (!globalThis.navigator?.geolocation) {
          throw new Error("location-unavailable");
        }
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          globalThis.navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            maximumAge: 0,
            timeout: 12_000,
          });
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } else {
        const permission = locationPermission?.granted
          ? locationPermission
          : await requestLocationPermission();
        if (!permission.granted) {
          const settingsRequired =
            permission.status === "denied" && permission.canAskAgain === false;
          setCanOpenLocationSettings(settingsRequired);
          setLocationMessage(
            locationPermissionFailureMessage(!settingsRequired),
          );
          return;
        }
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      }

      const resolved = await resolveLocation.mutateAsync({
        data: { latitude, longitude },
      });
      const country = FILTER_COUNTRIES.find(
        (item) => item.code === resolved.country.code,
      );
      if (!country) throw new Error("unsupported-country");
      const state = resolved.state
        ? statesInCountry.find((item) => item.code === resolved.state?.code)
          ?? State.getStatesOfCountry(country.code)
            .map(({ isoCode, name }) => ({ code: isoCode, name }))
            .find((item) => item.code === resolved.state?.code)
          ?? null
        : null;
      if (resolved.state && !state) throw new Error("unsupported-state");
      const cityOptions = state
        ? City.getCitiesOfState(country.code, state.code)
        : City.getCitiesOfCountry(country.code) ?? [];
      if (!cityOptions.some((item) => item.name === resolved.city.name)) {
        throw new Error("unsupported-city");
      }

      setSelectedCountry(country);
      setCountrySearch(country.name);
      setSelectedState(state);
      setStateSearch(state?.name ?? "");
      setCity(resolved.city.name);
      setCitySearch(resolved.city.name);
      setLocationMessage(formatDiscoveryLocationStatus(resolved));
    } catch (error) {
      const code =
        typeof error === "object" && error && "code" in error
          ? Number((error as { code: unknown }).code)
          : undefined;
      setLocationMessage(geolocationFailureMessage(code));
    } finally {
      setLocating(false);
    }
  }

  const boostActive = Boolean(
    boostStatus.data?.active &&
      boostStatus.data.boostEndTime &&
      new Date(boostStatus.data.boostEndTime).getTime() > clock,
  );
  const boostEnd = boostStatus.data?.boostEndTime
    ? new Date(boostStatus.data.boostEndTime).getTime()
    : 0;
  const boostAvailableAt = boostStatus.data?.nextBoostAvailableTime
    ? new Date(boostStatus.data.nextBoostAvailableTime).getTime()
    : 0;
  const boostRemaining = Math.max(
    0,
    (boostActive ? boostEnd : boostAvailableAt) - clock,
  );
  const boostTimeLabel = `${String(Math.floor(boostRemaining / 60_000)).padStart(2, "0")}:${String(Math.floor((boostRemaining % 60_000) / 1000)).padStart(2, "0")}`;
  const boostLabel = !boostStatus.data
    ? "Boost"
    : boostActive
      ? `Boost · ${boostTimeLabel}`
      : boostStatus.data.available
        ? "Boost for 30 min"
        : `Available in ${boostTimeLabel}`;

  if (discover.isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Loading" />
      </View>
    );
  }
  if (discover.isError && (!discover.data || [401, 403, 409].includes(discover.error.status))) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Loading" />
      </View>
    );
  }
  const emptyState = !profile ? (
      <View style={[styles.center, { backgroundColor: colors.background, paddingHorizontal: 30 }]}>
        {discover.isFetching || busy ? <ActivityIndicator color={colors.primary} accessibilityLabel="Loading" /> : <>
        <View style={[styles.emptyIcon, { backgroundColor: colors.accent }]}>
          <Feather name="compass" size={26} color={colors.primary} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No matching profiles right now</Text>
        <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>Skipped profiles return automatically. Try another location or age range to meet more people.</Text>
        <Pressable onPress={() => setFilterOpen(true)} style={[styles.primarySmall, { backgroundColor: colors.primary }]}>
          <Text style={styles.buttonWhite}>Adjust filters</Text>
        </Pressable>
        <Pressable
          disabled={busy || discover.isFetching}
          onPress={async () => {
            if (busy) return;
            await queryClient.invalidateQueries({ queryKey: getGetDiscoverProfilesQueryKey(discoverParams) });
            const result = await discover.refetch();
            if (!result.isError) refill(result.data);
          }}
          style={[styles.primarySmall, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
        >
          <Text style={[styles.buttonWhite, { color: colors.foreground }]}>Refresh profiles</Text>
        </Pressable>
        </>}
      </View>
    ) : null;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {emptyState}
      {profile && <View style={styles.deck}>
        {worldwide && <Text accessibilityRole="text" style={{ position: "absolute", top: topInset + 64, left: 20, right: 20, zIndex: 3, color: colors.discoverForeground, fontSize: 11, textAlign: "center", backgroundColor: colors.discoverControl, padding: 6, borderRadius: 10 }}>Not many people near you yet — showing members worldwide</Text>}
        <SwipeCard
          key={profile.id}
          profile={profile}
          token={token}
          onSwipe={(direction) => void swipe(direction)}
          onPressDetails={() => setDetailOpen(true)}
          onOpenProfile={() => {
            const followKey = getGetProfileFollowSummaryQueryKey(profile.id);
            const datingKey = getGetProfileDatingStateQueryKey(profile.id);
            void queryClient.prefetchQuery({
              queryKey: followKey,
              queryFn: ({ signal }) => getProfileFollowSummary(profile.id, { signal }),
              staleTime: 10 * 60_000,
              gcTime: 30 * 60_000,
            });
            void queryClient.prefetchQuery({
              queryKey: datingKey,
              queryFn: ({ signal }) => getProfileDatingState(profile.id, { signal }),
              staleTime: 10 * 60_000,
              gcTime: 30 * 60_000,
            });
            router.push({ pathname: "/profile/[profileId]", params: { profileId: profile.id } });
          }}
          topInset={topInset}
          actionBottom={actionBottom}
        />
        <View style={[styles.discoverHeader, { top: topInset + 8 }]}>
          <View style={styles.headerCopy}>
            <Text style={[styles.headerTitle, { color: colors.discoverForeground }]}>Meet someone new</Text>
            <Text style={[styles.headerLikes, { color: colors.discoverMuted }]}>
              {dailyLikeStatus.data?.remaining === 0
                ? "Daily like limit reached"
                : `${dailyLikeStatus.data?.remaining ?? "—"} likes left`}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              testID="open-member-search"
              accessibilityRole="button"
              accessibilityLabel="Search members"
              onPress={() => router.push("/search")}
              style={styles.searchHeaderButton}
            >
              <Feather name="search" size={19} color={colors.discoverForeground} />
            </Pressable>
            <Pressable
              testID="boost-profile"
              accessibilityRole="button"
              accessibilityLabel={boostLabel}
              disabled={!boostStatus.data?.available || activateBoost.isPending}
              onPress={() => void startBoost()}
              style={[styles.headerIcon, { backgroundColor: colors.discoverControl, borderColor: colors.discoverControlBorder, opacity: !boostStatus.data?.available || activateBoost.isPending ? 0.68 : 1 }]}
            >
              <Feather name="zap" size={16} color={colors.primary} />
            </Pressable>
            <Pressable
              testID="open-filters"
              accessibilityRole="button"
              accessibilityLabel="Open discovery filters"
              onPress={() => setFilterOpen(true)}
              style={[styles.headerIcon, { backgroundColor: colors.discoverControl, borderColor: colors.discoverControlBorder }]}
            >
              <Feather name="sliders" size={17} color={colors.discoverForeground} />
            </Pressable>
          </View>
        </View>
        {banner ? (
          <Pressable
            onPress={() => setBanner("")}
            style={[styles.matchBanner, { backgroundColor: colors.accent }]}
          >
            <Feather name="heart" size={15} color={colors.primary} />
            <Text style={[styles.bannerText, { color: colors.foreground }]}>{banner}</Text>
            <Feather name="x" size={15} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
        <View style={[styles.actions, { bottom: actionBottom }]}>
          <ActionButton label="Pass" icon="x" color={colors.discoverForeground} background={colors.discoverPass} onPress={() => void swipe("pass")} testID="pass-profile" disabled={busy || !!matchResult} />
          <Pressable
            testID="undo-pass"
            accessibilityRole="button"
            accessibilityLabel="Undo your most recent pass"
            disabled={!lastPassedProfileId || undoLastPass.isPending || busy || !!matchResult}
            onPress={() => void undoPass()}
            style={({ pressed }) => [styles.undoButton, { backgroundColor: colors.discoverControl, borderColor: colors.discoverControlBorder, opacity: lastPassedProfileId && !undoLastPass.isPending ? (pressed ? 0.72 : 1) : 0.42 }]}
          >
            <Feather name="rotate-ccw" size={18} color={colors.discoverForeground} />
          </Pressable>
          <View style={styles.superLikeAction}>
          <ActionButton label="Super like" icon="star" color={colors.discoverSuperLikeForeground} background={colors.discoverSuperLike} onPress={() => void swipe("super")} testID="super-like-profile" small disabled={superLikeStatus.data?.remaining === 0 || busy || !!matchResult} />
            <Text style={[styles.superLikeCount, { color: colors.discoverMuted }]}>{superLikeStatus.data?.remaining ?? "—"} left</Text>
          </View>
          <ActionButton label="Like" icon="heart" color={colors.discoverForeground} background={colors.discoverLike} onPress={() => void swipe("like")} testID="like-profile" disabled={dailyLikeStatus.data?.remaining === 0 || busy || !!matchResult} />
        </View>
        {busy ? (
          <View style={[styles.busyOverlay, { top: topInset + 66, backgroundColor: colors.discoverControl }]}>
            <ActivityIndicator color={colors.discoverForeground} />
          </View>
        ) : null}
      </View>}
      <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}>
        <View style={styles.modalScrim}>
          <View style={[styles.sheet, { backgroundColor: colors.card, maxHeight: "92%" }]}>
            <View style={styles.sheetHeading}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Discovery filters</Text>
              <Pressable onPress={() => setFilterOpen(false)}><Feather name="x" size={22} color={colors.foreground} /></Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 10, paddingBottom: 5 }}>
              <Text style={[styles.label, { color: colors.foreground }]}>Age range</Text>
              <View style={styles.ageRow}>
                <TextInput keyboardType="number-pad" value={String(ageMin)} onChangeText={(value) => setAgeMin(Math.max(18, Number(value) || 18))} style={[styles.filterInput, { borderColor: colors.border, color: colors.foreground }]} />
                <Text style={{ color: colors.mutedForeground }}>to</Text>
                <TextInput keyboardType="number-pad" value={String(ageMax)} onChangeText={(value) => setAgeMax(Math.max(ageMin, Number(value) || ageMin))} style={[styles.filterInput, { borderColor: colors.border, color: colors.foreground }]} />
              </View>
              <Text style={[styles.label, { color: colors.foreground }]}>Interested in</Text>
              <View style={styles.choiceRow}>
                {["Your preference", "Everyone", "Woman", "Man"].map((item) => {
                  const selected = item === "Your preference" ? gender === undefined : gender === item;
                  return (
                    <Pressable key={item} onPress={() => setGender(item === "Your preference" ? undefined : item)} style={[styles.choice, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.accent : "transparent" }]}>
                      <Text style={{ color: selected ? colors.primary : colors.foreground, fontWeight: "600" }}>{item}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {discoverySettings.data?.travelMode ? (
                <Text style={{ color: colors.primary, fontSize: 12 }}>
                  Travel Mode is active. Turn it off in Settings to search another country.
                </Text>
              ) : null}
              <Pressable
                testID="use-current-discovery-location"
                accessibilityRole="button"
                accessibilityLabel="Use current location to choose a nearby city"
                disabled={Boolean(discoverySettings.data?.travelMode) || locating}
                onPress={() => void useCurrentLocation()}
                style={[
                  styles.filterSuggestion,
                  {
                    borderColor: colors.primary,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    opacity: discoverySettings.data?.travelMode || locating ? 0.55 : 1,
                  },
                ]}
              >
                {locating ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Feather name="map-pin" size={16} color={colors.primary} />
                )}
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>
                  {locating ? "Finding nearest city…" : "Use current location"}
                </Text>
              </Pressable>
              <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
                Uses GPS once to choose a supported city. Coordinates are not saved.
              </Text>
              {locationMessage ? (
                <Text
                  accessibilityRole={canOpenLocationSettings ? "alert" : "text"}
                  style={{
                    color: locationMessage.startsWith("Using ") ? colors.primary : colors.destructive,
                    fontSize: 12,
                  }}
                >
                  {locationMessage}
                </Text>
              ) : null}
              {canOpenLocationSettings && Platform.OS !== "web" ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void Linking.openSettings().catch(() => {
                      setLocationMessage("Could not open Settings. Choose a location manually.");
                      setCanOpenLocationSettings(false);
                    });
                  }}
                >
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>
                    Open Settings
                  </Text>
                </Pressable>
              ) : null}
              <Text style={[styles.label, { color: colors.foreground }]}>Country</Text>
              <TextInput
                value={countrySearch}
                onChangeText={(value) => {
                  setCountrySearch(value);
                  setLocationMessage("");
                  if (value !== selectedCountry?.name) {
                    setSelectedCountry(null);
                    setSelectedState(null);
                    setStateSearch("");
                    setCity("");
                    setCitySearch("");
                  }
                }}
                editable={!discoverySettings.data?.travelMode}
                placeholder="Search country"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.filterInput, styles.cityInput, { borderColor: colors.border, color: colors.foreground }]}
              />
              {selectedCountry ? (
                <Pressable onPress={() => { setSelectedCountry(null); setCountrySearch(""); setSelectedState(null); setStateSearch(""); setCity(""); setCitySearch(""); setLocationMessage(""); }}>
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>Clear country · default feed</Text>
                </Pressable>
              ) : null}
              {countrySuggestions.map((item) => (
                <Pressable key={item.code} onPress={() => { setSelectedCountry(item); setCountrySearch(item.name); setSelectedState(null); setStateSearch(""); setCity(""); setCitySearch(""); setLocationMessage(""); }} style={[styles.filterSuggestion, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.foreground }}>{item.name}</Text>
                </Pressable>
              ))}
              <Text style={[styles.label, { color: colors.foreground }]}>State / region</Text>
              <TextInput
                value={stateSearch}
                onChangeText={(value) => {
                  setStateSearch(value);
                  setLocationMessage("");
                  if (value !== selectedState?.name) {
                    setSelectedState(null);
                    setCity("");
                    setCitySearch("");
                  }
                }}
                editable={Boolean(selectedCountry) && !discoverySettings.data?.travelMode}
                placeholder={selectedCountry ? "Any state or region" : "Select a country first"}
                placeholderTextColor={colors.mutedForeground}
                style={[styles.filterInput, styles.cityInput, { borderColor: colors.border, color: colors.foreground, opacity: selectedCountry ? 1 : 0.5 }]}
              />
              {stateSuggestions.map((item) => (
                <Pressable key={item.code} onPress={() => { setSelectedState(item); setStateSearch(item.name); setCity(""); setCitySearch(""); setLocationMessage(""); }} style={[styles.filterSuggestion, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.foreground }}>{item.name}</Text>
                </Pressable>
              ))}
              <Text style={[styles.label, { color: colors.foreground }]}>City</Text>
              <TextInput
                value={citySearch}
                onChangeText={(value) => { setCitySearch(value); setLocationMessage(""); if (value !== city) setCity(""); }}
                editable={Boolean(selectedCountry) && !discoverySettings.data?.travelMode}
                placeholder={selectedCountry ? "Any city" : "Select a country first"}
                placeholderTextColor={colors.mutedForeground}
                style={[styles.filterInput, styles.cityInput, { borderColor: colors.border, color: colors.foreground, opacity: selectedCountry ? 1 : 0.5 }]}
              />
              <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
                {selectedCountry ? `Choose a city suggestion, or leave blank for ${selectedState ? selectedState.name : "the whole country"}.` : "Choose a country to search its cities."}
              </Text>
              {citySuggestions.map((name) => (
                <Pressable key={name} onPress={() => { setCity(name); setCitySearch(name); }} style={[styles.filterSuggestion, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.foreground }}>{name}</Text>
                </Pressable>
              ))}
              {citySearch.trim().length >= 2 && selectedCountry && !city && citySuggestions.length === 0 ? (
                <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>No city match. Select a suggestion or clear the field for any city.</Text>
              ) : null}
              <Pressable
                disabled={Boolean(countrySearch.trim() && !selectedCountry) || Boolean(stateSearch.trim() && !selectedState) || Boolean(citySearch.trim() && !city)}
                onPress={() => { setFilterOpen(false); }}
                style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: (countrySearch.trim() && !selectedCountry) || (stateSearch.trim() && !selectedState) || (citySearch.trim() && !city) ? 0.5 : 1 }]}
              >
                <Text style={styles.buttonWhite}>Show profiles</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={detailOpen} transparent animationType="slide" onRequestClose={() => setDetailOpen(false)}>
        <View style={styles.modalScrim}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={styles.sheetHeading}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Profile options</Text>
              <Pressable onPress={() => setDetailOpen(false)}><Feather name="x" size={22} color={colors.foreground} /></Pressable>
            </View>
            <Text style={[styles.modalBio, { color: colors.mutedForeground }]}>Manage this profile without opening its details.</Text>
            <View style={styles.safetyRow}>
              <Pressable onPress={() => Alert.alert("Report profile", "Choose a reason.", [
                { text: "Spam", onPress: () => void report("spam") },
                { text: "Fake profile", onPress: () => void report("fake") },
                { text: "Inappropriate content", onPress: () => void report("inappropriate") },
                { text: "Harassment", onPress: () => void report("harassment") },
                { text: "Other", onPress: () => void report("other") },
                { text: "Cancel", style: "cancel" },
              ])}><Text style={[styles.safetyText, { color: colors.mutedForeground }]}>Report</Text></Pressable>
              <Pressable onPress={() => Alert.alert("Block this profile?", "You will no longer see each other or be able to chat.", [
                { text: "Cancel", style: "cancel" },
                { text: "Block", style: "destructive", onPress: () => void block() },
              ])}><Text style={[styles.safetyText, { color: colors.destructive }]}>Block</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <MatchCelebration
        visible={!!matchResult}
        self={myProfile.data ?? null}
        other={matchResult?.profile ?? null}
        canMessage={Boolean(matchResult?.matchId)}
        onMessage={() => {
          const matchId = matchResult?.matchId;
          if (!matchId) return;
          setMatchResult(null);
          router.push({ pathname: "/chat/[matchId]", params: { matchId, returnTo: "discover" } });
        }}
        onKeepSwiping={() => setMatchResult(null)}
      />
    </View>
  );
}

function ActionButton({
  label,
  icon,
  color,
  background,
  onPress,
  testID,
  small,
  disabled,
}: {
  label: string;
  icon: "x" | "star" | "heart";
  color: string;
  background: string;
  onPress: () => void;
  testID: string;
  small?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable testID={testID} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.actionWrap, { transform: [{ scale: pressed ? 0.93 : 1 }], opacity: disabled ? 0.42 : 1 }]}>
      <View style={[styles.actionCircle, small && styles.smallAction, { backgroundColor: background }]}>
        <Feather name={icon} size={small ? 22 : 25} color={color} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 0, paddingBottom: 0 },
  discoverHeader: { position: "absolute", zIndex: 7, left: 18, right: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  headerCopy: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: "800", letterSpacing: -0.25 },
  headerLikes: { fontSize: 11, fontWeight: "600", marginTop: 3 },
  headerActions: { flexDirection: "row", gap: 8 },
  searchHeaderButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerIcon: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  superLikedBadge: { position: "absolute", top: 136, left: 20, zIndex: 3, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(20,17,20,0.76)", borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  superLikedText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  undoButton: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  deck: { flex: 1, position: "relative", minHeight: 250 },
  card: { flex: 1, borderRadius: 0, overflow: "hidden" },
  profileScroll: { flex: 1 },
  photoHero: { width: "100%", aspectRatio: 4 / 5, overflow: "hidden" },
  heroCopy: { position: "absolute", left: 22, right: 22, bottom: 24 },
  profileOptions: { position: "absolute", right: 18, width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center", zIndex: 4 },
  profileDetails: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 24 },
  sectionLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" },
  sectionGap: { marginTop: 22, marginBottom: 10 },
  profileBio: { fontSize: 14, lineHeight: 22, marginTop: 9 },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 11 },
  extraPhoto: { width: "48%", aspectRatio: 0.82, borderRadius: 14 },
  locationLine: { flexDirection: "row", gap: 6, alignItems: "center", marginTop: 9 },
  location: { fontSize: 13, fontWeight: "500" },
  nameLine: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  name: { fontSize: 35, fontWeight: "800", letterSpacing: -1.1, flexShrink: 1 },
  age: { fontSize: 23, fontWeight: "500" },
  interests: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 12 },
  soundButton: { position: "absolute", right: 20, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", zIndex: 3 },
  actions: { position: "absolute", left: 0, right: 0, zIndex: 4, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  superLikeAction: { alignItems: "center", justifyContent: "center" },
  superLikeCount: { fontSize: 10, fontWeight: "700", marginTop: -2 },
  actionWrap: { width: 68, height: 68, alignItems: "center", justifyContent: "center" },
  actionCircle: { width: 62, height: 62, borderRadius: 31, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.32, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 8 },
  smallAction: { width: 54, height: 54, borderRadius: 27 },
  matchBanner: { position: "absolute", top: 96, left: 16, right: 16, zIndex: 5, borderRadius: 14, minHeight: 40, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  bannerText: { flex: 1, fontSize: 12, fontWeight: "600" },
  busyOverlay: { position: "absolute", left: 18, width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", zIndex: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 13 },
  emptyIcon: { width: 66, height: 66, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 5 },
  emptyTitle: { fontSize: 21, fontWeight: "700", textAlign: "center" },
  emptyCopy: { fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 2, marginBottom: 7 },
  primarySmall: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, marginTop: 7 },
  buttonWhite: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  modalScrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.64)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22, paddingBottom: 34, gap: 10 },
  sheetHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  sheetTitle: { fontSize: 20, fontWeight: "700" },
  label: { fontSize: 13, fontWeight: "700", marginTop: 10, marginBottom: 4 },
  ageRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  filterInput: { minWidth: 70, height: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, textAlign: "center", fontSize: 15 },
  cityInput: { textAlign: "left", width: "100%" },
  filterSuggestion: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  choiceRow: { flexDirection: "row", gap: 8 },
  choice: { paddingVertical: 10, paddingHorizontal: 13, borderWidth: 1, borderRadius: 14 },
  primaryButton: { height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 16 },
  modalCity: { fontSize: 13, marginTop: -5 },
  modalBio: { fontSize: 15, lineHeight: 23, marginTop: 14 },
  interestTag: { overflow: "hidden", borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7, fontSize: 12, fontWeight: "600" },
  safetyRow: { flexDirection: "row", gap: 24, marginTop: 22, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(120,100,110,0.25)" },
  safetyText: { fontSize: 13, fontWeight: "700" },
});
