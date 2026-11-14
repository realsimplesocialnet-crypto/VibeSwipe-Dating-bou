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
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

function expoProjectId(): string | null {
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: string } }
    | undefined;
  return (
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
    Constants.easConfig?.projectId ??
    extra?.eas?.projectId ??
    null
  );
}

export function PushNotificationSettings() {
  const colors = useColors();
  const saveToken = useSaveNativePushToken();
  const deleteToken = useDeleteNativePushToken();
  const [token, setToken] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function getDeviceToken(): Promise<string> {
    const projectId = expoProjectId();
    if (!projectId) {
      throw new Error(
        "Push is not configured in this app build yet. Install a build made with Replit Expo Launch and try again.",
      );
    }
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("messages", {
        name: "Messages",
        importance: Notifications.AndroidImportance.HIGH,
        sound: "default",
      });
    }
    return (
      await Notifications.getExpoPushTokenAsync({ projectId })
    ).data;
  }

  useEffect(() => {
    if (Platform.OS === "web" || !Device.isDevice) return;
    if (
      Platform.OS === "ios" &&
      Constants.executionEnvironment === "storeClient"
    ) {
      setStatus("On iPhone, push notifications need the installed TestFlight app; Expo Go cannot receive them.");
      return;
    }
    let active = true;
    void (async () => {
      try {
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
  }, []);

  async function toggleNotifications() {
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      if (enabled) {
        const currentToken = token ?? (await getDeviceToken());
        await deleteToken.mutateAsync({ data: { token: currentToken } });
        setToken(null);
        setEnabled(false);
        setStatus("Message notifications are off on this device.");
        return;
      }
      if (!Device.isDevice) {
        throw new Error("Install Myage on a real phone to enable notifications.");
      }
      if (
        Platform.OS === "ios" &&
        Constants.executionEnvironment === "storeClient"
      ) {
        throw new Error("iPhone push notifications require the installed TestFlight app; Expo Go cannot receive them.");
      }
      const current = await Notifications.getPermissionsAsync();
      const permission = current.granted
        ? current
        : await Notifications.requestPermissionsAsync();
      if (!permission.granted) {
        throw new Error("Notifications are off. Allow them in your phone settings to receive messages.");
      }
      const deviceToken = await getDeviceToken();
      await saveToken.mutateAsync({ data: { token: deviceToken } });
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
            Get the sender’s name and message preview, even when Myage is closed.
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
