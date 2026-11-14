import {
  getGetBoostStatusQueryKey,
  getGetDailyLikeStatusQueryKey,
  getGetDiscoverProfilesQueryKey,
  getGetMatchesQueryKey,
  getGetNotificationsQueryKey,
  getGetSuperLikeStatusQueryKey,
  getGetVibeSwipeSettingsQueryKey,
  useBlockProfile,
  useCreateReaction,
  useActivateBoost,
  useGetBoostStatus,
  useGetDailyLikeStatus,
  useGetDiscoverProfiles,
  useGetSuperLikeStatus,
  useGetVibeSwipeSettings,
  useRecordProfileView,
  useReportProfile,
  useUndoLastPass,
  type Profile,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { City, Country } from "country-state-city";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
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
import { profileImageSource } from "@/lib/media";

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
  const poster = profileImageSource(profile.photos[0], token);
  const heroHeight = Math.max(340, Math.min(560, height - topInset - actionBottom - 170));

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
        <View style={[styles.photoHero, { height: heroHeight, backgroundColor: colors.card }]}>
          {poster ? <Image source={poster} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
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
  const [city, setCity] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [banner, setBanner] = useState("");
  const [busy, setBusy] = useState(false);
  const [matchResult, setMatchResult] = useState<{ name: string; matchId: string | null } | null>(null);
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
  const citiesInCountry = useMemo(() => {
    if (!selectedCountry) return [];
    return [...new Set((City.getCitiesOfCountry(selectedCountry.code) ?? []).map(({ name }) => name))]
      .sort((a, b) => a.localeCompare(b));
  }, [selectedCountry]);
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
    () => ({ ageMin, ageMax, ...(gender ? { gender } : {}), ...(selectedCountry ? { country: selectedCountry.name } : {}), ...(city.trim() ? { city: city.trim() } : {}) }),
    [ageMin, ageMax, city, gender, selectedCountry],
  );
  const discover = useGetDiscoverProfiles(discoverParams, {
    query: { refetchOnWindowFocus: false },
  });
  const profiles = discover.data ?? [];
  const profile = profiles[index];
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
            setMatchResult({ name: profile.name, matchId: result.matchId ?? null });
          }
        }, 1500);
      }
    } catch {
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
      await queryClient.invalidateQueries({ queryKey: getGetDiscoverProfilesQueryKey(discoverParams) });
      setDetailOpen(false);
      setIndex((current) => current);
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
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Finding people nearby</Text>
      </View>
    );
  }
  if (discover.isError) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="wifi-off" size={26} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Can’t load discovery</Text>
        <Pressable onPress={() => void discover.refetch()} style={[styles.primarySmall, { backgroundColor: colors.primary }]}>
          <Text style={styles.buttonWhite}>Try again</Text>
        </Pressable>
      </View>
    );
  }
  if (!profile) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingHorizontal: 30 }]}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.accent }]}>
          <Feather name="compass" size={26} color={colors.primary} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>You’re all caught up</Text>
        <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>
          Try widening your age range or changing your filters.
        </Text>
        <Pressable onPress={() => setFilterOpen(true)} style={[styles.primarySmall, { backgroundColor: colors.primary }]}>
          <Text style={styles.buttonWhite}>Adjust filters</Text>
        </Pressable>
        <Pressable
          onPress={async () => {
            setIndex(0);
            await queryClient.invalidateQueries({ queryKey: getGetDiscoverProfilesQueryKey(discoverParams) });
            await discover.refetch();
          }}
          style={[styles.primarySmall, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
        >
          <Text style={[styles.buttonWhite, { color: colors.foreground }]}>Refresh profiles</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.discoverBackground }]}>
      <View style={styles.deck}>
        <SwipeCard
          key={profile.id}
          profile={profile}
          token={token}
          onSwipe={(direction) => void swipe(direction)}
          onPressDetails={() => setDetailOpen(true)}
          onOpenProfile={() => router.push({ pathname: "/profile/[profileId]", params: { profileId: profile.id } })}
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
              testID="boost-profile"
              accessibilityRole="button"
              accessibilityLabel={boostLabel}
              disabled={!boostStatus.data?.available || activateBoost.isPending}
              onPress={() => void startBoost()}
              style={[styles.headerIcon, { backgroundColor: colors.discoverControl, borderColor: colors.discoverControlBorder, opacity: !boostStatus.data?.available || activateBoost.isPending ? 0.68 : 1 }]}
            >
              <Feather name="zap" size={16} color="#FFD166" />
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
      </View>

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
              <Text style={[styles.label, { color: colors.foreground }]}>Country</Text>
              <TextInput
                value={countrySearch}
                onChangeText={(value) => {
                  setCountrySearch(value);
                  if (value !== selectedCountry?.name) {
                    setSelectedCountry(null);
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
                <Pressable onPress={() => { setSelectedCountry(null); setCountrySearch(""); setCity(""); setCitySearch(""); }}>
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>Clear country · use home location</Text>
                </Pressable>
              ) : null}
              {countrySuggestions.map((item) => (
                <Pressable key={item.code} onPress={() => { setSelectedCountry(item); setCountrySearch(item.name); setCity(""); setCitySearch(""); }} style={[styles.filterSuggestion, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.foreground }}>{item.name}</Text>
                </Pressable>
              ))}
              <Text style={[styles.label, { color: colors.foreground }]}>City</Text>
              <TextInput
                value={citySearch}
                onChangeText={(value) => { setCitySearch(value); if (value !== city) setCity(""); }}
                editable={Boolean(selectedCountry) && !discoverySettings.data?.travelMode}
                placeholder={selectedCountry ? "Any city" : "Select a country first"}
                placeholderTextColor={colors.mutedForeground}
                style={[styles.filterInput, styles.cityInput, { borderColor: colors.border, color: colors.foreground, opacity: selectedCountry ? 1 : 0.5 }]}
              />
              <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
                {selectedCountry ? "Choose a city suggestion, or leave blank for the whole country." : "Choose a country to search its cities."}
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
                disabled={Boolean(countrySearch.trim() && !selectedCountry) || Boolean(citySearch.trim() && !city)}
                onPress={() => { setIndex(0); setFilterOpen(false); }}
                style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: (countrySearch.trim() && !selectedCountry) || (citySearch.trim() && !city) ? 0.5 : 1 }]}
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
      <Modal visible={!!matchResult} transparent animationType="fade" onRequestClose={() => setMatchResult(null)}>
        <View style={styles.matchModalScrim}>
          <View style={[styles.matchModalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.matchModalIcon, { backgroundColor: colors.accent }]}>
              <Feather name="heart" size={25} color={colors.primary} />
            </View>
            <Text style={[styles.matchModalTitle, { color: colors.foreground }]}>It’s a match!</Text>
            <Text style={[styles.matchModalCopy, { color: colors.mutedForeground }]}>
              You and {matchResult?.name} liked each other. You can start chatting now.
            </Text>
            <Pressable
              testID="discover-start-match-chat"
              accessibilityRole="button"
              onPress={() => {
                const matchId = matchResult?.matchId;
                setMatchResult(null);
                if (matchId) router.push({ pathname: "/chat/[matchId]", params: { matchId } });
                else router.push("/(tabs)/matches");
              }}
              style={[styles.matchModalPrimary, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.matchModalPrimaryText, { color: colors.accentForeground }]}>
                {matchResult?.matchId ? "Start chatting" : "View matches"}
              </Text>
            </Pressable>
            <Pressable
              testID="discover-continue-after-match"
              accessibilityRole="button"
              onPress={() => setMatchResult(null)}
              style={[styles.matchModalSecondary, { borderColor: colors.border }]}
            >
              <Text style={[styles.matchModalSecondaryText, { color: colors.foreground }]}>Keep discovering</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  headerIcon: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  superLikedBadge: { position: "absolute", top: 136, left: 20, zIndex: 3, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(20,17,20,0.76)", borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  superLikedText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  undoButton: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  deck: { flex: 1, position: "relative", minHeight: 250 },
  card: { flex: 1, borderRadius: 0, overflow: "hidden" },
  profileScroll: { flex: 1 },
  photoHero: { width: "100%", overflow: "hidden" },
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
  matchModalScrim: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.72)", padding: 22 },
  matchModalCard: { width: "100%", maxWidth: 380, alignItems: "center", borderWidth: 1, borderRadius: 26, padding: 24 },
  matchModalIcon: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center" },
  matchModalTitle: { fontSize: 28, fontWeight: "800", marginTop: 16 },
  matchModalCopy: { fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 8 },
  matchModalPrimary: { width: "100%", minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 22 },
  matchModalPrimaryText: { fontSize: 14, fontWeight: "800" },
  matchModalSecondary: { width: "100%", minHeight: 46, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 9 },
  matchModalSecondaryText: { fontSize: 13, fontWeight: "700" },
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
