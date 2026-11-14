import {
  db,
  profilesTable,
  vibeSwipePushConfigTable,
  vibeSwipePushSubscriptionsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import webPush from "web-push";

const VAPID_CONFIG_KEY = "web-push-vapid";
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type VapidKeys = { publicKey: string; privateKey: string };

let vapidKeysPromise: Promise<VapidKeys> | null = null;

async function createOrLoadVapidKeys(): Promise<VapidKeys> {
  const [existing] = await db
    .select({
      publicKey: vibeSwipePushConfigTable.publicKey,
      privateKey: vibeSwipePushConfigTable.privateKey,
    })
    .from(vibeSwipePushConfigTable)
    .where(eq(vibeSwipePushConfigTable.configKey, VAPID_CONFIG_KEY))
    .limit(1);
  if (existing) return existing;

  const generated = webPush.generateVAPIDKeys();
  await db
    .insert(vibeSwipePushConfigTable)
    .values({
      configKey: VAPID_CONFIG_KEY,
      publicKey: generated.publicKey,
      privateKey: generated.privateKey,
    })
    .onConflictDoNothing({ target: vibeSwipePushConfigTable.configKey });

  const [saved] = await db
    .select({
      publicKey: vibeSwipePushConfigTable.publicKey,
      privateKey: vibeSwipePushConfigTable.privateKey,
    })
    .from(vibeSwipePushConfigTable)
    .where(eq(vibeSwipePushConfigTable.configKey, VAPID_CONFIG_KEY))
    .limit(1);
  if (!saved) throw new Error("Could not initialize web push configuration.");
  return saved;
}

async function getVapidKeys(): Promise<VapidKeys> {
  vapidKeysPromise ??= createOrLoadVapidKeys().catch((error: unknown) => {
    vapidKeysPromise = null;
    throw error;
  });
  return vapidKeysPromise;
}

export async function getWebPushApplicationServerKey(): Promise<string> {
  return (await getVapidKeys()).publicKey;
}

export function isAllowedWebPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password) return false;
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

async function sendWebPush(
  subscription: {
    id: string;
    endpoint: string | null;
    p256dh: string | null;
    auth: string | null;
  },
  payload: ReturnType<typeof buildMessagePushPayload>,
): Promise<void> {
  if (
    !subscription.endpoint ||
    !subscription.p256dh ||
    !subscription.auth ||
    !isAllowedWebPushEndpoint(subscription.endpoint)
  ) {
    return;
  }

  const keys = await getVapidKeys();
  webPush.setVapidDetails("https://myage.beauty", keys.publicKey, keys.privateKey);
  try {
    await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60, urgency: "high" },
    );
  } catch (error) {
    const statusCode =
      typeof error === "object" && error !== null && "statusCode" in error
        ? Number((error as { statusCode?: unknown }).statusCode)
        : 0;
    if (statusCode === 404 || statusCode === 410) {
      await db
        .delete(vibeSwipePushSubscriptionsTable)
        .where(eq(vibeSwipePushSubscriptionsTable.id, subscription.id));
      return;
    }
    throw error;
  }
}

async function sendExpoPush(
  subscription: { id: string; expoToken: string | null },
  payload: ReturnType<typeof buildMessagePushPayload>,
): Promise<void> {
  if (!subscription.expoToken || !isValidExpoPushToken(subscription.expoToken)) {
    return;
  }
  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      to: subscription.expoToken,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      sound: "default",
      priority: "high",
      channelId: "messages",
    }),
  });
  if (!response.ok) {
    throw new Error(`Expo push service returned ${response.status}.`);
  }
  const result = (await response.json()) as {
    data?: { status?: string; message?: string; details?: { error?: string } };
  };
  if (result.data?.status === "error") {
    if (result.data.details?.error === "DeviceNotRegistered") {
      await db
        .delete(vibeSwipePushSubscriptionsTable)
        .where(eq(vibeSwipePushSubscriptionsTable.id, subscription.id));
      return;
    }
    throw new Error(result.data.message ?? "Expo push delivery failed.");
  }
}

export async function sendMessagePush(input: {
  recipientId: string;
  senderId: string;
  matchId: string;
  content: string;
  mediaType?: string | null;
}): Promise<void> {
  const subscriptions = await db
    .select({
      id: vibeSwipePushSubscriptionsTable.id,
      platform: vibeSwipePushSubscriptionsTable.platform,
      endpoint: vibeSwipePushSubscriptionsTable.endpoint,
      p256dh: vibeSwipePushSubscriptionsTable.p256dh,
      auth: vibeSwipePushSubscriptionsTable.auth,
      expoToken: vibeSwipePushSubscriptionsTable.expoToken,
    })
    .from(vibeSwipePushSubscriptionsTable)
    .where(eq(vibeSwipePushSubscriptionsTable.userId, input.recipientId));
  if (subscriptions.length === 0) return;

  const [sender] = await db
    .select({ name: profilesTable.name })
    .from(profilesTable)
    .where(eq(profilesTable.id, input.senderId))
    .limit(1);
  const payload = buildMessagePushPayload({
    matchId: input.matchId,
    senderName: sender?.name ?? "New message",
    content: input.content,
    mediaType: input.mediaType,
  });
  const results = await Promise.allSettled(
    subscriptions.map((subscription) =>
      subscription.platform === "web"
        ? sendWebPush(subscription, payload)
        : sendExpoPush(subscription, payload),
    ),
  );
  const failures = results.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failures.length) {
    throw new AggregateError(
      failures.map((failure) => failure.reason),
      `${failures.length} of ${subscriptions.length} push notification deliveries failed.`,
    );
  }
}
