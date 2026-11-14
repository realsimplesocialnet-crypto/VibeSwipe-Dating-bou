import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

function expoProjectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? Constants.easConfig?.projectId ?? extra?.eas?.projectId ?? null;
}

export function canEnrollNativePush() {
  return Platform.OS !== "web" && Device.isDevice && Constants.executionEnvironment !== "storeClient" && !!expoProjectId();
}

export async function prepareMessageChannel() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("messages", {
      name: "Messages", importance: Notifications.AndroidImportance.HIGH, sound: "default",
    });
  }
}

export async function getDeviceToken(): Promise<string> {
  const projectId = expoProjectId();
  if (!projectId) throw new Error("Push is not configured in this app build yet. Install a build made with Replit Expo Launch and try again.");
  await prepareMessageChannel();
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

export async function devicePushOptedOut(accountId: string) {
  return (await AsyncStorage.getItem(`myage-push-device-off:${accountId}`)) === "1";
}

export function setDevicePushOptOut(accountId: string, off: boolean) {
  return AsyncStorage.setItem(`myage-push-device-off:${accountId}`, off ? "1" : "0");
}
