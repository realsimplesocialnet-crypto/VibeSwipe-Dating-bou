import { Feather } from "@expo/vector-icons";
import type { Profile } from "@workspace/api-client-react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, useColorScheme, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useColors } from "@/hooks/useColors";

export type MatchCelebrationProps = {
  visible: boolean;
  self: Profile | null;
  other: Pick<Profile, "name" | "photos" | "isVerified"> | null;
  canMessage: boolean;
  onMessage: () => void;
  onKeepSwiping: () => void;
};

function Photo({ profile, size, ring, tilt }: { profile: Pick<Profile, "name" | "photos" | "isVerified"> | null; size: number; ring: string; tilt: string }) {
  const colors = useColors();
  return (
    <View style={[styles.photo, { width: size + 10, height: size + 10, borderRadius: (size + 10) / 2, backgroundColor: ring, transform: [{ rotate: tilt }] }]}>
      {profile ? <ProfileAvatar profile={profile} size={size} /> : (
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}>
          <Feather name="user" size={size * 0.38} color={colors.primary} />
        </View>
      )}
    </View>
  );
}

export function MatchCelebration({ visible, self, other, canMessage, onMessage, onKeepSwiping }: MatchCelebrationProps) {
  const colors = useColors();
  const dark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const size = Math.max(112, Math.min(168, width * 0.38));
  const bg = colors.messagesBackground;
  const ring = dark ? colors.background : colors.card;
  const name = other?.name?.trim() || "your match";
  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onKeepSwiping}>
      <View style={[styles.fill, { backgroundColor: bg }]}>
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]} bounces={false}>
          <View style={styles.top}>
            <Feather name="heart" size={24} color={colors.primary} accessibilityElementsHidden importantForAccessibility="no" />
            <Text accessibilityRole="header" style={[styles.title, { color: colors.primary }]}>It’s a match!</Text>
            <View style={styles.pair}>
              <Photo profile={self} size={size} ring={ring} tilt="-6deg" />
              <View style={{ marginLeft: -size * 0.16 }}><Photo profile={other} size={size} ring={ring} tilt="6deg" /></View>
              <View style={[styles.heart, { backgroundColor: colors.primary, borderColor: ring }]}>
                <Feather name="heart" size={22} color={colors.primaryForeground} />
              </View>
            </View>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              You and <Text style={{ color: colors.foreground, fontWeight: "700" }}>{name}</Text> liked each other.
            </Text>
          </View>
          <View style={styles.actions}>
            <Pressable
              testID="match-send-message"
              accessibilityRole="button"
              accessibilityState={{ disabled: !canMessage }}
              disabled={!canMessage}
              onPress={onMessage}
              style={({ pressed }) => [styles.btn, { backgroundColor: colors.primary, opacity: !canMessage ? 0.5 : pressed ? 0.85 : 1 }]}
            >
              <Feather name="message-circle" size={19} color={colors.primaryForeground} />
              <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Send a message</Text>
            </Pressable>
            {!canMessage ? <Text style={[styles.note, { color: colors.mutedForeground }]}>Chat is getting ready. Find it in Matches shortly.</Text> : null}
            <Pressable
              testID="match-keep-swiping"
              accessibilityRole="button"
              onPress={onKeepSwiping}
              style={({ pressed }) => [styles.btn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={[styles.btnText, { color: colors.foreground }]}>Keep swiping</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, maxWidth: 460, width: "100%", alignSelf: "center" },
  top: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { marginTop: 10, fontSize: 40, fontWeight: "800", letterSpacing: -1, textAlign: "center" },
  pair: { marginTop: 36, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingBottom: 14 },
  photo: { alignItems: "center", justifyContent: "center", shadowColor: "#7a1d40", shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  heart: { position: "absolute", bottom: 0, alignSelf: "center", width: 54, height: 54, borderRadius: 27, borderWidth: 4, alignItems: "center", justifyContent: "center" },
  sub: { marginTop: 30, fontSize: 17, lineHeight: 25, textAlign: "center" },
  actions: { marginTop: 36, gap: 12 },
  btn: { minHeight: 56, borderRadius: 999, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 20, paddingVertical: 12 },
  btnText: { fontSize: 16, fontWeight: "700" },
  note: { fontSize: 13, textAlign: "center" },
});
