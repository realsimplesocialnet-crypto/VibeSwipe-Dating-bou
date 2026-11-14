import { useGetProfileById, useRecordProfileView } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "@clerk/expo";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { profileImageSource } from "@/lib/media";
import { useColors } from "@/hooks/useColors";

export default function PublicProfileScreen() {
  const colors = useColors();
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  const { getToken } = useAuth();
  const { width } = useWindowDimensions();
  const [token, setToken] = useState<string | null>(null);
  const [activePhoto, setActivePhoto] = useState(0);
  const profile = useGetProfileById(profileId);
  const recordView = useRecordProfileView();
  useEffect(() => {
    if (profileId) recordView.mutate({ profileId });
  }, [profileId]);
  useEffect(() => {
    let active = true;
    void getToken().then((value) => {
      if (active) setToken(value);
    });
    return () => {
      active = false;
    };
  }, [getToken]);
  useEffect(() => setActivePhoto(0), [profileId]);

  if (profile.isLoading) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  }
  if (!profile.data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground }}>This profile is unavailable.</Text>
      </View>
    );
  }
  const user = profile.data;
  const photos = user.photos ?? [];
  const galleryWidth = Math.max(280, width - 48);
  const occupation = user.occupation === "Other"
    ? user.occupationOther || "Other"
    : user.occupation || "Prefer not to say";
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
        <Feather name="arrow-left" size={21} color={colors.foreground} />
      </Pressable>
      {photos.length ? (
        <View style={[styles.galleryFrame, { width: galleryWidth, borderColor: colors.border }]}>
          <ScrollView
            horizontal
            pagingEnabled
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => setActivePhoto(Math.round(event.nativeEvent.contentOffset.x / galleryWidth))}
          >
            {photos.map((photo, index) => {
              const source = profileImageSource(photo, token);
              return source ? (
                <Image
                  key={`${photo}-${index}`}
                  source={source}
                  style={{ width: galleryWidth, height: 430, backgroundColor: colors.card }}
                  resizeMode="cover"
                  accessibilityLabel={`${user.name}'s photo ${index + 1}`}
                />
              ) : null;
            })}
          </ScrollView>
          {photos.length > 1 ? (
            <View style={styles.photoCount}>
              <Text style={styles.photoCountText}>{activePhoto + 1} / {photos.length}</Text>
            </View>
          ) : null}
        </View>
      ) : <ProfileAvatar profile={user} size={190} />}
      <Text style={[styles.name, { color: colors.foreground }]}>{user.name}, {user.age}</Text>
      <Text style={[styles.city, { color: colors.mutedForeground }]}>{[user.city, user.state, user.country].filter(Boolean).join(", ")} · {user.gender}</Text>
      <Text style={[styles.section, { color: colors.foreground }]}>Looking for</Text>
      <Text style={[styles.bio, { color: colors.mutedForeground }]}>{user.lookingFor || "Not specified"}</Text>
      <Text style={[styles.section, { color: colors.foreground }]}>About</Text>
      <Text style={[styles.bio, { color: colors.mutedForeground }]}>{user.bio || "No bio added yet."}</Text>
      <Text style={[styles.section, { color: colors.foreground }]}>Work / occupation</Text>
      <Text style={[styles.bio, { color: colors.mutedForeground }]}>{occupation}</Text>
      <Text style={[styles.section, { color: colors.foreground }]}>Hobbies and interests</Text>
      <View style={styles.tags}>
        {user.interests.map((item) => <Text key={item} style={[styles.tag, { backgroundColor: colors.accent, color: colors.accentForeground }]}>{item}</Text>)}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { minHeight: "100%", alignItems: "center", padding: 24, paddingTop: 55, paddingBottom: 50 },
  back: { alignSelf: "flex-start", width: 40, height: 42, justifyContent: "center", marginBottom: 20 },
  galleryFrame: { height: 430, borderWidth: 1, borderRadius: 22, overflow: "hidden", position: "relative" },
  photoCount: { position: "absolute", right: 12, bottom: 12, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.65)", paddingHorizontal: 10, paddingVertical: 6 },
  photoCountText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  name: { fontSize: 25, fontWeight: "800", marginTop: 18 },
  city: { fontSize: 13, marginTop: 5 },
  section: { alignSelf: "stretch", fontSize: 16, fontWeight: "700", marginTop: 28, marginBottom: 9 },
  bio: { alignSelf: "stretch", fontSize: 14, lineHeight: 21 },
  tags: { alignSelf: "stretch", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { overflow: "hidden", borderRadius: 18, paddingHorizontal: 11, paddingVertical: 7, fontSize: 12, fontWeight: "600" },
});
