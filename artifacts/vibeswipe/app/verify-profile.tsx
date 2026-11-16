import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetFaceVerificationStatusQueryKey, getGetMyProfileQueryKey, getGetDiscoverProfilesQueryKey, getGetMatchesQueryKey,
  useGetMyProfile, useGetFaceVerificationStatus, useStartFaceVerification, useCompleteFaceVerification, useFinalizeFaceVerification,
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
  const finalize = useFinalizeFaceVerification();
  const resumed = useRef(false);
  const [startAgain, setStartAgain] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState("");
  const selectedPhotoForVerification = selectedPhoto || profile.data?.photos?.[0] || "";
  const lock = useRef(false);
  const verified = status.data?.verified === true || complete.data?.verified === true || finalize.data?.verified === true;
  const waiting = !verified && !startAgain && status.data?.reviewStatus === "awaiting_review";
  async function refreshProfile() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetFaceVerificationStatusQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetDiscoverProfilesQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetMatchesQueryKey() }),
    ]);
  }
  async function finishCheckedPhoto() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const result = await finalize.mutateAsync();
      if (!result.verified) throw new Error("Your verification was not confirmed.");
      await refreshProfile();
    } catch (e) {
      const data = e && typeof e === "object" && "data" in e ? e.data as { error?: unknown } : undefined;
      setError(typeof data?.error === "string" ? data.error : "Your photo checks could not finish. Please try again.");
    } finally { lock.current = false; setBusy(false); }
  }
  useEffect(() => {
    if (waiting && status.data?.available && !resumed.current) {
      resumed.current = true;
      void finishCheckedPhoto();
    }
  }, [waiting, status.data?.available]);
  async function capture() {
    if (!consent || !selectedPhotoForVerification || waiting || lock.current) return;
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
      const session = await start.mutateAsync({ data: { consent: true, photoReference: selectedPhotoForVerification } });
      const response = await complete.mutateAsync({ sessionId: session.sessionId, data: selfie });
      if (!response.verified) throw new Error("Your verification could not be confirmed. Please try again.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetFaceVerificationStatusQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetDiscoverProfilesQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetMatchesQueryKey() }),
      ]);
      Alert.alert("You’re verified", "Your face checks passed. Your verified main photo and blue tick are now visible to other members.");
    } catch (e) {
      const data = e && typeof e === "object" && "data" in e ? e.data as { error?: unknown; checked?: boolean } : undefined;
      setError(typeof data?.error === "string" ? data.error : e instanceof Error ? e.message : "Verification failed. Please try again.");
      if (data?.checked) {
        resumed.current = true;
        await queryClient.invalidateQueries({ queryKey: getGetFaceVerificationStatusQueryKey() });
      }
    } finally { lock.current = false; setBusy(false); }
  }
  if (!status.data) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, padding: 22, gap: 20 }} edges={["top", "bottom"]}>
    <Pressable onPress={() => router.back()} accessibilityLabel="Back"><Feather name="arrow-left" size={24} color={colors.text}/></Pressable>
    {status.isError ? <Pressable onPress={() => void status.refetch()}><Text style={{ color: colors.text }}>Verification could not load. Tap to try again.</Text></Pressable> : <ActivityIndicator color={colors.primary}/>}
  </SafeAreaView>;
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
    <ScrollView contentContainerStyle={{ padding: 22, gap: 20 }}>
      <Pressable onPress={() => router.back()} accessibilityLabel="Back" style={{ paddingVertical: 10 }}><Feather name="arrow-left" size={24} color={colors.text}/></Pressable>
      <Text style={{ color: colors.text, fontSize: 28, fontWeight: "800" }}>Face verification</Text>
      {profile.data && <View style={{ alignItems: "center", gap: 12 }}><ProfileAvatar profile={profile.data} size={108}/><Text style={{ color: colors.text }}>{profile.data.name} — your main photo</Text></View>}
      {status.isLoading ? <ActivityIndicator color={colors.primary}/> : status.isError ? <Pressable onPress={() => void status.refetch()}><Text style={{ color: colors.text }}>Verification could not load. Tap to try again.</Text></Pressable> : verified ? <View style={{ gap: 12 }}><Feather name="check-circle" size={44} color={colors.primary}/><Text style={{ color: colors.text, fontSize: 22, fontWeight: "700" }}>Your profile is verified</Text><Text style={{ color: colors.text }}>Your verified photo and badge are visible to other members.</Text></View> : waiting ? <View style={{ gap: 12 }}><Feather name="shield" size={40} color={colors.primary}/><Text style={{ color: colors.text, fontSize: 22, fontWeight: "700" }}>Finishing your verification</Text><Text style={{ color: colors.text }}>Your selfie check passed. We’re checking that your gallery photos match your face. No administrator approval is needed.</Text>{error ? <Text accessibilityRole="alert" style={{ color: colors.primary }}>{error}</Text> : null}<Pressable disabled={busy} onPress={() => void finishCheckedPhoto()} accessibilityLabel="Finish verification"><Text style={{ color: colors.primary }}>{busy ? "Checking your photos…" : "Finish verification"}</Text></Pressable>{error ? <Pressable onPress={() => setStartAgain(true)}><Text style={{ color: colors.primary }}>Choose another photo</Text></Pressable> : null}</View> : !status.data.available ? <Text style={{ color: colors.text }}>Verification is temporarily unavailable. Please try again later.</Text> : <>
        {status.data.rejectionReason ? <Text accessibilityRole="alert" style={{ color: colors.primary }}>{status.data.rejectionReason}</Text> : null}
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "700" }}>Choose the photo to verify</Text>
        <Text style={{ color: colors.text }}>Successful face checks make this your main photo and activate your blue tick automatically. Your other photos must match the same face.</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {profile.data?.photos.map((photo, index) => {
            const selected = selectedPhotoForVerification === photo;
            return <Pressable key={photo} disabled={busy} accessibilityLabel={index === 0 ? "Select main profile photo for verification" : `Select gallery photo ${index + 1} for verification`} accessibilityState={{ selected }} onPress={() => { setSelectedPhoto(photo); setConsent(false); }} style={{ alignItems: "center", gap: 4, padding: 4 }}>
              <View style={{ position: "relative", padding: 3, borderWidth: selected ? 3 : 1, borderColor: selected ? colors.primary : colors.border, borderRadius: 44 }}>
                <ProfileAvatar profile={{ ...profile.data!, photos: [photo], isVerified: false }} size={70}/>
                {selected ? <View style={{ position: "absolute", top: -3, right: -3, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary }}>
                  <Feather name="check" size={14} color={colors.background}/>
                </View> : null}
              </View>
              <Text style={{ color: colors.text, fontSize: 11, fontWeight: selected ? "700" : "500" }}>{index === 0 ? "Main" : `Photo ${index + 1}`}</Text>
            </Pressable>;
          })}
        </View>
        <Text style={{ color: colors.text }}>Your main profile photo is selected automatically. Tap another photo if you want to use it instead.</Text>
        <Text style={{ color: colors.text }}>Or upload a different verification photo</Text>
        <MediaPicker photos={selectedPhotoForVerification ? [selectedPhotoForVerification] : []} videoUrl={null} maxPhotos={1} showVideo={false} onChange={({ photos }) => { setSelectedPhoto(photos[0] ?? ""); setConsent(false); }}/>
        <Text style={{ color: colors.text, fontSize: 16, lineHeight: 25 }}>Face the camera straight on, in good light. Remove sunglasses or anything covering your face. Only you should be in the frame. Hold still and take a fresh selfie.</Text>
        <Text style={{ color: colors.text, fontSize: 14, lineHeight: 22 }}>Your photo and camera selfie are checked to confirm they match. Your live camera capture is not saved. Successful checks automatically activate your verified main photo and badge.</Text>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}><Switch accessibilityLabel="I consent to face verification" value={consent} onValueChange={setConsent} disabled={busy} trackColor={{ true: colors.primary }}/><Text style={{ flex: 1, color: colors.text }}>I agree to have my photo and live selfie checked to confirm this is me.</Text></View>
        {error ? <Text accessibilityRole="alert" style={{ color: colors.primary }}>{error}</Text> : null}
        <Pressable accessibilityLabel="Take verification selfie" disabled={!consent || !selectedPhotoForVerification || busy} onPress={() => void capture()} style={{ padding: 18, borderRadius: 24, alignItems: "center", backgroundColor: colors.primary, opacity: !consent || !selectedPhotoForVerification || busy ? 0.5 : 1 }}>{busy ? <ActivityIndicator color="#fff"/> : <Text style={{ color: "#fff", fontWeight: "700" }}>{error ? "Try again" : "Open camera"}</Text>}</Pressable>
      </>}
    </ScrollView>
  </SafeAreaView>;
}
