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
  topInset,
  actionBottom,
}: {
  profile: Profile;
  player: ReturnType<typeof useVideoPreloadQueue>["player"];
  token: string | null;
  onSwipe: (direction: SwipeDirection) => void;
  onPressDetails: () => void;
  topInset: number;
  actionBottom: number;
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
    <Animated.View
      {...responder.panHandlers}
      style={[styles.card, { backgroundColor: colors.discoverBackground }, cardTransform]}
    >
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
        colors={[colors.discoverGradientTop, colors.discoverGradientMiddle, colors.discoverGradientBottom]}
        locations={[0.22, 0.54, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {profile.videoUrl ? (
        <Pressable
          accessibilityLabel={muted ? "Turn video sound on" : "Mute video"}
          testID="video-sound-toggle"
          onPress={() => {
            const next = !muted;
            setMuted(next);
            if (player) player.muted = next;
          }}
          style={[styles.soundButton, { top: topInset + 58, backgroundColor: colors.discoverControl }]}
        >
          <Feather name={muted ? "volume-x" : "volume-2"} size={17} color={colors.discoverForeground} />
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${profile.name}'s profile`}
        onPress={onPressDetails}
        style={[styles.cardCopy, { bottom: actionBottom + 88 }]}
      >
        <View style={styles.nameLine}>
          <Text numberOfLines={1} style={[styles.name, { color: colors.discoverForeground }]}>{profile.name}</Text>
          <Text style={[styles.age, { color: colors.discoverMuted }]}>{profile.age}</Text>
        </View>
        <View style={styles.locationLine}>
          <Feather name="map-pin" size={13} color={colors.discoverMuted} />
          <Text style={[styles.location, { color: colors.discoverMuted }]}>{profile.city || "Nearby"}</Text>
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
  const topInset = Math.max(insets.top, Platform.OS === "web" ? 67 : 12);
  const actionBottom = Platform.OS === "web" ? 100 : Math.max(insets.bottom + 62, 82);
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
    <View style={[styles.screen, { backgroundColor: colors.discoverBackground }]}>
      <View style={styles.deck}>
        <SwipeCard
          key={profile.id}
          profile={profile}
          player={player}
          token={token}
          onSwipe={(direction) => void swipe(direction)}
          onPressDetails={() => setDetailOpen(true)}
          topInset={topInset}
          actionBottom={actionBottom}
        />
        <Pressable
          testID="open-filters"
          accessibilityRole="button"
          accessibilityLabel="Open discovery filters"
          onPress={() => setFilterOpen(true)}
          style={[
            styles.filterButton,
            { top: topInset + 8, backgroundColor: colors.discoverControl, borderColor: colors.discoverControlBorder },
          ]}
        >
          <Feather name="sliders" size={18} color={colors.discoverForeground} />
        </Pressable>
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
          <ActionButton label="Pass" icon="x" color={colors.discoverForeground} background={colors.discoverPass} onPress={() => void swipe("pass")} testID="pass-profile" />
          <ActionButton label="Super like" icon="star" color={colors.discoverSuperLikeForeground} background={colors.discoverSuperLike} onPress={() => void swipe("super")} testID="super-like-profile" small />
          <ActionButton label="Like" icon="heart" color={colors.discoverForeground} background={colors.discoverLike} onPress={() => void swipe("like")} testID="like-profile" />
        </View>
        {busy ? (
          <View style={[styles.busyOverlay, { top: topInset + 66, backgroundColor: colors.discoverControl }]}>
            <ActivityIndicator color={colors.discoverForeground} />
          </View>
        ) : null}
      </View>

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
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.actionWrap, { transform: [{ scale: pressed ? 0.93 : 1 }] }]}>
      <View style={[styles.actionCircle, small && styles.smallAction, { backgroundColor: background }]}>
        <Feather name={icon} size={small ? 22 : 25} color={color} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 0, paddingBottom: 0 },
  filterButton: { position: "absolute", zIndex: 5, right: 18, width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  deck: { flex: 1, position: "relative", minHeight: 250 },
  card: { flex: 1, borderRadius: 0, overflow: "hidden" },
  cardCopy: { position: "absolute", left: 25, right: 25 },
  locationLine: { flexDirection: "row", gap: 6, alignItems: "center", marginTop: 9 },
  location: { fontSize: 13, fontWeight: "500" },
  nameLine: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  name: { fontSize: 35, fontWeight: "800", letterSpacing: -1.1, flexShrink: 1 },
  age: { fontSize: 23, fontWeight: "500" },
  interests: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 12 },
  soundButton: { position: "absolute", right: 20, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", zIndex: 3 },
  actions: { position: "absolute", left: 0, right: 0, zIndex: 4, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 26 },
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
  choiceRow: { flexDirection: "row", gap: 8 },
  choice: { paddingVertical: 10, paddingHorizontal: 13, borderWidth: 1, borderRadius: 14 },
  primaryButton: { height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 16 },
  modalCity: { fontSize: 13, marginTop: -5 },
  modalBio: { fontSize: 15, lineHeight: 23, marginTop: 14 },
  interestTag: { overflow: "hidden", borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7, fontSize: 12, fontWeight: "600" },
  safetyRow: { flexDirection: "row", gap: 24, marginTop: 22, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(120,100,110,0.25)" },
  safetyText: { fontSize: 13, fontWeight: "700" },
});
