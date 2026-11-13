import {
  getGetDiscoverProfilesQueryKey,
  getGetMatchesQueryKey,
  useBlockProfile,
  useCreateReaction,
  useGetDiscoverProfiles,
  useReportProfile,
  type Profile,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { VideoView } from "expo-video";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { profileImageSource } from "@/lib/media";
import { useVideoPreloadQueue } from "@/hooks/useVideoPreloadQueue";

type SwipeDirection = "pass" | "like" | "super";

function SwipeCard({
  profile,
  player,
  token,
  onSwipe,
  onPressDetails,
}: {
  profile: Profile;
  player: ReturnType<typeof useVideoPreloadQueue>["player"];
  token: string | null;
  onSwipe: (direction: SwipeDirection) => void;
  onPressDetails: () => void;
}) {
  const colors = useColors();
  const { width, height } = useWindowDimensions();
  const pan = useRef(new Animated.ValueXY()).current;
  const [firstFrame, setFirstFrame] = useState(false);
  const [muted, setMuted] = useState(true);
  const swipeRef = useRef(onSwipe);
  swipeRef.current = onSwipe;
  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 8 || Math.abs(gesture.dy) > 8,
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

  return (
    <Animated.View {...responder.panHandlers} style={[styles.card, cardTransform]}>
      {poster ? <Image source={poster} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      {player && Platform.OS !== "web" ? (
        <VideoView
          player={player}
          style={[StyleSheet.absoluteFill, { opacity: firstFrame ? 1 : 0 }]}
          contentFit="cover"
          nativeControls={false}
          onFirstFrameRender={() => setFirstFrame(true)}
        />
      ) : null}
      <LinearGradient
        colors={["transparent", "rgba(9,7,9,0.18)", "rgba(9,7,9,0.95)"]}
        locations={[0.25, 0.56, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {profile.isDemo ? (
        <View style={styles.demoBadge}>
          <Feather name="eye" size={12} color="#ffffff" />
          <Text style={styles.demoText}>SAMPLE PROFILE</Text>
        </View>
      ) : null}
      {profile.videoUrl ? (
        <Pressable
          accessibilityLabel={muted ? "Turn video sound on" : "Mute video"}
          testID="video-sound-toggle"
          onPress={() => {
            const next = !muted;
            setMuted(next);
            if (player) player.muted = next;
          }}
          style={styles.soundButton}
        >
          <Feather name={muted ? "volume-x" : "volume-2"} size={17} color="#ffffff" />
        </Pressable>
      ) : null}
      <Pressable onPress={onPressDetails} style={styles.cardCopy}>
        <View style={styles.locationLine}>
          <Feather name="map-pin" size={13} color="#ffffff" />
          <Text style={styles.location}>{profile.city || "Nearby"}</Text>
        </View>
        <View style={styles.nameLine}>
          <Text style={styles.name}>{profile.name}, {profile.age}</Text>
          <Feather name="chevron-up" size={20} color="#ffffff" />
        </View>
        <Text numberOfLines={2} style={styles.bio}>{profile.bio}</Text>
        <View style={styles.interests}>
          {profile.interests.slice(0, 3).map((interest) => (
            <Text key={interest} style={styles.interest}>{interest}</Text>
          ))}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function DiscoverScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const reaction = useCreateReaction();
  const reportProfile = useReportProfile();
  const blockProfile = useBlockProfile();
  const [ageMin, setAgeMin] = useState(22);
  const [ageMax, setAgeMax] = useState(35);
  const [gender, setGender] = useState("Everyone");
  const [city, setCity] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [banner, setBanner] = useState("");
  const [busy, setBusy] = useState(false);
  const discoverParams = useMemo(
    () => ({ ageMin, ageMax, gender, ...(city.trim() ? { city: city.trim() } : {}) }),
    [ageMin, ageMax, city, gender],
  );
  const discover = useGetDiscoverProfiles(discoverParams, {
    query: { refetchInterval: 20_000 },
  });
  const profiles = discover.data ?? [];
  const profile = profiles[index];
  const { player, token } = useVideoPreloadQueue(profiles, index);

  async function swipe(direction: SwipeDirection) {
    if (!profile || busy) return;
    setBusy(true);
    setBanner("");
    void Haptics.impactAsync(
      direction === "pass" ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium,
    );
    setIndex((current) => current + 1);
    try {
      const result = await reaction.mutateAsync({
        data: { toUserId: profile.id, type: direction },
      });
      await queryClient.invalidateQueries({ queryKey: getGetDiscoverProfilesQueryKey(discoverParams) });
      if (result.matched && result.matchId) {
        await queryClient.invalidateQueries({ queryKey: getGetMatchesQueryKey() });
        setBanner(`You and ${profile.name} matched.`);
        if (profile.isDemo) {
          Alert.alert("It’s a match", `You and ${profile.name} matched. Open Matches to start chatting.`);
        }
        setTimeout(() => setBanner(""), 3500);
      }
    } catch {
      setBanner("That action did not save. Try again.");
      setIndex((current) => Math.max(0, current - 1));
    } finally {
      setBusy(false);
    }
  }

  async function report(reason: "fake" | "harassment" | "unsafe") {
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
      setIndex((current) => Math.max(0, current - 1));
    } catch {
      Alert.alert("Could not block profile", "Please try again.");
    }
  }

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
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, Platform.OS === "web" ? 67 : 8) }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.brand, { color: colors.foreground }]}>vibe<Text style={{ color: colors.primary }}>swipe</Text></Text>
          <Text style={[styles.headerHint, { color: colors.mutedForeground }]}>Discover your next connection</Text>
        </View>
        <Pressable testID="open-filters" accessibilityLabel="Open discovery filters" onPress={() => setFilterOpen(true)} style={[styles.filterButton, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Feather name="sliders" size={18} color={colors.foreground} />
        </Pressable>
      </View>
      <View style={styles.deck}>
        {profiles[index + 1] ? (
          <View style={[styles.backCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Image source={profileImageSource(profiles[index + 1].photos[0], token)} style={StyleSheet.absoluteFill} resizeMode="cover" />
          </View>
        ) : null}
        <SwipeCard
          key={profile.id}
          profile={profile}
          player={player}
          token={token}
          onSwipe={(direction) => void swipe(direction)}
          onPressDetails={() => setDetailOpen(true)}
        />
      </View>
      {banner ? (
        <Pressable onPress={() => setBanner("")} style={[styles.matchBanner, { backgroundColor: colors.accent }]}>
          <Feather name="heart" size={15} color={colors.primary} />
          <Text style={[styles.bannerText, { color: colors.foreground }]}>{banner}</Text>
          <Feather name="x" size={15} color={colors.mutedForeground} />
        </Pressable>
      ) : null}
      <View style={styles.actions}>
        <ActionButton label="Pass" icon="x" color={colors.foreground} background={colors.card} onPress={() => void swipe("pass")} testID="pass-profile" />
        <ActionButton label="Super like" icon="star" color="#dfb44c" background={colors.card} onPress={() => void swipe("super")} testID="super-like-profile" small />
        <ActionButton label="Like" icon="heart" color="#ffffff" background={colors.primary} onPress={() => void swipe("like")} testID="like-profile" />
      </View>
      {busy ? <View style={styles.busyOverlay}><ActivityIndicator color={colors.primary} /></View> : null}

      <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}>
        <View style={styles.modalScrim}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={styles.sheetHeading}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Discovery filters</Text>
              <Pressable onPress={() => setFilterOpen(false)}><Feather name="x" size={22} color={colors.foreground} /></Pressable>
            </View>
            <Text style={[styles.label, { color: colors.foreground }]}>Age range</Text>
            <View style={styles.ageRow}>
              <TextInput keyboardType="number-pad" value={String(ageMin)} onChangeText={(value) => setAgeMin(Math.max(18, Number(value) || 18))} style={[styles.filterInput, { borderColor: colors.border, color: colors.foreground }]} />
              <Text style={{ color: colors.mutedForeground }}>to</Text>
              <TextInput keyboardType="number-pad" value={String(ageMax)} onChangeText={(value) => setAgeMax(Math.max(ageMin, Number(value) || ageMin))} style={[styles.filterInput, { borderColor: colors.border, color: colors.foreground }]} />
            </View>
            <Text style={[styles.label, { color: colors.foreground }]}>Interested in</Text>
            <View style={styles.choiceRow}>
              {["Everyone", "Woman", "Man"].map((item) => (
                <Pressable key={item} onPress={() => setGender(item)} style={[styles.choice, { borderColor: gender === item ? colors.primary : colors.border, backgroundColor: gender === item ? colors.accent : "transparent" }]}>
                  <Text style={{ color: gender === item ? colors.primary : colors.foreground, fontWeight: "600" }}>{item}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={[styles.label, { color: colors.foreground }]}>City</Text>
            <TextInput value={city} onChangeText={setCity} placeholder="Any city" placeholderTextColor={colors.mutedForeground} style={[styles.filterInput, styles.cityInput, { borderColor: colors.border, color: colors.foreground }]} />
            <Pressable onPress={() => { setIndex(0); setFilterOpen(false); }} style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
              <Text style={styles.buttonWhite}>Show profiles</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={detailOpen} transparent animationType="slide" onRequestClose={() => setDetailOpen(false)}>
        <View style={styles.modalScrim}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={styles.sheetHeading}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{profile.name}, {profile.age}</Text>
              <Pressable onPress={() => setDetailOpen(false)}><Feather name="x" size={22} color={colors.foreground} /></Pressable>
            </View>
            <Text style={[styles.modalCity, { color: colors.mutedForeground }]}>{profile.city} · {profile.gender}</Text>
            <Text style={[styles.modalBio, { color: colors.foreground }]}>{profile.bio}</Text>
            <View style={styles.interests}>
              {profile.interests.map((interest) => <Text key={interest} style={[styles.interestTag, { backgroundColor: colors.accent, color: colors.accentForeground }]}>{interest}</Text>)}
            </View>
            <View style={styles.safetyRow}>
              <Pressable onPress={() => Alert.alert("Report profile", "Choose a reason.", [
                { text: "Fake profile", onPress: () => void report("fake") },
                { text: "Harassment", onPress: () => void report("harassment") },
                { text: "Unsafe behavior", onPress: () => void report("unsafe") },
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
}: {
  label: string;
  icon: "x" | "star" | "heart";
  color: string;
  background: string;
  onPress: () => void;
  testID: string;
  small?: boolean;
}) {
  return (
    <Pressable testID={testID} accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.actionWrap, { transform: [{ scale: pressed ? 0.93 : 1 }] }]}>
      <View style={[styles.actionCircle, small && styles.smallAction, { backgroundColor: background }]}>
        <Feather name={icon} size={small ? 19 : 23} color={color} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 18, paddingBottom: Platform.OS === "web" ? 98 : 86 },
  header: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  brand: { fontSize: 22, fontWeight: "800", letterSpacing: -0.7 },
  headerHint: { fontSize: 11, marginTop: 1 },
  filterButton: { width: 42, height: 42, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  deck: { flex: 1, position: "relative", minHeight: 250 },
  backCard: { position: "absolute", top: 9, left: 12, right: 12, bottom: -6, borderRadius: 28, overflow: "hidden", opacity: 0.52, transform: [{ scale: 0.97 }] },
  card: { flex: 1, borderRadius: 28, overflow: "hidden", backgroundColor: "#181316" },
  cardCopy: { position: "absolute", left: 22, right: 22, bottom: 20 },
  locationLine: { flexDirection: "row", gap: 6, alignItems: "center", marginBottom: 4 },
  location: { color: "#ffffff", fontSize: 12, fontWeight: "500" },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 5 },
  name: { color: "#ffffff", fontSize: 31, fontWeight: "700", letterSpacing: -0.8 },
  bio: { color: "rgba(255,255,255,0.88)", fontSize: 14, lineHeight: 20, marginTop: 4, maxWidth: 310 },
  interests: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 12 },
  interest: { overflow: "hidden", borderRadius: 20, color: "#ffffff", backgroundColor: "rgba(255,255,255,0.18)", paddingHorizontal: 10, paddingVertical: 6, fontSize: 11, fontWeight: "600" },
  demoBadge: { position: "absolute", top: 17, left: 17, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 10, paddingVertical: 7 },
  demoText: { color: "#ffffff", fontSize: 9, fontWeight: "700", letterSpacing: 0.8 },
  soundButton: { position: "absolute", top: 16, right: 16, width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 28, paddingTop: 14, paddingBottom: 8 },
  actionWrap: { alignItems: "center", gap: 6 },
  actionCircle: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 10, elevation: 4 },
  smallAction: { width: 46, height: 46, borderRadius: 23 },
  actionLabel: { color: "#b6a8af", fontSize: 10, fontWeight: "600" },
  matchBanner: { marginHorizontal: 6, marginTop: 8, borderRadius: 14, minHeight: 38, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  bannerText: { flex: 1, fontSize: 12, fontWeight: "600" },
  busyOverlay: { position: "absolute", right: 14, top: 70, width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
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
  choiceRow: { flexDirection: "row", gap: 8 },
  choice: { paddingVertical: 10, paddingHorizontal: 13, borderWidth: 1, borderRadius: 14 },
  primaryButton: { height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 16 },
  modalCity: { fontSize: 13, marginTop: -5 },
  modalBio: { fontSize: 15, lineHeight: 23, marginTop: 14 },
  interestTag: { overflow: "hidden", borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7, fontSize: 12, fontWeight: "600" },
  safetyRow: { flexDirection: "row", gap: 24, marginTop: 22, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(120,100,110,0.25)" },
  safetyText: { fontSize: 13, fontWeight: "700" },
});
