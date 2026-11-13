import React, { useEffect, useState } from "react";
import { ClerkLoaded, ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setAuthTokenGetter, setBaseUrl, useHeartbeatPresence } from "@workspace/api-client-react";
import { AppState } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/hooks/useTheme";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack, router, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: 1 } },
});
const domain = process.env.EXPO_PUBLIC_DOMAIN;
if (domain) setBaseUrl(`https://${domain}`);
const clerkKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
const clerkProxyUrl = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false, headerBackTitle: "Back" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="chat/[matchId]" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="profile/[profileId]" />
    </Stack>
  );
}

function AuthRouteGuard() {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();
  useEffect(() => {
    if (!isLoaded) return;
    const section = segments[0];
    const authScreen =
      section === "(auth)" || section === "sign-in" || section === "sign-up";
    const publicScreen = !section || authScreen;
    if (!isSignedIn && !publicScreen) router.replace("/");
    if (isSignedIn && authScreen) router.replace("/");
  }, [isLoaded, isSignedIn, segments]);
  return <RootLayoutNav />;
}

function AuthenticatedApi({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    setReady(true);
  }, [getToken]);

  if (!ready) return null;
  return (
    <QueryClientProvider client={queryClient}>
      <PresenceHeartbeat />
      {children}
    </QueryClientProvider>
  );
}

function PresenceHeartbeat() {
  const { isLoaded, isSignedIn } = useAuth();
  const heartbeat = useHeartbeatPresence();
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const send = (isActive: boolean) => heartbeat.mutate({ data: { isActive } });
    if (AppState.currentState === "active") send(true);
    const interval = setInterval(() => {
      if (AppState.currentState === "active") send(true);
    }, 20_000);
    const subscription = AppState.addEventListener("change", (state) => {
      send(state === "active");
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
      send(false);
    };
  }, [heartbeat.mutate, isLoaded, isSignedIn]);
  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  if (!clerkKey) {
    return null;
  }
  return (
    <ClerkProvider publishableKey={clerkKey} tokenCache={tokenCache} proxyUrl={clerkProxyUrl}>
      <ClerkLoaded>
        <ThemeProvider>
          <SafeAreaProvider>
            <ErrorBoundary>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <AuthenticatedApi>
                    <StatusBar style="light" />
                    <AuthRouteGuard />
                  </AuthenticatedApi>
                </KeyboardProvider>
              </GestureHandlerRootView>
            </ErrorBoundary>
          </SafeAreaProvider>
        </ThemeProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
