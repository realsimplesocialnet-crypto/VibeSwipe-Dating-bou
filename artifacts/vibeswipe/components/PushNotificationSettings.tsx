import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  useDeleteNativePushToken,
  useSaveNativePushToken,
  useGetMyProfile,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { devicePushOptedOut, getDeviceToken, prepareMessageChannel, setDevicePushOptOut } from "@/lib/push-enrollment";

export function PushNotificationSettings() {
  const colors = useColors();
  const profile = useGetMyProfile();
  const saveToken = useSaveNativePushToken();
  const deleteToken = useDeleteNativePushToken();
  const [token, setToken] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (Platform.OS === "web" || !Device.isDevice || !profile.data?.id) return;
    if (
      Constants.executionEnvironment === "storeClient"
    ) {
      setStatus("Background notifications require the installed MyAgeBeauty app, not Expo Go.");
      return;
    }
    let active = true;
    void (async () => {
      try {
        if (await devicePushOptedOut(profile.data!.id)) return;
        const permission = await Notifications.getPermissionsAsync();
        if (!permission.granted) return;
        const deviceToken = await getDeviceToken();
        if (!active) return;
        await saveToken.mutateAsync({ data: { token: deviceToken } });
        if (!active) return;
        setToken(deviceToken);
        setEnabled(true);
        setStatus("Message notifications are enabled on this device.");
      } catch {
        if (active) setStatus("Tap below to enable message notifications on this device.");
      }
    })();
    return () => {
      active = false;
    };
  }, [profile.data?.id]);

  async function toggleNotifications() {
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      if (!profile.data?.id) throw new Error("Your profile is still loading. Please try again.");
      if (enabled) {
        const currentToken = token ?? (await getDeviceToken());
        await deleteToken.mutateAsync({ data: { token: currentToken } });
        await setDevicePushOptOut(profile.data.id, true);
        setToken(null);
        setEnabled(false);
        setStatus("Message notifications are off on this device.");
        return;
      }
      if (!Device.isDevice) {
        throw new Error("Install MyAgeBeauty on a real phone to enable notifications.");
      }
      if (
        Constants.executionEnvironment === "storeClient"
      ) {
        throw new Error("Background notifications require the installed MyAgeBeauty app, not Expo Go.");
      }
      await prepareMessageChannel();
      const current = await Notifications.getPermissionsAsync();
      const permission = current.granted
        ? current
        : await Notifications.requestPermissionsAsync();
      if (!permission.granted) {
        throw new Error("Notifications are off. Allow them in your phone settings to receive messages.");
      }
      const deviceToken = await getDeviceToken();
      await saveToken.mutateAsync({ data: { token: deviceToken } });
      await setDevicePushOptOut(profile.data.id, false);
      setToken(deviceToken);
      setEnabled(true);
      setStatus("Message notifications are enabled on this device.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Notifications could not be enabled. Please try again.";
      setStatus(message);
      Alert.alert("Message notifications", message);
    } finally {
      setBusy(false);
    }
  }

  if (Platform.OS === "web") return null;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      testID="section-message-notifications"
    >
      <View style={styles.row}>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Message notifications
          </Text>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>
            Get the sender’s name and message preview, even when MyAgeBeauty is closed.
          </Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => void toggleNotifications()}
        style={[
          styles.button,
          { backgroundColor: enabled ? colors.card : colors.primary, borderColor: colors.primary },
        ]}
        testID="button-toggle-message-notifications"
      >
        {busy ? (
          <ActivityIndicator color={enabled ? colors.primary : colors.background} />
        ) : (
          <Text
            style={[
              styles.buttonText,
              { color: enabled ? colors.primary : colors.background },
            ]}
          >
            {enabled ? "Turn off on this device" : "Enable notifications"}
          </Text>
        )}
      </Pressable>
      {!!status && (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.status, { color: colors.mutedForeground }]}
        >
          {status}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 15,
    marginBottom: 20,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 11 },
  copy: { flex: 1, gap: 5 },
  title: { fontSize: 14, fontWeight: "700" },
  description: { fontSize: 12, lineHeight: 18 },
  button: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 13,
    paddingHorizontal: 16,
  },
  buttonText: { fontSize: 13, fontWeight: "700" },
  status: { fontSize: 12, lineHeight: 18, marginTop: 10 },
});
