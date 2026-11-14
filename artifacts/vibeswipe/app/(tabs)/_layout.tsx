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

// IMPORTANT: iOS 26 uses NativeTabs for native tabs with liquid glass support.
// NativeTabs intentionally does NOT use custom design tokens — liquid glass
// is a system-level appearance provided by iOS and cannot be overridden.
// Custom brand colors are applied only on the ClassicTabLayout path (older iOS / Android / web).
function NativeTabLayout() {
  const notifications = useGetNotifications({ query: { refetchInterval: 5_000 } });
  const counts = notifications.data?.unreadCounts;
  const matchBadge = counts?.matches ?? 0;
  const messageBadge = counts?.messages ?? 0;
  const activityBadge = counts ? counts.views + counts.likes : 0;
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'house', selected: 'house.fill' }}
        />
        <NativeTabs.Trigger.Label>Discover</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="matches">
        <NativeTabs.Trigger.Icon sf={{ default: 'heart', selected: 'heart.fill' }} />
        <NativeTabs.Trigger.Label>Matches</NativeTabs.Trigger.Label>
        {matchBadge > 0 ? <NativeTabs.Trigger.Badge>{matchBadge > 99 ? '99+' : String(matchBadge)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="views">
        <NativeTabs.Trigger.Icon sf={{ default: 'message', selected: 'message.fill' }} />
        <NativeTabs.Trigger.Label>Messages</NativeTabs.Trigger.Label>
        {messageBadge > 0 ? <NativeTabs.Trigger.Badge>{messageBadge > 99 ? '99+' : String(messageBadge)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="activity">
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
  const matchBadge = counts?.matches ?? 0;
  const messageBadge = counts?.messages ?? 0;
  const activityBadge = counts ? counts.views + counts.likes : 0;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
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
        name="index"
        options={{
          title: 'Discover',
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
        name="matches"
        options={{
          title: 'Matches',
          headerShown: false,
          tabBarBadge: matchBadge || undefined,
          tabBarIcon: ({ color }) => <Feather name="heart" size={21} color={typeof color === 'string' ? color : colors.primary} />,
        }}
      />
      <Tabs.Screen
        name="views"
        options={{
          title: 'Messages',
          headerShown: false,
          tabBarBadge: messageBadge || undefined,
          tabBarIcon: ({ color }) => <Feather name="message-circle" size={21} color={typeof color === 'string' ? color : colors.primary} />,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
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
