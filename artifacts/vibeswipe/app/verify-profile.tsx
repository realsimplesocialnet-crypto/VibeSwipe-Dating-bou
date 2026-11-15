import { useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetFaceVerificationStatusQueryKey, getGetMyProfileQueryKey, getGetDiscoverProfilesQueryKey, getGetMatchesQueryKey,
  useGetMyProfile, useGetFaceVerificationStatus, useStartFaceVerification, useCompleteFaceVerification,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { MediaPicker } from "@/components/MediaPicker";
import { SafeAreaView } from "react-native-safe-area-context";

export default function FaceVerificationScreen() {
  const palette = useColors();
  const colors = { ...palette, text: palette.foreground };
  const queryClient = useQueryClient();
  const profile = useGetMyProfile();
  const status = useGetFaceVerificationStatus({ query: { staleTime: 0, refetchInterval: query => query.state.data?.reviewStatus === "awaiting_review" ? 20_000 : false } });
  const start = useStartFaceVerification();
  const complete = useCompleteFaceVerification();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState("");
  const lock = useRef(false);
  const verified = status.data?.verified === true;
  const waiting = status.data?.reviewStatus === "awaiting_review";
  async function capture() {
    if (!consent || !selectedPhoto || waiting || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) throw new Error("Allow camera access in your phone settings to verify your profile.");
      const result = await ImagePicker.launchCameraAsync({
        cameraType: ImagePicker.CameraType.front, mediaTypes: ["images"],
        quality: 0.85, allowsEditing: false, exif: false,
      });
      if (result.canceled || !result.assets[0]) return;
      const selfie = await (await fetch(result.assets[0].uri)).blob();
      if (selfie.size > 5 * 1024 * 1024) throw new Error("This selfie is larger than 5 MB. Please take another one.");
      const session = await start.mutateAsync({ data: { consent: true, photoReference: selectedPhoto } });
      const response = await complete.mutateAsync({ sessionId: session.sessionId, data: selfie });
      if (response.reviewStatus !== "awaiting_review" || response.verified) throw new Error("Your review request could not be confirmed. Refresh before trying again.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetFaceVerificationStatusQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetDiscoverProfilesQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetMatchesQueryKey() }),
      ]);
      Alert.alert("Submitted for review", "Your camera checks passed. Your photo and blue tick will change only after administrator approval.");
    } catch (e) {
      const data = e && typeof e === "object" && "data" in e ? e.data as { error?: unknown } : undefined;
      setError(typeof data?.error === "string" ? data.error : e instanceof Error ? e.message : "Verification failed. Please try again.");
    } finally { lock.current = false; setBusy(false); }
  }
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
    <ScrollView contentContainerStyle={{ padding: 22, gap: 20 }}>
      <Pressable onPress={() => router.back()} accessibilityLabel="Back" style={{ paddingVertical: 10 }}><Feather name="arrow-left" size={24} color={colors.text}/></Pressable>
      <Text style={{ color: colors.text, fontSize: 28, fontWeight: "800" }}>Face verification</Text>
      {profile.data && <View style={{ alignItems: "center", gap: 12 }}><ProfileAvatar profile={profile.data} size={108}/><Text style={{ color: colors.text }}>{profile.data.name} — your main photo</Text></View>}
      {status.isLoading ? <ActivityIndicator color={colors.primary}/> : status.isError ? <Pressable onPress={() => void status.refetch()}><Text style={{ color: colors.text }}>Verification could not load. Tap to try again.</Text></Pressable> : verified ? <View style={{ gap: 12 }}><Feather name="check-circle" size={44} color={colors.primary}/><Text style={{ color: colors.text, fontSize: 22, fontWeight: "700" }}>Your profile is verified</Text><Text style={{ color: colors.text }}>Your approved photo and badge are visible to other members.</Text></View> : waiting ? <View style={{ gap: 12 }}><Feather name="clock" size={40} color={colors.primary}/><Text style={{ color: colors.text, fontSize: 22, fontWeight: "700" }}>Awaiting administrator approval</Text><Text style={{ color: colors.text }}>Your camera checks passed. Your public photo and badge stay unchanged until the administrator approves your submitted picture.</Text></View> : !status.data.available ? <Text style={{ color: colors.text }}>Verification is temporarily unavailable. Please try again later.</Text> : <>
        {status.data.rejectionReason ? <Text accessibilityRole="alert" style={{ color: colors.primary }}>{status.data.rejectionReason}</Text> : null}
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "700" }}>Choose the photo to verify</Text>
        <Text style={{ color: colors.text }}>Approval makes this your main photo. A new photo replaces your current main photo; the other gallery photos stay.</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {profile.data?.photos.map(photo => <Pressable key={photo} disabled={busy} accessibilityLabel="Select gallery photo for verification" accessibilityState={{ selected: selectedPhoto === photo }} onPress={() => { setSelectedPhoto(photo); setConsent(false); }} style={{ padding: 4, borderWidth: selectedPhoto === photo ? 3 : 1, borderColor: selectedPhoto === photo ? colors.primary : colors.border, borderRadius: 44 }}>
            <ProfileAvatar profile={{ ...profile.data!, photos: [photo], isVerified: false }} size={70}/>
          </Pressable>)}
        </View>
        <Text style={{ color: colors.text }}>Or upload a different verification photo</Text>
        <MediaPicker photos={selectedPhoto ? [selectedPhoto] : []} videoUrl={null} maxPhotos={1} showVideo={false} onChange={({ photos }) => { setSelectedPhoto(photos[0] ?? ""); setConsent(false); }}/>
        <Text style={{ color: colors.text, fontSize: 16, lineHeight: 25 }}>Face the camera straight on, in good light. Remove sunglasses or anything covering your face. Only you should be in the frame. Hold still and take a fresh selfie.</Text>
        <Text style={{ color: colors.text, fontSize: 14, lineHeight: 22 }}>Luxand.cloud checks a still selfie for liveness and a match to your selected photo. This is not a video or head-turn check. Myage does not save your live camera capture. Only administrator approval changes your main photo and adds the badge.</Text>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}><Switch accessibilityLabel="I consent to face verification" value={consent} onValueChange={setConsent} disabled={busy} trackColor={{ true: colors.primary }}/><Text style={{ flex: 1, color: colors.text }}>I agree to send these photos to Luxand.cloud for face verification.</Text></View>
        {error ? <Text accessibilityRole="alert" style={{ color: colors.primary }}>{error}</Text> : null}
        <Pressable accessibilityLabel="Take verification selfie" disabled={!consent || !selectedPhoto || busy} onPress={() => void capture()} style={{ padding: 18, borderRadius: 24, alignItems: "center", backgroundColor: colors.primary, opacity: !consent || !selectedPhoto || busy ? 0.5 : 1 }}>{busy ? <ActivityIndicator color="#fff"/> : <Text style={{ color: "#fff", fontWeight: "700" }}>{error ? "Try again" : "Open camera"}</Text>}</Pressable>
      </>}
    </ScrollView>
  </SafeAreaView>;
}
