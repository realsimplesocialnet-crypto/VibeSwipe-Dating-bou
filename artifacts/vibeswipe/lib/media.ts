import type { ImageSourcePropType } from "react-native";

const domain = process.env.EXPO_PUBLIC_DOMAIN;
const apiOrigin = domain ? `https://${domain}` : "";

const demoImages: Record<string, ImageSourcePropType> = {
  "demo:profile-one": require("../assets/images/profile-one.png"),
  "demo:profile-two": require("../assets/images/profile-two.png"),
};

export function mediaUri(reference: string): string | null {
  if (reference.startsWith("media:")) {
    const mediaId = reference.slice("media:".length);
    return `${apiOrigin}/api/vibeswipe/media/${mediaId}`;
  }
  return null;
}

export function profileImageSource(
  reference?: string | null,
  token?: string | null,
): ImageSourcePropType | undefined {
  if (!reference) return undefined;
  if (reference.startsWith("demo:")) return demoImages[reference];
  const uri = mediaUri(reference);
  if (!uri) return undefined;
  return {
    uri,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  };
}

export function profileVideoSource(
  reference: string,
  token?: string | null,
): { uri: string; headers?: Record<string, string>; useCaching: boolean } | null {
  const uri = mediaUri(reference);
  if (!uri) return null;
  return {
    uri,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    useCaching: true,
  };
}
