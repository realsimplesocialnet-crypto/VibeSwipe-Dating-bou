import { getAuth } from "@clerk/express";
import {
  BlockProfileBody,
  CreateReactionBody,
  CreateReactionResponse,
  GetOnboardingDraftResponse,
  GetDailyLikeStatusResponse,
  GetIcebreakersResponse,
  GetSuperLikeStatusResponse,
  GetVibeSwipeSettingsResponse,
  SearchTravelCitiesQueryParams,
  SearchTravelCitiesResponse,
  ClearChatParams,
  ClearChatResponse,
  DeleteChatParams,
  DeleteChatResponse,
  DeleteMessageBody,
  DeleteMessageParams,
  DeleteMessageResponse,
  GetBlockedProfilesResponse,
  GetBoostStatusResponse,
  GetDiscoverProfilesQueryParams,
  GetDiscoverProfilesResponse,
  GetMatchesResponse,
  GetMessagesParams,
  GetMessagesResponse,
  GetMyProfileResponse,
  GetProfileMediaParams,
  GetTypingStatusParams,
  GetTypingStatusResponse,
  Message,
  Profile,
  ReportProfileBody,
  ReportProfileResponse,
  RequestChatMediaUploadBody,
  RequestChatMediaUploadParams,
  RequestChatMediaUploadResponse,
  TranscodeProfileVideoParams,
  TranscodeProfileVideoResponse,
  UnmatchMatchParams,
  RequestProfileMediaUploadBody,
  RequestProfileMediaUploadResponse,
  SaveMyProfileBody,
  SaveMyProfileResponse,
  SaveOnboardingDraftBody,
  SaveOnboardingDraftResponse,
  SendMessageBody,
  SendMessageParams,
  SendMessageResponse,
  UndoLastPassResponse,
  UnblockProfileParams,
  UnblockProfileResponse,
  BlockProfileResponse,
  UnmatchMatchResponse,
  UpdateChatThemeBody,
  UpdateChatThemeParams,
  UpdateChatThemeResponse,
  UpdateVibeSwipeSettingsBody,
  UpdateVibeSwipeSettingsResponse,
  ActivateBoostResponse,
  UpdateTypingStatusBody,
  UpdateTypingStatusParams,
  UpdateTypingStatusResponse,
} from "@workspace/api-zod";
import {
  blocksTable,
  db,
  dailyLikeUsageTable,
  icebreakersTable,
  matchUserStateTable,
  matchesTable,
  mediaAssetsTable,
  messagesTable,
  messageHiddenByUserTable,
  profileSetupDraftsTable,
  pool,
  profilesTable,
  reactionsTable,
  reportsTable,
  storiesTable,
  vibeSwipeNotificationsTable,
  vibeSwipeReadReceiptsTable,
} from "@workspace/db";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lte,
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "node:stream";
import { logger } from "../lib/logger";
import {
  ObjectNotFoundError,
  ObjectStorageService,
} from "../lib/objectStorage";
import { removeUnreferencedProfileMedia } from "../lib/profileMediaCleanup";
import { removedProfilePhotoMediaIds } from "../lib/profileMediaReferences";
import {
  MAX_PROFILE_VIDEO_SOURCE_BYTES,
  ProfileVideoValidationError,
  transcodeProfileVideo,
} from "../lib/profileVideoTranscoder";
import { requireAuth } from "../middlewares/auth";
import { createVibeSwipeNotification } from "../lib/vibeswipeNotifications";
import { notificationPreferenceEnabled, planReactionEffects } from "../lib/vibeswipeReaction";
import {
  canSubscribeToChat,
  CHAT_EVENT_CHANNEL,
  ChatMessageStreams,
  messagesAfterCursor,
} from "../lib/chatEventStream";
import { sendMessagePush } from "../lib/vibeswipePush";
import { buildProfileValues } from "../lib/profileSetup";
import {
  distanceBetweenCities,
  findRealTravelCity,
  resolvePreferredDiscoveryArea,
  searchRealTravelCities,
} from "../lib/travelCities";
import { getUnblockedMatchBetween } from "../lib/vibeswipeStories";
import { canViewStory } from "../lib/vibeswipeStoryRules";
import { automaticDiscovery, countryValues, discoveryTier, minimumDiscoveryPool, regionalCountryValues, smartDiscoveryPool } from "../lib/discovery-pool";
import { discoveryExcludedIds } from "../lib/discovery-exclusions";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();
const messageStreams = new ChatMessageStreams<Message>();
type ChatEvent =
  | { type: "message"; matchId: string; messageId: string }
  | { type: "typing"; matchId: string }
  | { type: "presence"; matchId: string }
  | { type: "close"; matchId: string };
type NotificationClient = { release(error?: Error | boolean): void };
let notificationClient: NotificationClient | null = null;
let notificationConnection: Promise<void> | null = null;
let notificationRetryTimer: NodeJS.Timeout | null = null;
let notificationQueue = Promise.resolve();
const defaultPreferences = {
  ageMin: 22,
  ageMax: 35,
  gender: "Everyone",
  distanceKm: 50,
};
const DAILY_LIKE_LIMIT = 50;
const DAILY_LIKE_RESET_MS = 24 * 60 * 60 * 1000;

const demoProfiles = [
  {
    id: "demo-vibeswipe-ava",
    name: "Ava",
    age: 27,
    gender: "Woman",
    lookingFor: "Everyone",
    bio: "Bookshop browser, weekend baker, and always up for a sunset walk.",
    city: "Lagos",
    interests: ["Art", "Coffee", "Travel"],
    photos: ["demo:profile-one"],
  },
  {
    id: "demo-vibeswipe-jules",
    name: "Jules",
    age: 30,
    gender: "Man",
    lookingFor: "Everyone",
    bio: "Good playlists, little restaurants, and plans that turn into stories.",
    city: "Lagos",
    interests: ["Music", "Food", "Design"],
    photos: ["demo:profile-two"],
  },
];

router.use(requireAuth);

function currentUserId(req: Request): string {
  const userId = getAuth(req).userId;
  if (!userId) throw new Error("Authenticated user is missing from the request");
  return userId;
}

function writeMessageToStreams(matchId: string, message: Message): void {
  messageStreams.publish(matchId, message);
}

function closeStreams(matchId: string): void {
  messageStreams.close(matchId);
}

function reconnectStreamsAfterNotificationDisconnect(): void {
  messageStreams.closeAll();
}

async function handleChatEvent(event: ChatEvent): Promise<void> {
  if (event.type === "close") {
    closeStreams(event.matchId);
    return;
  }
  if (event.type === "typing" || event.type === "presence") {
    messageStreams.publishEvent(event.matchId, event.type);
    return;
  }
  const [message] = await db
    .select()
    .from(messagesTable)
    .where(
      and(
        eq(messagesTable.id, event.messageId),
        eq(messagesTable.matchId, event.matchId),
      ),
    )
    .limit(1);
  if (message) writeMessageToStreams(event.matchId, projectMessage(message));
}

function parseChatEvent(payload: string | undefined): ChatEvent | null {
  if (!payload) return null;
  try {
    const parsed: unknown = JSON.parse(payload);
    if (!parsed || typeof parsed !== "object") return null;
    const event = parsed as Record<string, unknown>;
    if (
      typeof event.matchId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        event.matchId,
      )
    ) {
      return null;
    }
    if (event.type === "close") {
      return { type: "close", matchId: event.matchId };
    }
    if (event.type === "typing" || event.type === "presence") {
      return { type: event.type, matchId: event.matchId };
    }
    if (
      event.type === "message" &&
      typeof event.messageId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        event.messageId,
      )
    ) {
      return {
        type: "message",
        matchId: event.matchId,
        messageId: event.messageId,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function scheduleNotificationReconnect(): void {
  if (notificationRetryTimer) return;
  notificationRetryTimer = setTimeout(() => {
    notificationRetryTimer = null;
    void ensureNotificationListener().catch((error: unknown) => {
      logger.error({ err: error }, "Unable to reconnect chat notifications");
    });
  }, 1_000);
  notificationRetryTimer.unref();
}

async function connectNotificationListener(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`LISTEN ${CHAT_EVENT_CHANNEL}`);
    notificationClient = client;
    client.on("notification", (notification) => {
      if (notification.channel !== CHAT_EVENT_CHANNEL) return;
      const event = parseChatEvent(notification.payload);
      if (!event) return;
      notificationQueue = notificationQueue
        .then(() => handleChatEvent(event))
        .catch((error: unknown) => {
          logger.error({ err: error }, "Unable to deliver a chat notification");
        });
    });
    const handleDisconnect = (error?: Error): void => {
      if (notificationClient !== client) return;
      notificationClient = null;
      client.release(true);
      reconnectStreamsAfterNotificationDisconnect();
      if (error) logger.warn({ err: error }, "Chat notification listener disconnected");
      scheduleNotificationReconnect();
    };
    client.on("error", handleDisconnect);
    client.on("end", () => handleDisconnect());
  } catch (error) {
    client.release(true);
    throw error;
  }
}

function ensureNotificationListener(): Promise<void> {
  if (notificationClient) return Promise.resolve();
  if (!notificationConnection) {
    notificationConnection = connectNotificationListener().finally(() => {
      notificationConnection = null;
    });
  }
  return notificationConnection;
}

function projectMessage(
  row: typeof messagesTable.$inferSelect,
  isRead = false,
): Message {
  const deleted = row.deletedForEveryone;
  return {
    ...row,
    content: deleted ? "This message was deleted" : row.content,
    mediaReference: deleted ? null : row.mediaReference,
    mediaType: deleted ? null : (row.mediaType as Message["mediaType"]),
    mediaDuration: deleted ? null : row.mediaDuration,
    deletedForEveryone: deleted,
    isRead,
  };
}

async function seedDemoProfiles(): Promise<void> {
  if (process.env.NODE_ENV === "production") return;
  await db
    .insert(profilesTable)
    .values(
      demoProfiles.map((profile) => ({
        ...profile,
        isDemo: true,
        preferences: defaultPreferences,
      })),
    )
    .onConflictDoNothing();
}

async function isBlockedBetween(userA: string, userB: string): Promise<boolean> {
  const [block] = await db
    .select({ id: blocksTable.id })
    .from(blocksTable)
    .where(
      or(
        and(eq(blocksTable.blockerId, userA), eq(blocksTable.blockedId, userB)),
        and(eq(blocksTable.blockerId, userB), eq(blocksTable.blockedId, userA)),
      ),
    )
    .limit(1);
  return !!block;
}

async function getMatchForUser(matchId: string, userId: string) {
  const [match] = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.id, matchId))
    .limit(1);
  if (!match || (match.userAId !== userId && match.userBId !== userId)) {
    return null;
  }
  return match;
}

type MatchUserStateValues = Partial<
  Pick<
    typeof matchUserStateTable.$inferInsert,
    "hiddenAt" | "clearedAt" | "typingUntil" | "chatTheme"
  >
>;

async function getMatchUserState(matchId: string, userId: string) {
  const [state] = await db
    .select()
    .from(matchUserStateTable)
    .where(
      and(
        eq(matchUserStateTable.matchId, matchId),
        eq(matchUserStateTable.userId, userId),
      ),
    )
    .limit(1);
  return state;
}

async function saveMatchUserState(
  matchId: string,
  userId: string,
  values: MatchUserStateValues,
): Promise<void> {
  await db
    .insert(matchUserStateTable)
    .values({ matchId, userId, ...values })
    .onConflictDoUpdate({
      target: [matchUserStateTable.userId, matchUserStateTable.matchId],
      set: values,
    });
}

async function getDailyLikeStatus(userId: string) {
  const [usage] = await db
    .select()
    .from(dailyLikeUsageTable)
    .where(eq(dailyLikeUsageTable.userId, userId))
    .limit(1);
  const now = new Date();
  if (usage?.resetAt && usage.resetAt <= now) {
    await db
      .update(dailyLikeUsageTable)
      .set({ likeCount: 0, resetAt: null })
      .where(eq(dailyLikeUsageTable.userId, userId));
    return { limit: DAILY_LIKE_LIMIT, remaining: DAILY_LIKE_LIMIT, resetAt: null };
  }
  return {
    limit: DAILY_LIKE_LIMIT,
    remaining: Math.max(0, DAILY_LIKE_LIMIT - (usage?.likeCount ?? 0)),
    resetAt: usage?.resetAt ?? null,
  };
}

router.get("/vibeswipe/onboarding/draft", async (req, res): Promise<void> => {
  const [draft] = await db
    .select({
      step: profileSetupDraftsTable.step,
      data: profileSetupDraftsTable.data,
      updatedAt: profileSetupDraftsTable.updatedAt,
    })
    .from(profileSetupDraftsTable)
    .where(eq(profileSetupDraftsTable.userId, currentUserId(req)))
    .limit(1);
  res.json(
    GetOnboardingDraftResponse.parse(
      draft ?? { step: 1, data: {}, updatedAt: null },
    ),
  );
});

router.put("/vibeswipe/onboarding/draft", async (req, res): Promise<void> => {
  const parsed = SaveOnboardingDraftBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = currentUserId(req);
  const [completedProfile] = await db
    .select({ id: profilesTable.id })
    .from(profilesTable)
    .where(eq(profilesTable.id, userId))
    .limit(1);
  if (completedProfile) {
    res.status(409).json({ error: "Profile setup is already complete." });
    return;
  }
  const draftMediaIds = [
    ...new Set(
      JSON.stringify(parsed.data.data)
        .match(/media:([0-9a-f-]{36})/gi)
        ?.map((value) => value.slice("media:".length)) ?? [],
    ),
  ];
  const draft = await db.transaction(async (tx) => {
    if (draftMediaIds.length > 0) {
      const ownedMedia = await tx
        .select({ id: mediaAssetsTable.id })
        .from(mediaAssetsTable)
        .where(
          and(
            eq(mediaAssetsTable.ownerId, userId),
            isNull(mediaAssetsTable.matchId),
            inArray(mediaAssetsTable.id, draftMediaIds),
          ),
        )
        .for("key share");
      if (ownedMedia.length !== draftMediaIds.length) return null;
    }
    const [savedDraft] = await tx
      .insert(profileSetupDraftsTable)
      .values({
        userId,
        step: parsed.data.step,
        data: parsed.data.data,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: profileSetupDraftsTable.userId,
        set: {
          step: parsed.data.step,
          data: parsed.data.data,
          updatedAt: new Date(),
        },
      })
      .returning({
        step: profileSetupDraftsTable.step,
        data: profileSetupDraftsTable.data,
        updatedAt: profileSetupDraftsTable.updatedAt,
      });
    return savedDraft ?? null;
  });
  if (!draft) {
    res.status(400).json({ error: "Draft media must belong to you." });
    return;
  }
  res.json(SaveOnboardingDraftResponse.parse(draft));
});

router.delete("/vibeswipe/onboarding/draft", async (req, res): Promise<void> => {
  await db
    .delete(profileSetupDraftsTable)
    .where(eq(profileSetupDraftsTable.userId, currentUserId(req)));
  res.status(204).end();
});

router.get("/vibeswipe/me", async (req, res): Promise<void> => {
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, currentUserId(req)))
    .limit(1);
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(GetMyProfileResponse.parse(profile));
});

router.put("/vibeswipe/me", async (req, res): Promise<void> => {
  const parsed = SaveMyProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = currentUserId(req);
  const body = parsed.data;
  if (body.age < 18) {
    res.status(400).json({ error: "VibeSwipe is for adults 18 and older." });
    return;
  }

  const references = [
    ...body.photos,
    ...(body.videoUrl ? [body.videoUrl] : []),
  ];
  const mediaIds = references
    .filter((value) => value.startsWith("media:"))
    .map((value) => value.slice("media:".length));
  if (references.some((value) => !value.startsWith("media:"))) {
    res.status(400).json({ error: "Upload profile media before saving it." });
    return;
  }
  const values = buildProfileValues(userId, body);
  const result = await db.transaction(async (tx) => {
    const [existingProfile] = await tx
      .select({ photos: profilesTable.photos })
      .from(profilesTable)
      .where(eq(profilesTable.id, userId))
      .for("update")
      .limit(1);
    const removedMediaIds = removedProfilePhotoMediaIds(existingProfile?.photos ?? [], body.photos);
    const uniqueMediaIds = [...new Set(mediaIds)];
    if (uniqueMediaIds.length > 0) {
      const ownedMedia = await tx
        .select({ id: mediaAssetsTable.id, mediaType: mediaAssetsTable.mediaType })
        .from(mediaAssetsTable)
        .where(
          and(
            eq(mediaAssetsTable.ownerId, userId),
            isNull(mediaAssetsTable.matchId),
            inArray(mediaAssetsTable.id, uniqueMediaIds),
          ),
        )
        .for("key share");
      if (ownedMedia.length !== uniqueMediaIds.length) {
        return { invalidMedia: true as const };
      }
      const photoIds = new Set(body.photos.map((reference) => reference.slice("media:".length)));
      if (ownedMedia.some((asset) => photoIds.has(asset.id) && asset.mediaType !== "image")) {
        return { invalidPhoto: true as const };
      }
    }
    const [profile] = await tx
      .insert(profilesTable)
      .values(values)
      .onConflictDoUpdate({
        target: profilesTable.id,
        set: {
          ...values,
          // A badge confirms ownership of the main photo, not arbitrary future photos.
          ...(existingProfile?.photos[0] !== body.photos[0] ? { isVerified: false } : {}),
        },
      })
      .returning();
    if (!profile) return { invalidMedia: false as const, profile: null };
    await tx
      .delete(profileSetupDraftsTable)
      .where(eq(profileSetupDraftsTable.userId, userId));
    return { invalidMedia: false as const, profile, removedMediaIds };
  });
  if ("invalidPhoto" in result && result.invalidPhoto) {
    res.status(400).json({ error: "Choose a profile picture, not a video." });
    return;
  }
  if (result.invalidMedia) {
    res.status(400).json({ error: "Profile media must belong to you." });
    return;
  }
  if (!result.profile) {
    res.status(500).json({ error: "Profile could not be saved." });
    return;
  }
  for (const mediaId of result.removedMediaIds) {
    try {
      await removeUnreferencedProfileMedia(mediaId, userId);
    } catch (error) {
      // The profile update is committed; leave failed object deletions for the cleanup retry.
      logger.error({ err: error, mediaId }, "Could not remove a deleted profile photo");
    }
  }
  res.json(SaveMyProfileResponse.parse(result.profile));
});

router.get("/vibeswipe/settings", async (req, res): Promise<void> => {
  const [profile] = await db
    .select({
      incognito: profilesTable.incognito,
      showAge: profilesTable.showAge,
      showDistance: profilesTable.showDistance,
      notifyMatches: profilesTable.notifyMatches,
      notifyLikes: sql<boolean>`coalesce(${profilesTable.notifyLikes}, ${profilesTable.notifyMatches})`,
      notifyMessages: profilesTable.notifyMessages,
      notifyProfileViews: profilesTable.notifyProfileViews,
      darkMode: profilesTable.darkMode,
      language: profilesTable.language,
      deactivated: profilesTable.deactivated,
      travelMode: profilesTable.travelMode,
      travelCity: profilesTable.travelCity,
    })
    .from(profilesTable)
    .where(eq(profilesTable.id, currentUserId(req)))
    .limit(1);
  if (!profile) {
    res.status(404).json({ error: "Profile not found." });
    return;
  }
  res.json(GetVibeSwipeSettingsResponse.parse(profile));
});

router.get("/vibeswipe/travel-cities", async (req, res): Promise<void> => {
  const query = SearchTravelCitiesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  res.json(SearchTravelCitiesResponse.parse(searchRealTravelCities(query.data.search)));
});

router.put("/vibeswipe/settings", async (req, res): Promise<void> => {
  const body = UpdateVibeSwipeSettingsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const userId = currentUserId(req);
  const [current] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, userId))
    .limit(1);
  if (!current) {
    res.status(404).json({ error: "Profile not found." });
    return;
  }
  const travelMode = body.data.travelMode ?? current.travelMode;
  const submittedCity =
    body.data.travelCity === undefined
      ? current.travelCity
      : body.data.travelCity?.trim() || null;
  const travelCity = submittedCity ? findRealTravelCity(submittedCity) : null;
  if (submittedCity && !travelCity) {
    res.status(400).json({ error: "Choose a real city from the suggestions." });
    return;
  }
  const [profile] = await db
    .update(profilesTable)
    .set({
      incognito: body.data.incognito ?? current.incognito,
      showAge: body.data.showAge ?? current.showAge,
      showDistance: body.data.showDistance ?? current.showDistance,
      notifyMatches: body.data.notifyMatches ?? current.notifyMatches,
      // Freeze the legacy fallback before changing Matches so the switches stay independent.
      notifyLikes: body.data.notifyLikes ?? current.notifyLikes ?? current.notifyMatches,
      notifyMessages: body.data.notifyMessages ?? current.notifyMessages,
      notifyProfileViews:
        body.data.notifyProfileViews ?? current.notifyProfileViews,
      darkMode: body.data.darkMode ?? current.darkMode,
      language: body.data.language ?? current.language,
      deactivated: body.data.deactivated ?? current.deactivated,
      travelMode,
      travelCity: travelMode ? travelCity : null,
      updatedAt: new Date(),
    })
    .where(eq(profilesTable.id, userId))
    .returning({
      incognito: profilesTable.incognito,
      showAge: profilesTable.showAge,
      showDistance: profilesTable.showDistance,
      notifyMatches: profilesTable.notifyMatches,
      notifyLikes: sql<boolean>`coalesce(${profilesTable.notifyLikes}, ${profilesTable.notifyMatches})`,
      notifyMessages: profilesTable.notifyMessages,
      notifyProfileViews: profilesTable.notifyProfileViews,
      darkMode: profilesTable.darkMode,
      language: profilesTable.language,
      deactivated: profilesTable.deactivated,
      travelMode: profilesTable.travelMode,
      travelCity: profilesTable.travelCity,
    });
  if (!profile) {
    res.status(404).json({ error: "Profile not found." });
    return;
  }
  res.json(UpdateVibeSwipeSettingsResponse.parse(profile));
});

router.get("/vibeswipe/icebreakers", async (_req, res): Promise<void> => {
  const prompts = [
    "What’s your favorite thing to do on weekends?",
    "Coffee or drinks?",
    "What song are you playing on repeat?",
  ];
  const [active] = await db
    .select({ id: icebreakersTable.id })
    .from(icebreakersTable)
    .where(eq(icebreakersTable.isActive, true))
    .limit(1);
  if (!active) {
    await db
      .insert(icebreakersTable)
      .values(prompts.map((question) => ({ question })))
      .onConflictDoNothing({ target: icebreakersTable.question });
  }
  const rows = await db
    .select({ id: icebreakersTable.id, question: icebreakersTable.question })
    .from(icebreakersTable)
    .where(eq(icebreakersTable.isActive, true))
    .orderBy(asc(icebreakersTable.createdAt));
  res.json(GetIcebreakersResponse.parse(rows));
});

router.get("/vibeswipe/super-likes", async (req, res): Promise<void> => {
  const userId = currentUserId(req);
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [recent] = await db
    .select({ createdAt: reactionsTable.createdAt })
    .from(reactionsTable)
    .where(
      and(
        eq(reactionsTable.fromUserId, userId),
        eq(reactionsTable.type, "super"),
        gt(reactionsTable.createdAt, cutoff),
      ),
    )
    .orderBy(desc(reactionsTable.createdAt))
    .limit(1);
  const resetsAt = recent
    ? new Date(recent.createdAt.getTime() + 24 * 60 * 60 * 1000)
    : null;
  res.json(
    GetSuperLikeStatusResponse.parse({
      remaining: recent ? 0 : 1,
      resetsAt,
    }),
  );
});

router.get("/vibeswipe/likes/status", async (req, res): Promise<void> => {
  const status = await getDailyLikeStatus(currentUserId(req));
  res.json(GetDailyLikeStatusResponse.parse(status));
});

router.get("/vibeswipe/boost", async (req, res): Promise<void> => {
  const [profile] = await db
    .select({
      boostStartTime: profilesTable.boostStartTime,
      boostEndTime: profilesTable.boostEndTime,
      nextBoostAvailableTime: profilesTable.nextBoostAvailableTime,
    })
    .from(profilesTable)
    .where(eq(profilesTable.id, currentUserId(req)))
    .limit(1);
  if (!profile) {
    res.status(404).json({ error: "Profile not found." });
    return;
  }
  const now = new Date();
  const active = Boolean(
    profile.boostStartTime &&
      profile.boostEndTime &&
      profile.boostStartTime.getTime() <= now.getTime() &&
      profile.boostEndTime.getTime() > now.getTime(),
  );
  res.json(
    GetBoostStatusResponse.parse({
      active,
      available:
        !active &&
        (!profile.nextBoostAvailableTime ||
          profile.nextBoostAvailableTime.getTime() <= now.getTime()),
      boostStartTime: profile.boostStartTime,
      boostEndTime: profile.boostEndTime,
      nextBoostAvailableTime: profile.nextBoostAvailableTime,
    }),
  );
});

router.post("/vibeswipe/boost", async (req, res): Promise<void> => {
  const userId = currentUserId(req);
  const [profile] = await db
    .select({
      boostEndTime: profilesTable.boostEndTime,
      nextBoostAvailableTime: profilesTable.nextBoostAvailableTime,
    })
    .from(profilesTable)
    .where(eq(profilesTable.id, userId))
    .limit(1);
  if (!profile) {
    res.status(404).json({ error: "Profile not found." });
    return;
  }
  const now = new Date();
  if (
    (profile.boostEndTime && profile.boostEndTime > now) ||
    (profile.nextBoostAvailableTime && profile.nextBoostAvailableTime > now)
  ) {
    res.status(409).json({ error: "Boost is active or still cooling down." });
    return;
  }
  const boostEndTime = new Date(now.getTime() + 30 * 60 * 1000);
  const nextBoostAvailableTime = new Date(boostEndTime.getTime() + 24 * 60 * 60 * 1000);
  const [updated] = await db
    .update(profilesTable)
    .set({
      boostStartTime: now,
      boostEndTime,
      nextBoostAvailableTime,
      updatedAt: now,
    })
    .where(eq(profilesTable.id, userId))
    .returning({
      boostStartTime: profilesTable.boostStartTime,
      boostEndTime: profilesTable.boostEndTime,
      nextBoostAvailableTime: profilesTable.nextBoostAvailableTime,
    });
  const response = {
    active: true,
    available: false,
    ...updated,
  };
  res.json(ActivateBoostResponse.parse(response));
});

router.delete("/vibeswipe/reactions/undo", async (req, res): Promise<void> => {
  const userId = currentUserId(req);
  const [latest] = await db
    .select({
      id: reactionsTable.id,
      toUserId: reactionsTable.toUserId,
      type: reactionsTable.type,
    })
    .from(reactionsTable)
    .where(eq(reactionsTable.fromUserId, userId))
    .orderBy(desc(reactionsTable.createdAt), desc(reactionsTable.id))
    .limit(1);
  if (!latest || latest.type !== "pass") {
    res.json(UndoLastPassResponse.parse({ undone: false, targetUserId: null }));
    return;
  }
  await db.delete(reactionsTable).where(eq(reactionsTable.id, latest.id));
  res.json(
    UndoLastPassResponse.parse({
      undone: true,
      targetUserId: latest.toUserId,
    }),
  );
});

router.get("/vibeswipe/discover", async (req, res): Promise<void> => {
  const params = GetDiscoverProfilesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = currentUserId(req);
  const [ownProfile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, userId))
    .limit(1);
  if (!ownProfile) {
    res.status(409).json({ error: "Complete your profile before discovering." });
    return;
  }

  await seedDemoProfiles();
  const ageMin = params.data.ageMin ?? ownProfile.preferences.ageMin;
  const ageMax = params.data.ageMax ?? ownProfile.preferences.ageMax;
  if (ageMin > ageMax) {
    res.status(400).json({ error: "The minimum age must not exceed the maximum age." });
    return;
  }
  const gender = params.data.gender ?? ownProfile.preferences.gender;
  const area = resolvePreferredDiscoveryArea({
    travelMode: ownProfile.travelMode,
    travelCity: ownProfile.travelCity,
    requestedCountry: params.data.country,
    requestedState: params.data.state,
    requestedCity: params.data.city,
    preference: ownProfile.preferences.discoveryLocation,
    homeCountry: ownProfile.country,
    homeState: ownProfile.state,
    homeCity: ownProfile.city,
  });
  const baseConditions: SQL[] = [
    gte(profilesTable.age, ageMin),
    lte(profilesTable.age, ageMax),
    eq(profilesTable.deactivated, false),
    eq(profilesTable.adminSuspended, false),
  ];
  if (gender && gender !== "Everyone") {
    baseConditions.push(eq(profilesTable.gender, gender));
  }

  const [reacted, blockRows, incognitoLikes, incomingSuperLikes] = await Promise.all([
    db
      .select({ id: reactionsTable.toUserId, type: reactionsTable.type })
      .from(reactionsTable)
      .where(eq(reactionsTable.fromUserId, userId)),
    db
      .select()
      .from(blocksTable)
      .where(
        or(
          eq(blocksTable.blockerId, userId),
          eq(blocksTable.blockedId, userId),
        ),
      ),
    db
      .select({ id: reactionsTable.fromUserId })
      .from(reactionsTable)
      .where(
        and(
          eq(reactionsTable.toUserId, userId),
          inArray(reactionsTable.type, ["like", "super"]),
        ),
      ),
    db
      .select({ id: reactionsTable.fromUserId })
      .from(reactionsTable)
      .where(
        and(
          eq(reactionsTable.toUserId, userId),
          eq(reactionsTable.type, "super"),
        ),
      ),
  ]);
  const excludedIds = discoveryExcludedIds({
    viewerId: userId, reactions: reacted, blocks: blockRows,
    includePassed: params.data.includePassed === "true",
    hasRequestedLocation: Boolean(params.data.country?.trim() || params.data.state?.trim() || params.data.city?.trim()),
    travelMode: ownProfile.travelMode,
  });
  const allowedIncognitoIds = new Set(incognitoLikes.map((row) => row.id));
  const superLikedUserIds = new Set(incomingSuperLikes.map((row) => row.id));

  const normalizedLocation = (
    column:
      | typeof profilesTable.city
      | typeof profilesTable.country
      | typeof profilesTable.state,
    value: string,
  ): SQL => sql`LOWER(TRIM(${column})) = ${value.trim().toLocaleLowerCase()}`;
  const countryFilter = area.country
    ? inArray(sql`LOWER(TRIM(${profilesTable.country}))`, countryValues(area.country))
    : null;
  const stateFilter = area.state
    ? normalizedLocation(profilesTable.state, area.state)
    : null;
  const cityFilter = area.city
    ? normalizedLocation(profilesTable.city, area.city)
    : null;

  const queryCandidates = async (
    locationConditions: SQL[],
    limit?: number,
    additionallyExcluded: string[] = [],
  ) => {
    const conditions: SQL[] = [...baseConditions, ...locationConditions];
    if (excludedIds.size || additionallyExcluded.length) {
      conditions.push(
        notInArray(
          profilesTable.id,
          [...excludedIds, ...additionallyExcluded],
        ),
      );
    }
    const allowedIncognito = [...allowedIncognitoIds];
    conditions.push(
      allowedIncognito.length
        ? or(
            eq(profilesTable.incognito, false),
            inArray(profilesTable.id, allowedIncognito),
          )!
        : eq(profilesTable.incognito, false),
    );
    const query = db
      .select()
      .from(profilesTable)
      .where(and(...conditions))
      .orderBy(desc(sql`CASE WHEN ${profilesTable.boostEndTime} > NOW() THEN 1 ELSE 0 END`), profilesTable.id);
    return limit === undefined ? query : query.limit(limit);
  };

  let candidates: Awaited<ReturnType<typeof queryCandidates>> = [];
  const smartDefault = automaticDiscovery({
    travelMode: ownProfile.travelMode, requestedCountry: params.data.country,
    requestedState: params.data.state,
    requestedCity: params.data.city, preference: ownProfile.preferences.discoveryLocation,
  });
  if (smartDefault) {
    const regionalValues = ownProfile.country ? regionalCountryValues(ownProfile.country) : [];
    candidates = await smartDiscoveryPool(minimumDiscoveryPool(process.env.VIBESWIPE_DISCOVERY_MIN_POOL_SIZE),
      async (tier, limit, excluded) => {
        if (tier === 0) return countryFilter ? queryCandidates([countryFilter], limit, excluded) : [];
        if (tier === 1) return regionalValues.length
          ? queryCandidates([inArray(sql`LOWER(TRIM(${profilesTable.country}))`, regionalValues)], limit, excluded)
          : [];
        return queryCandidates([], limit, excluded);
      });
  }
  const hasSafeLocation = Boolean(area.country || ownProfile.travelMode);
  if (smartDefault) {
    // The smart pool is already filled; explicit saved/requested areas stay strict below.
  } else if (hasSafeLocation && area.scope === "city" && cityFilter) {
    const selectedCity = area.city!;
    const cityConditions = [
      ...(countryFilter ? [countryFilter] : []),
      ...(stateFilter ? [stateFilter] : []),
      cityFilter,
    ];
    const cityProfiles = await queryCandidates(cityConditions, 100);
    candidates = [...cityProfiles];

    // If the city has fewer than one full stack, fill only from its saved state.
    // An explicitly saved city may widen only to its saved state.
    if (candidates.length < 100 && area.country && area.state && !params.data.city?.trim()) {
      const stateFallbackConditions: SQL[] = [
        countryFilter!,
        stateFilter!,
        sql`LOWER(TRIM(${profilesTable.city})) <> ${selectedCity.trim().toLocaleLowerCase()}`,
      ];
      const stateProfiles = await queryCandidates(
        stateFallbackConditions,
        100 - candidates.length,
        cityProfiles.map((profile) => profile.id),
      );
      candidates = [...candidates, ...stateProfiles];
    }
  } else if (hasSafeLocation && area.scope === "state" && countryFilter && stateFilter) {
    candidates = await queryCandidates([countryFilter, stateFilter], 100);
  } else if (hasSafeLocation && area.scope === "country" && countryFilter) {
    candidates = await queryCandidates([countryFilter], 100);
  } else if (
    hasSafeLocation &&
    area.scope === "radius" &&
    area.country &&
    area.city &&
    area.radiusKm
  ) {
    const countryProfiles = await queryCandidates([countryFilter!]);
    candidates = countryProfiles
      .map((profile) => ({
        profile,
        distance: profile.city
          ? distanceBetweenCities(
              { country: area.country!, state: area.state, city: area.city! },
              {
                country: profile.country || area.country!,
                state: profile.state,
                city: profile.city,
              },
            )
          : null,
      }))
      .filter(
        (entry): entry is { profile: (typeof countryProfiles)[number]; distance: number } =>
          entry.distance !== null && entry.distance <= area.radiusKm!,
      )
      .sort((a, b) => a.distance - b.distance)
      .map((entry) => entry.profile)
      .slice(0, 100);
  }

  const profiles = candidates
    .filter(
      (profile) =>
        !excludedIds.has(profile.id) &&
        (!profile.incognito || allowedIncognitoIds.has(profile.id)),
    )
    .map((profile) => ({
      ...profile,
      age: profile.showAge ? profile.age : null,
      superLikedYou: superLikedUserIds.has(profile.id),
      discoveryExpanded: smartDefault && candidates.some(candidate => discoveryTier(ownProfile.country, candidate.country) > 0),
    }))
    .sort((a, b) => {
      if (smartDefault) {
        const locationOrder = discoveryTier(ownProfile.country, a.country) - discoveryTier(ownProfile.country, b.country);
        if (locationOrder) return locationOrder;
      }
      const now = Date.now();
      const aBoosted = Number(Boolean(a.boostEndTime && a.boostEndTime.getTime() > now));
      const bBoosted = Number(Boolean(b.boostEndTime && b.boostEndTime.getTime() > now));
      if (aBoosted !== bBoosted) return bBoosted - aBoosted;
      return (b.boostEndTime?.getTime() ?? 0) - (a.boostEndTime?.getTime() ?? 0);
    });
  res.json(GetDiscoverProfilesResponse.parse(profiles));
});

router.post("/vibeswipe/reactions", async (req, res): Promise<void> => {
  const parsed = CreateReactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = currentUserId(req);
  const { toUserId, type } = parsed.data;
  if (toUserId === userId) {
    res.status(400).json({ error: "You cannot react to your own profile." });
    return;
  }
  const [target] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, toUserId))
    .limit(1);
  if (!target) {
    res.status(404).json({ error: "Profile not found." });
    return;
  }
  if (await isBlockedBetween(userId, toUserId)) {
    res.status(403).json({ error: "This profile is unavailable." });
    return;
  }
  const result = await db.transaction(async (tx) => {
    // Lock both profiles in a stable order. This prevents two simultaneous
    // cross-likes from missing each other and failing to create a match.
    const lockedProfiles = await tx
      .select({ id: profilesTable.id })
      .from(profilesTable)
      .where(inArray(profilesTable.id, [userId, toUserId]))
      .orderBy(profilesTable.id)
      .for("update");
    if (lockedProfiles.length !== 2) {
      return { status: "profile-not-found" as const };
    }

    const [existingReaction] = await tx
      .select({ type: reactionsTable.type })
      .from(reactionsTable)
      .where(
        and(
          eq(reactionsTable.fromUserId, userId),
          eq(reactionsTable.toUserId, toUserId),
        ),
      )
      .limit(1);

    if (type === "like" && existingReaction?.type !== "like") {
      await tx
        .insert(dailyLikeUsageTable)
        .values({ userId, likeCount: 0 })
        .onConflictDoNothing();
      const [usage] = await tx
        .select()
        .from(dailyLikeUsageTable)
        .where(eq(dailyLikeUsageTable.userId, userId))
        .for("update")
        .limit(1);
      if (!usage) throw new Error("Like allowance row could not be loaded.");

      const now = new Date();
      let likeCount = usage.likeCount;
      let resetAt = usage.resetAt;
      if (resetAt && resetAt <= now) {
        likeCount = 0;
        resetAt = null;
      }
      if (likeCount >= DAILY_LIKE_LIMIT) {
        resetAt ??= new Date(now.getTime() + DAILY_LIKE_RESET_MS);
        await tx
          .update(dailyLikeUsageTable)
          .set({ likeCount, resetAt })
          .where(eq(dailyLikeUsageTable.userId, userId));
        return { status: "like-limit" as const, resetAt };
      }

      likeCount += 1;
      if (likeCount >= DAILY_LIKE_LIMIT) {
        resetAt = new Date(now.getTime() + DAILY_LIKE_RESET_MS);
      }
      await tx
        .update(dailyLikeUsageTable)
        .set({ likeCount, resetAt })
        .where(eq(dailyLikeUsageTable.userId, userId));
    }

    if (type === "super") {
      const [recentSuperLike] = await tx
        .select({ createdAt: reactionsTable.createdAt })
        .from(reactionsTable)
        .where(
          and(
            eq(reactionsTable.fromUserId, userId),
            eq(reactionsTable.type, "super"),
            gt(
              reactionsTable.createdAt,
              new Date(Date.now() - 24 * 60 * 60 * 1000),
            ),
          ),
        )
        .orderBy(desc(reactionsTable.createdAt))
        .limit(1);
      if (recentSuperLike) {
        return { status: "super-cooldown" as const };
      }
    }

    await tx
      .insert(reactionsTable)
      .values({ fromUserId: userId, toUserId, type })
      .onConflictDoUpdate({
        target: [reactionsTable.fromUserId, reactionsTable.toUserId],
        set: { type, createdAt: new Date() },
      });

    let reverseType: string | null = null;
    if (type !== "pass" && !(target.isDemo && process.env.NODE_ENV !== "production")) {
      const [reverseReaction] = await tx
        .select({ type: reactionsTable.type })
        .from(reactionsTable)
        .where(
          and(
            eq(reactionsTable.fromUserId, toUserId),
            eq(reactionsTable.toUserId, userId),
          ),
        )
        .limit(1);
      reverseType = reverseReaction?.type ?? null;
    }

    const mutual =
      type !== "pass" &&
      ((target.isDemo && process.env.NODE_ENV !== "production") ||
        reverseType === "like" ||
        reverseType === "super");
    const userAId = userId < toUserId ? userId : toUserId;
    const userBId = userId < toUserId ? toUserId : userId;
    const [existingMatch] = mutual
      ? await tx
          .select({ id: matchesTable.id })
          .from(matchesTable)
          .where(
            and(
              eq(matchesTable.userAId, userAId),
              eq(matchesTable.userBId, userBId),
            ),
          )
          .limit(1)
      : [];
    const effects = planReactionEffects({
      fromUserId: userId,
      toUserId,
      type,
      previousType: existingReaction?.type ?? null,
      reverseType,
      existingMatchId: existingMatch?.id ?? null,
      targetIsDemo: target.isDemo,
      isProduction: process.env.NODE_ENV === "production",
    });

    let matchId = existingMatch?.id ?? null;
    let createdMatch = false;
    if (effects.createMatch) {
      const [match] = await tx
        .insert(matchesTable)
        .values({ userAId, userBId, updatedAt: new Date() })
        .onConflictDoNothing()
        .returning({ id: matchesTable.id });
      if (match) {
        matchId = match.id;
        createdMatch = true;
      } else {
        const [concurrentMatch] = await tx
          .select({ id: matchesTable.id })
          .from(matchesTable)
          .where(
            and(
              eq(matchesTable.userAId, userAId),
              eq(matchesTable.userBId, userBId),
            ),
          )
          .limit(1);
        matchId = concurrentMatch?.id ?? null;
      }
    }

    const notifications = effects.notifications.filter(
      (notification) =>
        notification.type !== "new_match" || (createdMatch && matchId),
    );
    if (notifications.length) {
      const preferences = await tx.select({
        id: profilesTable.id,
        notifyMatches: profilesTable.notifyMatches,
        notifyLikes: profilesTable.notifyLikes,
        notifyMessages: profilesTable.notifyMessages,
        notifyProfileViews: profilesTable.notifyProfileViews,
      }).from(profilesTable).where(inArray(profilesTable.id, notifications.map(n => n.recipientId)));
      const allowed = notifications.filter(n => {
        const settings = preferences.find(p => p.id === n.recipientId);
        return settings && notificationPreferenceEnabled(n.type, settings);
      });
      if (allowed.length) await tx.insert(vibeSwipeNotificationsTable).values(
        allowed.map((notification) => ({
          recipientId: notification.recipientId,
          actorId: notification.actorId,
          type: notification.type,
          matchId: notification.type === "new_match" ? matchId : null,
          messageId: null,
        })),
      );
    }

    return { status: "ok" as const, matched: effects.matched, matchId };
  });

  if (result.status === "profile-not-found") {
    res.status(404).json({ error: "Profile not found." });
    return;
  }
  if (result.status === "like-limit") {
    res.status(429).json({
      error: "You’ve reached your daily like limit. Come back in 24 hours.",
      resetAt: result.resetAt,
    });
    return;
  }
  if (result.status === "super-cooldown") {
    res.status(429).json({ error: "Your next Super Like is not ready yet." });
    return;
  }
  res.json(
    CreateReactionResponse.parse({
      matched: result.matched,
      matchId: result.matchId,
    }),
  );
});

router.get("/vibeswipe/matches", async (req, res): Promise<void> => {
  const userId = currentUserId(req);
  const rows = await db
    .select()
    .from(matchesTable)
    .where(or(eq(matchesTable.userAId, userId), eq(matchesTable.userBId, userId)))
    .orderBy(desc(matchesTable.updatedAt));
  const [states, blockRows, readReceipts] = await Promise.all([
    db
      .select()
      .from(matchUserStateTable)
      .where(eq(matchUserStateTable.userId, userId)),
    db
      .select()
      .from(blocksTable)
      .where(
        or(
          eq(blocksTable.blockerId, userId),
          eq(blocksTable.blockedId, userId),
        ),
      ),
    db.select().from(vibeSwipeReadReceiptsTable)
      .where(eq(vibeSwipeReadReceiptsTable.userId, userId)),
  ]);
  const statesByMatch = new Map(states.map((state) => [state.matchId, state]));
  const readAtByMatch = new Map(readReceipts.map((receipt) => [receipt.matchId, receipt.readAt]));
  const visibleRows = [];
  for (const match of rows) {
    const otherId = match.userAId === userId ? match.userBId : match.userAId;
    const blockedByMe = blockRows.some(
      (block) => block.blockerId === userId && block.blockedId === otherId,
    );
    const blockedMe = blockRows.some(
      (block) => block.blockerId === otherId && block.blockedId === userId,
    );
    const state = statesByMatch.get(match.id);
    const isBlocked = blockedByMe || blockedMe;
    if (
      state?.hiddenAt &&
      state.hiddenAt >= match.updatedAt &&
      !isBlocked
    ) {
      continue;
    }
    const [profile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, otherId))
      .limit(1);
    if (!profile) continue;
    const messageConditions = [eq(messagesTable.matchId, match.id)];
    if (state?.clearedAt) {
      messageConditions.push(gt(messagesTable.createdAt, state.clearedAt));
    }
    const lastMessages = await db
      .select()
      .from(messagesTable)
      .where(and(...messageConditions))
      .orderBy(desc(messagesTable.createdAt))
      .limit(50);
    const hidden = lastMessages.length
      ? await db
          .select({ messageId: messageHiddenByUserTable.messageId })
          .from(messageHiddenByUserTable)
          .where(
            and(
              eq(messageHiddenByUserTable.userId, userId),
              inArray(
                messageHiddenByUserTable.messageId,
                lastMessages.map((message) => message.id),
              ),
            ),
          )
      : [];
    const hiddenIds = new Set(hidden.map((item) => item.messageId));
    const last = lastMessages.find((message) => !hiddenIds.has(message.id));
    const unreadConditions = [
      eq(messagesTable.matchId, match.id),
      eq(messagesTable.senderId, otherId),
      eq(messagesTable.deletedForEveryone, false),
      notInArray(messagesTable.id, db.select({ id: messageHiddenByUserTable.messageId })
        .from(messageHiddenByUserTable).where(eq(messageHiddenByUserTable.userId, userId))),
    ];
    const readAt = readAtByMatch.get(match.id);
    if (readAt) unreadConditions.push(gt(messagesTable.createdAt, readAt));
    if (state?.clearedAt) unreadConditions.push(gt(messagesTable.createdAt, state.clearedAt));
    const [unread] = isBlocked ? [] : await db
      .select({ value: sql<number>`count(*)`.mapWith(Number) })
      .from(messagesTable).where(and(...unreadConditions));
    visibleRows.push({
      id: match.id,
      profile,
      lastMessage: !isBlocked && last
        ? projectMessage(last).content
        : null,
      lastMessageAt: !isBlocked && last ? last.createdAt.toISOString() : null,
      unreadCount: unread?.value ?? 0,
      updatedAt: match.updatedAt,
      blockedByMe,
      blockedMe,
      chatTheme: state?.chatTheme ?? "pink",
    });
  }
  res.json(GetMatchesResponse.parse(visibleRows));
});

router.get(
  "/vibeswipe/matches/:matchId/messages",
  async (req, res): Promise<void> => {
    const params = GetMessagesParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const match = await getMatchForUser(
      params.data.matchId,
      currentUserId(req),
    );
    if (!match) {
      res.status(403).json({ error: "A valid match is required to view chat." });
      return;
    }
    const userId = currentUserId(req);
    if (await isBlockedBetween(match.userAId, match.userBId)) {
      res.status(403).json({ error: "Chat is unavailable while blocked." });
      return;
    }
    const state = await getMatchUserState(match.id, userId);
    const messageConditions = [eq(messagesTable.matchId, match.id)];
    if (state?.clearedAt) {
      messageConditions.push(gt(messagesTable.createdAt, state.clearedAt));
    }
    const messages = await db
      .select()
      .from(messagesTable)
      .where(and(...messageConditions))
      .orderBy(desc(messagesTable.createdAt), desc(messagesTable.id))
      .limit(200);
    const hidden = messages.length
      ? await db
          .select({ messageId: messageHiddenByUserTable.messageId })
          .from(messageHiddenByUserTable)
          .where(
            and(
              eq(messageHiddenByUserTable.userId, userId),
              inArray(
                messageHiddenByUserTable.messageId,
                messages.map((message) => message.id),
              ),
            ),
          )
      : [];
    const hiddenIds = new Set(hidden.map((item) => item.messageId));
    const otherUserId = match.userAId === userId ? match.userBId : match.userAId;
    const [readReceipt] = await db
      .select({ readAt: vibeSwipeReadReceiptsTable.readAt })
      .from(vibeSwipeReadReceiptsTable)
      .where(
        and(
          eq(vibeSwipeReadReceiptsTable.userId, otherUserId),
          eq(vibeSwipeReadReceiptsTable.matchId, match.id),
        ),
      )
      .limit(1);
    res.json(
      GetMessagesResponse.parse(
        messages
          .filter((message) => !hiddenIds.has(message.id))
          .map((message) =>
            projectMessage(
              message,
              message.senderId === userId &&
                !!readReceipt?.readAt &&
                message.createdAt <= readReceipt.readAt,
            ),
          ),
      ),
    );
  },
);

router.get(
  "/vibeswipe/matches/:matchId/messages/events",
  async (req, res): Promise<void> => {
    const params = GetMessagesParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const match = await getMatchForUser(
      params.data.matchId,
      currentUserId(req),
    );
    if (!match) {
      res.status(403).json({ error: "A valid match is required to subscribe to chat." });
      return;
    }
    const userId = currentUserId(req);
    if (!canSubscribeToChat(match, userId, false)) {
      res.status(403).json({ error: "A valid match is required to subscribe to chat." });
      return;
    }
    const blocked = await isBlockedBetween(match.userAId, match.userBId);
    if (!canSubscribeToChat(match, userId, blocked)) {
      res.status(403).json({ error: "Chat is unavailable while blocked." });
      return;
    }
    try {
      await ensureNotificationListener();
    } catch (error) {
      logger.error({ err: error }, "Unable to start chat notifications");
      res.status(503).json({ error: "Chat is temporarily unavailable." });
      return;
    }

    res.status(200);
    res.set({
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();
    res.write("retry: 1500\n\n");

    const removeListener = messageStreams.subscribe(match.id, res);
    const streamState = await getMatchUserState(match.id, userId);
    const keepAlive = setInterval(() => {
      if (!res.destroyed && !res.writableEnded) res.write(": keep-alive\n\n");
    }, 25_000);
    const cleanup = (): void => {
      clearInterval(keepAlive);
      removeListener();
    };
    res.on("close", cleanup);

    const rawAfterId = req.get("Last-Event-ID");
    const afterId =
      typeof rawAfterId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        rawAfterId,
      )
        ? rawAfterId
        : null;
    const [cursor] = afterId
      ? await db
          .select({ createdAt: messagesTable.createdAt })
          .from(messagesTable)
          .where(
            and(
              eq(messagesTable.id, afterId),
              eq(messagesTable.matchId, match.id),
            ),
          )
          .limit(1)
      : [];
    const messagesFromCursor = cursor
      ? await db
          .select()
          .from(messagesTable)
          .where(
            and(
              eq(messagesTable.matchId, match.id),
              gte(messagesTable.createdAt, cursor.createdAt),
            ),
          )
          .orderBy(asc(messagesTable.createdAt), asc(messagesTable.id))
      : await db
          .select()
          .from(messagesTable)
          .where(
            streamState?.clearedAt
              ? and(
                  eq(messagesTable.matchId, match.id),
                  gt(messagesTable.createdAt, streamState.clearedAt),
                )
              : eq(messagesTable.matchId, match.id),
          )
          .orderBy(desc(messagesTable.createdAt), desc(messagesTable.id))
          .limit(200)
          .then((rows) => rows.reverse());
    const afterCursor = cursor
      ? messagesAfterCursor(messagesFromCursor, afterId!)
      : messagesFromCursor;
    const missedMessages = streamState?.clearedAt
      ? afterCursor.filter(
          (message) => message.createdAt > streamState.clearedAt!,
        )
      : afterCursor;
    const hidden = missedMessages.length
      ? await db
          .select({ messageId: messageHiddenByUserTable.messageId })
          .from(messageHiddenByUserTable)
          .where(
            and(
              eq(messageHiddenByUserTable.userId, userId),
              inArray(
                messageHiddenByUserTable.messageId,
                missedMessages.map((message) => message.id),
              ),
            ),
          )
      : [];
    const hiddenIds = new Set(hidden.map((item) => item.messageId));
    messageStreams.replay(
      match.id,
      res,
      missedMessages
        .filter((message) => !hiddenIds.has(message.id))
        .map((message) => projectMessage(message)),
    );
    if (res.destroyed || res.writableEnded) cleanup();
  },
);

router.post(
  // Keep cached website/PWA clients working while they update their API client.
  ["/vibeswipe/matches/:matchId/messages", "/vibeswipe/matches/:matchId"],
  async (req, res): Promise<void> => {
    const params = SendMessageParams.safeParse(req.params);
    const body = SendMessageBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid message request." });
      return;
    }
    const userId = currentUserId(req);
    const match = await getMatchForUser(params.data.matchId, userId);
    if (!match) {
      res.status(403).json({ error: "A valid match is required to chat." });
      return;
    }
    if (await isBlockedBetween(match.userAId, match.userBId)) {
      res.status(403).json({ error: "Chat is unavailable while blocked." });
      return;
    }
    const content = body.data.content?.trim() ?? "";
    const mediaReference = body.data.mediaReference;
    const mediaType = body.data.mediaType;
    if (!content && !mediaReference) {
      res.status(400).json({ error: "Add text or an attachment to send." });
      return;
    }
    if (Boolean(mediaReference) !== Boolean(mediaType)) {
      res.status(400).json({ error: "Attachment type and reference must match." });
      return;
    }
    if (body.data.mediaDuration !== undefined && mediaType !== "audio") {
      res.status(400).json({ error: "Only audio attachments have a duration." });
      return;
    }
    if (mediaReference) {
      const mediaId = /^media:([0-9a-f-]{36})$/i.exec(mediaReference)?.[1];
      if (!mediaId) {
        res.status(400).json({ error: "Invalid media reference." });
        return;
      }
      const [asset] = await db
        .select({
          ownerId: mediaAssetsTable.ownerId,
          mediaType: mediaAssetsTable.mediaType,
          matchId: mediaAssetsTable.matchId,
        })
        .from(mediaAssetsTable)
        .where(eq(mediaAssetsTable.id, mediaId))
        .limit(1);
      if (
        !asset ||
        asset.ownerId !== userId ||
        asset.matchId !== match.id ||
        asset.mediaType !== mediaType
      ) {
        res.status(403).json({ error: "Attachment is not available to this account." });
        return;
      }
    }
    const { message, created } = await db.transaction(async (tx) => {
      if (mediaType === "audio" && mediaReference) {
        // Serialize retries for this private upload. A lost send response must
        // not create a second long voice note or notify its recipient twice.
        await tx.select({ id: mediaAssetsTable.id }).from(mediaAssetsTable)
          .where(eq(mediaAssetsTable.id, mediaReference.slice(6))).for("update");
        const [existing] = await tx.select().from(messagesTable).where(and(
          eq(messagesTable.matchId, match.id),
          eq(messagesTable.senderId, userId),
          eq(messagesTable.mediaReference, mediaReference),
        )).limit(1);
        if (existing) return { message: existing, created: false };
      }
      const [createdMessage] = await tx
        .insert(messagesTable)
        .values({
          matchId: match.id,
          senderId: userId,
          content,
          mediaReference: mediaReference ?? null,
          mediaType: mediaType ?? null,
          mediaDuration: body.data.mediaDuration ?? null,
        })
        .returning();
      await tx
        .update(matchesTable)
        .set({ updatedAt: new Date() })
        .where(eq(matchesTable.id, match.id));
      await tx.execute(
        sql`SELECT pg_notify(${CHAT_EVENT_CHANNEL}, ${JSON.stringify({
          type: "message",
          matchId: match.id,
          messageId: createdMessage.id,
        })})`,
      );
      return { message: createdMessage, created: true };
    });
    if (!created) {
      res.status(201).json(SendMessageResponse.parse(projectMessage(message)));
      return;
    }
    await saveMatchUserState(match.id, userId, { typingUntil: null });
    await db.execute(
      sql`SELECT pg_notify(${CHAT_EVENT_CHANNEL}, ${JSON.stringify({
        type: "typing",
        matchId: match.id,
      })})`,
    );
    const recipientId =
      match.userAId === userId ? match.userBId : match.userAId;
    const [recipient] = await db
      .select({ isDemo: profilesTable.isDemo })
      .from(profilesTable)
      .where(eq(profilesTable.id, recipientId))
      .limit(1);
    if (recipient && !recipient.isDemo) {
      try {
        await createVibeSwipeNotification({
          recipientId,
          actorId: userId,
          type: "new_message",
          matchId: match.id,
          messageId: message.id,
        });
      } catch (error) {
        req.log.error({ err: error, messageId: message.id }, "Could not save message notification");
      }
      void sendMessagePush({
        recipientId,
        senderId: userId,
        matchId: match.id,
        content: message.content,
        mediaType: message.mediaType,
      }).catch((error: unknown) => {
        req.log.error(
          {
            messageId: message.id,
            reason: error instanceof Error ? error.message : "unknown failure",
          },
          "Could not send message push notification",
        );
      });
    }
    res.status(201).json(SendMessageResponse.parse(projectMessage(message)));
  },
);

router.delete(
  "/vibeswipe/matches/:matchId/messages/:messageId",
  async (req, res): Promise<void> => {
    const params = DeleteMessageParams.safeParse(req.params);
    const body = DeleteMessageBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid message deletion request." });
      return;
    }
    const userId = currentUserId(req);
    const match = await getMatchForUser(params.data.matchId, userId);
    if (!match || (await isBlockedBetween(match.userAId, match.userBId))) {
      res.status(403).json({ error: "Chat is unavailable." });
      return;
    }
    const [message] = await db
      .select()
      .from(messagesTable)
      .where(
        and(
          eq(messagesTable.id, params.data.messageId),
          eq(messagesTable.matchId, match.id),
        ),
      )
      .limit(1);
    if (!message) {
      res.status(404).json({ error: "Message not found." });
      return;
    }
    if (body.data.forEveryone) {
      if (message.senderId !== userId) {
        res.status(403).json({ error: "Only the sender can delete for everyone." });
        return;
      }
      await db.transaction(async (tx) => {
        const [deleted] = await tx
          .update(messagesTable)
          .set({
            content: "",
            mediaReference: null,
            mediaType: null,
            mediaDuration: null,
            deletedForEveryone: true,
            deletedAt: new Date(),
          })
          .where(eq(messagesTable.id, message.id))
          .returning();
        if (deleted) {
          await tx.execute(
            sql`SELECT pg_notify(${CHAT_EVENT_CHANNEL}, ${JSON.stringify({
              type: "message",
              matchId: match.id,
              messageId: deleted.id,
            })})`,
          );
        }
      });
    } else {
      await db
        .insert(messageHiddenByUserTable)
        .values({ messageId: message.id, userId })
        .onConflictDoNothing();
    }
    DeleteMessageResponse.parse(undefined);
    res.status(204).end();
  },
);

router.post(
  "/vibeswipe/matches/:matchId/clear",
  async (req, res): Promise<void> => {
    const params = ClearChatParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const userId = currentUserId(req);
    const match = await getMatchForUser(params.data.matchId, userId);
    if (!match) {
      res.status(403).json({ error: "A valid match is required to clear chat." });
      return;
    }
    await saveMatchUserState(match.id, userId, { clearedAt: new Date() });
    ClearChatResponse.parse(undefined);
    res.status(204).end();
  },
);

router.delete(
  "/vibeswipe/matches/:matchId/chat",
  async (req, res): Promise<void> => {
    const params = DeleteChatParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const userId = currentUserId(req);
    const match = await getMatchForUser(params.data.matchId, userId);
    if (!match) {
      res.status(403).json({ error: "A valid match is required to delete chat." });
      return;
    }
    const now = new Date();
    await saveMatchUserState(match.id, userId, {
      hiddenAt: now,
      clearedAt: now,
    });
    DeleteChatResponse.parse(undefined);
    res.status(204).end();
  },
);

router.delete(
  "/vibeswipe/matches/:matchId",
  async (req, res): Promise<void> => {
    const params = UnmatchMatchParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const userId = currentUserId(req);
    const match = await getMatchForUser(params.data.matchId, userId);
    if (!match) {
      res.status(403).json({ error: "A valid match is required to unmatch." });
      return;
    }
    await db.transaction(async (tx) => {
      await tx.delete(matchesTable).where(eq(matchesTable.id, match.id));
      await tx.execute(
        sql`SELECT pg_notify(${CHAT_EVENT_CHANNEL}, ${JSON.stringify({
          type: "close",
          matchId: match.id,
        })})`,
      );
    });
    await db
      .delete(reactionsTable)
      .where(
        or(
          and(
            eq(reactionsTable.fromUserId, match.userAId),
            eq(reactionsTable.toUserId, match.userBId),
          ),
          and(
            eq(reactionsTable.fromUserId, match.userBId),
            eq(reactionsTable.toUserId, match.userAId),
          ),
        ),
      );
    UnmatchMatchResponse.parse(undefined);
    res.status(204).end();
  },
);

router.get(
  "/vibeswipe/matches/:matchId/typing",
  async (req, res): Promise<void> => {
    const params = GetTypingStatusParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const userId = currentUserId(req);
    const match = await getMatchForUser(params.data.matchId, userId);
    if (!match) {
      res.status(403).json({ error: "A valid match is required to view typing status." });
      return;
    }
    if (await isBlockedBetween(match.userAId, match.userBId)) {
      res.json(GetTypingStatusResponse.parse({ isTyping: false }));
      return;
    }
    const otherUserId = match.userAId === userId ? match.userBId : match.userAId;
    const state = await getMatchUserState(match.id, otherUserId);
    res.json(
      GetTypingStatusResponse.parse({
        isTyping: Boolean(state?.typingUntil && state.typingUntil > new Date()),
      }),
    );
  },
);

router.put(
  "/vibeswipe/matches/:matchId/typing",
  async (req, res): Promise<void> => {
    const params = UpdateTypingStatusParams.safeParse(req.params);
    const body = UpdateTypingStatusBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid typing status." });
      return;
    }
    const userId = currentUserId(req);
    const match = await getMatchForUser(params.data.matchId, userId);
    if (!match || (await isBlockedBetween(match.userAId, match.userBId))) {
      res.status(403).json({ error: "Chat is unavailable." });
      return;
    }
    await saveMatchUserState(match.id, userId, {
      typingUntil: body.data.isTyping ? new Date(Date.now() + 5_000) : null,
    });
    await db.execute(
      sql`SELECT pg_notify(${CHAT_EVENT_CHANNEL}, ${JSON.stringify({
        type: "typing",
        matchId: match.id,
      })})`,
    );
    UpdateTypingStatusResponse.parse(undefined);
    res.status(204).end();
  },
);

router.put(
  "/vibeswipe/matches/:matchId/theme",
  async (req, res): Promise<void> => {
    const params = UpdateChatThemeParams.safeParse(req.params);
    const body = UpdateChatThemeBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid chat theme." });
      return;
    }
    const userId = currentUserId(req);
    const match = await getMatchForUser(params.data.matchId, userId);
    if (!match) {
      res.status(403).json({ error: "A valid match is required to change chat theme." });
      return;
    }
    await saveMatchUserState(match.id, userId, { chatTheme: body.data.theme });
    res.json(UpdateChatThemeResponse.parse({ theme: body.data.theme }));
  },
);

router.post(
  "/vibeswipe/matches/:matchId/uploads/request-url",
  async (req, res): Promise<void> => {
    const params = RequestChatMediaUploadParams.safeParse(req.params);
    const body = RequestChatMediaUploadBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid chat media upload." });
      return;
    }
    const userId = currentUserId(req);
    const match = await getMatchForUser(params.data.matchId, userId);
    if (!match || (await isBlockedBetween(match.userAId, match.userBId))) {
      res.status(403).json({ error: "Chat is unavailable." });
      return;
    }
    const mediaTypeMatches =
      (body.data.mediaType === "image" &&
        body.data.contentType.startsWith("image/")) ||
      (body.data.mediaType === "video" &&
        body.data.contentType.startsWith("video/")) ||
      (body.data.mediaType === "audio" &&
        body.data.contentType.startsWith("audio/"));
    if (!mediaTypeMatches) {
      res.status(400).json({ error: "Attachment type does not match its content type." });
      return;
    }
    const maxSize =
      body.data.mediaType === "image" ? 15 * 1024 * 1024 : body.data.mediaType === "audio" ? 500 * 1024 * 1024 : 100 * 1024 * 1024;
    if (body.data.size > maxSize) {
      res.status(400).json({
        error:
          body.data.mediaType === "image"
            ? "Choose an image smaller than 15 MB."
            : `Choose a ${body.data.mediaType} smaller than ${body.data.mediaType === "audio" ? 500 : 100} MB.`,
      });
      return;
    }
    const uploadURL = await objectStorage.getObjectEntityUploadURL();
    const objectPath = objectStorage.normalizeObjectEntityPath(uploadURL);
    const [asset] = await db
      .insert(mediaAssetsTable)
      .values({
        ownerId: userId,
        matchId: match.id,
        objectPath,
        mediaType: body.data.mediaType,
        contentType: body.data.contentType,
      })
      .returning({ id: mediaAssetsTable.id });
    if (!asset) {
      res.status(500).json({ error: "Could not register the upload." });
      return;
    }
    res.json(
      RequestChatMediaUploadResponse.parse({
        uploadURL,
        mediaId: asset.id,
        mediaReference: `media:${asset.id}`,
      }),
    );
  },
);

router.get("/vibeswipe/blocks", async (req, res): Promise<void> => {
  const userId = currentUserId(req);
  const rows = await db
    .select()
    .from(blocksTable)
    .where(eq(blocksTable.blockerId, userId))
    .orderBy(desc(blocksTable.createdAt));
  const blocked = [];
  for (const block of rows) {
    const [profile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, block.blockedId))
      .limit(1);
    if (profile) blocked.push({ profile, createdAt: block.createdAt });
  }
  res.json(GetBlockedProfilesResponse.parse(blocked));
});

router.post("/vibeswipe/blocks", async (req, res): Promise<void> => {
  const parsed = BlockProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = currentUserId(req);
  const { targetUserId } = parsed.data;
  if (targetUserId === userId) {
    res.status(400).json({ error: "You cannot block yourself." });
    return;
  }
  const [target] = await db
    .select({ id: profilesTable.id })
    .from(profilesTable)
    .where(eq(profilesTable.id, targetUserId))
    .limit(1);
  if (!target) {
    res.status(404).json({ error: "Profile not found." });
    return;
  }
  const existingMatches = await db
    .select({ id: matchesTable.id })
    .from(matchesTable)
    .where(
      or(
        and(eq(matchesTable.userAId, userId), eq(matchesTable.userBId, targetUserId)),
        and(eq(matchesTable.userAId, targetUserId), eq(matchesTable.userBId, userId)),
      ),
    );
  await db.transaction(async (tx) => {
    await tx
      .insert(blocksTable)
      .values({ blockerId: userId, blockedId: targetUserId })
      .onConflictDoNothing();
    for (const { id } of existingMatches) {
      await tx.execute(
        sql`SELECT pg_notify(${CHAT_EVENT_CHANNEL}, ${JSON.stringify({
          type: "close",
          matchId: id,
        })})`,
      );
    }
  });
  BlockProfileResponse.parse(undefined);
  res.status(204).end();
});

router.delete("/vibeswipe/blocks/:targetUserId", async (req, res): Promise<void> => {
  const params = UnblockProfileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db
    .delete(blocksTable)
    .where(
      and(
        eq(blocksTable.blockerId, currentUserId(req)),
        eq(blocksTable.blockedId, params.data.targetUserId),
      ),
    );
  UnblockProfileResponse.parse(undefined);
  res.status(204).end();
});

router.post("/vibeswipe/reports", async (req, res): Promise<void> => {
  const parsed = ReportProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = currentUserId(req);
  if (parsed.data.targetUserId === userId) {
    res.status(400).json({ error: "You cannot report yourself." });
    return;
  }
  const [target] = await db
    .select({ id: profilesTable.id })
    .from(profilesTable)
    .where(eq(profilesTable.id, parsed.data.targetUserId))
    .limit(1);
  if (!target) {
    res.status(404).json({ error: "Profile not found." });
    return;
  }
  await db.insert(reportsTable).values({
    reporterId: userId,
    reportedId: parsed.data.targetUserId,
    reason: parsed.data.reason,
    details: parsed.data.details ?? null,
  });
  ReportProfileResponse.parse(undefined);
  res.status(201).end();
});

router.post(
  "/vibeswipe/uploads/request-url",
  async (req, res): Promise<void> => {
    const parsed = RequestProfileMediaUploadBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { contentType, mediaType, size } = parsed.data;
    const typeMatches =
      (mediaType === "image" && contentType.startsWith("image/")) ||
      (mediaType === "video" && contentType.startsWith("video/"));
    const maxSize =
      mediaType === "image" ? 15 * 1024 * 1024 : MAX_PROFILE_VIDEO_SOURCE_BYTES;
    if (!typeMatches || size > maxSize) {
      res.status(400).json({
        error:
          mediaType === "image"
            ? "Choose an image smaller than 15 MB."
            : "Choose a source video that is 500 MB or smaller.",
      });
      return;
    }
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "video/mp4",
      "video/quicktime",
    ];
    if (!allowedTypes.includes(contentType)) {
      res.status(400).json({ error: "This file type is not supported." });
      return;
    }
    const userId = currentUserId(req);
    const uploadURL = await objectStorage.getObjectEntityUploadURL();
    const objectPath = objectStorage.normalizeObjectEntityPath(uploadURL);
    const [asset] = await db
      .insert(mediaAssetsTable)
      .values({
        ownerId: userId,
        objectPath,
        mediaType,
        contentType,
      })
      .returning({ id: mediaAssetsTable.id });
    if (!asset) {
      res.status(500).json({ error: "Could not register the upload." });
      return;
    }
    res.json(
      RequestProfileMediaUploadResponse.parse({
        uploadURL,
        mediaId: asset.id,
        mediaReference: `media:${asset.id}`,
      }),
    );
  },
);

router.post(
  "/vibeswipe/uploads/:mediaId/transcode",
  async (req, res): Promise<void> => {
    const params = TranscodeProfileVideoParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid video upload." });
      return;
    }
    const userId = currentUserId(req);
    const [asset] = await db
      .select()
      .from(mediaAssetsTable)
      .where(eq(mediaAssetsTable.id, params.data.mediaId))
      .limit(1);
    if (!asset || asset.ownerId !== userId) {
      res.status(404).json({ error: "Uploaded video was not found." });
      return;
    }
    if (asset.mediaType !== "video") {
      res.status(400).json({ error: "This upload is not a video." });
      return;
    }

    try {
      const file = await objectStorage.getObjectEntityFile(asset.objectPath);
      const result = await transcodeProfileVideo(file);
      await db
        .update(mediaAssetsTable)
        .set({
          contentType: "video/mp4",
          durationSeconds: result.duration,
        })
        .where(eq(mediaAssetsTable.id, asset.id));
      res.json(
        TranscodeProfileVideoResponse.parse({
          mediaReference: `media:${asset.id}`,
          ...result,
        }),
      );
    } catch (error) {
      try {
        await removeUnreferencedProfileMedia(asset.id);
      } catch (cleanupError) {
        req.log.error(
          { err: cleanupError, mediaId: asset.id },
          "Could not remove failed profile video upload",
        );
      }
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: "Uploaded video was not found." });
        return;
      }
      if (error instanceof ProfileVideoValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      req.log.error({ err: error, mediaId: asset.id }, "Failed to compress profile video");
      res.status(500).json({ error: "The video could not be compressed." });
    }
  },
);

router.get(
  "/vibeswipe/media/:mediaId",
  async (req: Request, res: Response): Promise<void> => {
    const params = GetProfileMediaParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid media reference." });
      return;
    }
    const userId = currentUserId(req);
    const [asset] = await db
      .select()
      .from(mediaAssetsTable)
      .where(eq(mediaAssetsTable.id, params.data.mediaId))
      .limit(1);
    if (!asset) {
      res.status(404).json({ error: "Media not found." });
      return;
    }
    const [activeStory] = await db
      .select({ userId: storiesTable.userId })
      .from(storiesTable)
      .where(
        and(
          eq(storiesTable.mediaUrl, `media:${asset.id}`),
          gt(storiesTable.expiresAt, new Date()),
        ),
      )
      .limit(1);
    const storyMatch =
      activeStory && activeStory.userId !== userId
        ? await getUnblockedMatchBetween(userId, activeStory.userId)
        : null;
    const storyVisible = activeStory
      ? canViewStory({
          viewerId: userId,
          ownerId: activeStory.userId,
          hasUnblockedMatch: !!storyMatch,
        })
      : false;
    if (asset.matchId) {
      const match = await getMatchForUser(asset.matchId, userId);
      if (!match || (await isBlockedBetween(match.userAId, match.userBId))) {
        res.status(403).json({ error: "Chat media is unavailable to this account." });
        return;
      }
      if (asset.ownerId !== userId) {
        const [referencingMessage] = await db
          .select({ id: messagesTable.id })
          .from(messagesTable)
          .where(
            and(
              eq(messagesTable.matchId, match.id),
              eq(messagesTable.mediaReference, `media:${asset.id}`),
              eq(messagesTable.deletedForEveryone, false),
            ),
          )
          .limit(1);
        if (!referencingMessage) {
          res.status(403).json({ error: "Chat media is not attached to a message." });
          return;
        }
      }
    } else if (asset.ownerId !== userId && !storyVisible) {
      const [ownerProfile] = await db
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.id, asset.ownerId))
        .limit(1);
      const referenced =
        ownerProfile?.photos.includes(`media:${asset.id}`) ||
        ownerProfile?.videoUrl === `media:${asset.id}`;
      if (!referenced || (await isBlockedBetween(userId, asset.ownerId))) {
        res.status(403).json({ error: "Media is not visible to this account." });
        return;
      }
    }
    try {
      const file = await objectStorage.getObjectEntityFile(asset.objectPath);
      const response = await objectStorage.downloadObject(file, 300, req.get("range"));
      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));
      if (activeStory || asset.matchId) res.setHeader("Cache-Control", "private, no-store");
      if (response.body) {
        const stream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
        res.on("close", () => stream.destroy());
        stream.on("error", (error) => {
          req.log.error({ err: error }, "Private media stream interrupted");
          res.destroy();
        });
        stream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: "Media has not finished uploading." });
        return;
      }
      req.log.error({ err: error }, "Failed to stream profile media");
      res.status(500).json({ error: "Could not load profile media." });
    }
  },
);

export default router;
