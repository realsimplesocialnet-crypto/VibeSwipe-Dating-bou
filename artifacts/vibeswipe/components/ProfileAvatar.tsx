import { useAuth } from "@clerk/expo";
import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import type { Profile } from "@workspace/api-client-react";
import { profileImageSource } from "@/lib/media";
import { useColors } from "@/hooks/useColors";

export function ProfileAvatar({
  profile,
  size = 58,
}: {
  profile: Profile;
  size?: number;
}) {
  const colors = useColors();
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void getToken().then((value) => {
      if (active) setToken(value);
    });
    return () => {
      active = false;
    };
  }, [getToken]);
  const source = profileImageSource(profile.photos[0], token);
  return (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.accent }]}>
      {source ? (
        <Image source={source} style={{ width: size, height: size, borderRadius: size / 2 }} resizeMode="cover" />
      ) : (
        <Text style={[styles.initial, { color: colors.primary, fontSize: size * 0.38 }]}>
          {profile.name.slice(0, 1).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  initial: { fontWeight: "700" },
});
