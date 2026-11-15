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
import { SafeAreaView } from "react-native-safe-area-context";

export default function FaceVerificationScreen() {
  const palette = useColors();
  const colors = { ...palette, text: palette.foreground };
  const queryClient = useQueryClient();
  const profile = useGetMyProfile();
  const status = useGetFaceVerificationStatus({ query: { staleTime: 0 } });
  const start = useStartFaceVerification();
  const complete = useCompleteFaceVerification();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const verified = status.data?.verified === true;
  async function capture() {
    if (!consent || lock.current) return;
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
      const session = await start.mutateAsync({ data: { consent: true } });
      const response = await complete.mutateAsync({ sessionId: session.sessionId, data: selfie });
      if (!response.verified) throw new Error("We could not verify your photo. Please try again.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetFaceVerificationStatusQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetDiscoverProfilesQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetMatchesQueryKey() }),
      ]);
      Alert.alert("Profile verified", "Your verified badge is now visible to other members.");
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
      {status.isLoading ? <ActivityIndicator color={colors.primary}/> : status.isError ? <Pressable onPress={() => void status.refetch()}><Text style={{ color: colors.text }}>Verification could not load. Tap to try again.</Text></Pressable> : verified ? <View style={{ gap: 12 }}><Feather name="check-circle" size={44} color="#2997e8"/><Text style={{ color: colors.text, fontSize: 22, fontWeight: "700" }}>Your profile is verified</Text><Text style={{ color: colors.text }}>Your badge is visible to other members.</Text></View> : !status.data?.hasPhoto ? <Pressable onPress={() => router.push("/edit-profile")}><Text style={{ color: colors.primary }}>Upload and save a main profile photo first</Text></Pressable> : !status.data.available ? <Text style={{ color: colors.text }}>Verification is temporarily unavailable. Please try again later.</Text> : <>
        <Text style={{ color: colors.text, fontSize: 16, lineHeight: 25 }}>Face the camera straight on, in good light. Remove sunglasses or anything covering your face. Only you should be in the frame. Hold still and take a fresh selfie.</Text>
        <Text style={{ color: colors.text, fontSize: 14, lineHeight: 22 }}>Luxand.cloud will check liveness and compare your selfie with your main profile photo. Myage does not save your selfie. Changing your main photo requires verification again.</Text>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}><Switch accessibilityLabel="I consent to face verification" value={consent} onValueChange={setConsent} disabled={busy} trackColor={{ true: colors.primary }}/><Text style={{ flex: 1, color: colors.text }}>I agree to send these photos to Luxand.cloud for face verification.</Text></View>
        {error ? <Text accessibilityRole="alert" style={{ color: colors.primary }}>{error}</Text> : null}
        <Pressable accessibilityLabel="Take verification selfie" disabled={!consent || busy} onPress={() => void capture()} style={{ padding: 18, borderRadius: 24, alignItems: "center", backgroundColor: colors.primary, opacity: !consent || busy ? 0.5 : 1 }}>{busy ? <ActivityIndicator color="#fff"/> : <Text style={{ color: "#fff", fontWeight: "700" }}>{error ? "Try again" : "Open camera"}</Text>}</Pressable>
      </>}
    </ScrollView>
  </SafeAreaView>;
}
