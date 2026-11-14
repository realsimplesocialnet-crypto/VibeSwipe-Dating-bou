export function isAllowedWebPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (
      url.protocol !== "https:" ||
      (url.port && url.port !== "443") ||
      url.username ||
      url.password
    ) {
      return false;
    }
    const host = url.hostname.toLowerCase();
    return (
      host === "web.push.apple.com" ||
      host === "fcm.googleapis.com" ||
      host === "updates.push.services.mozilla.com" ||
      host.endsWith(".push.services.mozilla.com")
    );
  } catch {
    return false;
  }
}

export function isValidExpoPushToken(token: string): boolean {
  return /^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$/.test(token);
}

export function buildMessagePushPayload(input: {
  matchId: string;
  senderName: string;
  content: string;
  mediaType?: string | null;
}) {
  const plainText = input.content.trim().replace(/\s+/g, " ");
  const mediaFallback =
    input.mediaType === "image"
      ? "Sent a photo"
      : input.mediaType === "video"
        ? "Sent a video"
        : input.mediaType === "audio"
          ? "Sent a voice note"
          : "Sent you a message";
  const preview = plainText || mediaFallback;
  const body =
    preview.length > 140 ? `${preview.slice(0, 137).trimEnd()}…` : preview;
  return {
    title: input.senderName.trim() || "New message",
    body,
    data: {
      type: "new_message",
      matchId: input.matchId,
      url: `chat/${encodeURIComponent(input.matchId)}`,
    },
  };
}
