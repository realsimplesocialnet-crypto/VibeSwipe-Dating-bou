import React from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/hooks/useTheme';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { SymbolView } from 'expo-symbols';
import { useGetNotifications } from '@workspace/api-client-react';
import { ReferralToastHost } from '@/components/ReferralToastHost';

export const unstable_settings = { initialRouteName: 'reels' };

// IMPORTANT: iOS 26 uses NativeTabs for native tabs with liquid glass support.
// NativeTabs intentionally does NOT use custom design tokens — liquid glass
// is a system-level appearance provided by iOS and cannot be overridden.
// Custom brand colors are applied only on the ClassicTabLayout path (older iOS / Android / web).
function NativeTabLayout() {
  const colors = useColors();
  const notifications = useGetNotifications({ query: { refetchInterval: 5_000 } });
  const counts = notifications.data?.unreadCounts;
  const messageBadge = counts?.messages ?? 0;
  const activityBadge = counts ? counts.likes + counts.follows + (counts.reels ?? 0) : 0;
  return (
    <>
    <ReferralToastHost data={notifications.data} />
    <NativeTabs tintColor={colors.premiumAccent}>
      <NativeTabs.Trigger name="reels">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'house', selected: 'house.fill' }}
          drawable="home"
        />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} drawable="group" />
        <NativeTabs.Trigger.Label>Friends</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="create">
        <NativeTabs.Trigger.Icon sf={{ default: 'plus.app', selected: 'plus.app.fill' }} drawable="add" />
        <NativeTabs.Trigger.Label>Create</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="views">
        <NativeTabs.Trigger.Icon sf={{ default: 'tray', selected: 'tray.fill' }} drawable="inbox" />
        <NativeTabs.Trigger.Label>Inbox</NativeTabs.Trigger.Label>
        {messageBadge > 0 ? <NativeTabs.Trigger.Badge>{messageBadge > 99 ? '99+' : String(messageBadge)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="explore" hidden />
      <NativeTabs.Trigger name="matches" hidden />
      <NativeTabs.Trigger name="activity" hidden>
        <NativeTabs.Trigger.Icon sf={{ default: 'bell', selected: 'bell.fill' }} />
        <NativeTabs.Trigger.Label>Activity</NativeTabs.Trigger.Label>
        {activityBadge > 0 ? <NativeTabs.Trigger.Badge>{activityBadge > 99 ? '99+' : String(activityBadge)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chats" hidden />
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} />
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
    </>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const { scheme } = useTheme();
  const isDark = scheme === 'dark';
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';
  const notifications = useGetNotifications({ query: { refetchInterval: 5_000 } });
  const counts = notifications.data?.unreadCounts;
  const messageBadge = counts?.messages ?? 0;
  const activityBadge = counts ? counts.likes + counts.follows + (counts.reels ?? 0) : 0;

  return (
    <>
    <ReferralToastHost data={notifications.data} />
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.premiumAccent,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: true,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : colors.background,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerTitleStyle: { color: colors.foreground },
        headerShadowVisible: false,
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.background },
              ]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="reels"
        options={{
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name="house" tintColor={color} size={24} />
            ) : (
              <Feather
                name="home"
                size={22}
                color={focused ? colors.primary : colors.mutedForeground}
              />
            ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Friends',
          headerShown: false,
          tabBarIcon: ({ color }) => <Feather name="users" size={21} color={typeof color === 'string' ? color : colors.primary} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: '',
          tabBarAccessibilityLabel: 'Create',
          headerShown: false,
          tabBarIcon: () => (
            <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginTop: -13, backgroundColor: colors.primary }}>
              <Feather name="plus" size={23} color={colors.primaryForeground} />
            </View>
          ),
        }}
      />
      <Tabs.Screen name="matches" options={{ href: null }} />
      <Tabs.Screen
        name="views"
        options={{
          title: 'Inbox',
          headerShown: false,
          tabBarBadge: messageBadge || undefined,
          tabBarIcon: ({ color }) => <Feather name="inbox" size={21} color={typeof color === 'string' ? color : colors.primary} />,
        }}
      />
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          href: null,
          headerShown: false,
          tabBarBadge: activityBadge || undefined,
          tabBarIcon: ({ color }) => <Feather name="bell" size={21} color={typeof color === 'string' ? color : colors.primary} />,
        }}
      />
      <Tabs.Screen name="chats" options={{ href: null }} />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Feather name="user" size={21} color={typeof color === 'string' ? color : colors.primary} />,
        }}
      />
    </Tabs>
    </>
  );
}

export default function TabLayout() {
  const { scheme } = useTheme();
  const systemScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  if (isLiquidGlassAvailable() && scheme === systemScheme) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
