import { getAuth } from "@clerk/express";
import {
  BlockProfileBody,
  CreateReactionBody,
  CreateReactionResponse,
  GetDiscoverProfilesQueryParams,
  GetDiscoverProfilesResponse,
  GetMatchesResponse,
  GetMessagesParams,
  GetMessagesResponse,
  GetMyProfileResponse,
  GetProfileMediaParams,
  Message,
  Profile,
  ReportProfileBody,
  RequestProfileMediaUploadBody,
  RequestProfileMediaUploadResponse,
  SaveMyProfileBody,
  SaveMyProfileResponse,
  SendMessageBody,
  SendMessageParams,
  SendMessageResponse,
} from "@workspace/api-zod";
import {
  blocksTable,
  db,
  matchesTable,
  mediaAssetsTable,
  messagesTable,
  profilesTable,
  reactionsTable,
  reportsTable,
} from "@workspace/db";
import { and, desc, eq, gte, inArray, lte, or } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "node:stream";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();
const defaultPreferences = {
  ageMin: 22,
  ageMax: 35,
  gender: "Everyone",
  distanceKm: 50,
};

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
  if (await isBlockedBetween(match.userAId, match.userBId)) return null;
  return match;
}

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
  if (mediaIds.length > 0) {
    const ownedMedia = await db
      .select({ id: mediaAssetsTable.id })
      .from(mediaAssetsTable)
      .where(
        and(
          eq(mediaAssetsTable.ownerId, userId),
          inArray(mediaAssetsTable.id, mediaIds),
        ),
      );
    if (ownedMedia.length !== new Set(mediaIds).size) {
      res.status(400).json({ error: "Profile media must belong to you." });
      return;
    }
  }

  const values = {
    id: userId,
    name: body.name.trim(),
    age: body.age,
    gender: body.gender,
    lookingFor: body.lookingFor,
    bio: body.bio.trim(),
    city: body.city.trim(),
    interests: body.interests,
    photos: body.photos,
    videoUrl: body.videoUrl ?? null,
    preferences: body.preferences,
    updatedAt: new Date(),
  };
  const [profile] = await db
    .insert(profilesTable)
    .values(values)
    .onConflictDoUpdate({
      target: profilesTable.id,
      set: values,
    })
    .returning();
  if (!profile) {
    res.status(500).json({ error: "Profile could not be saved." });
    return;
  }
  res.json(SaveMyProfileResponse.parse(profile));
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
  const gender = params.data.gender ?? ownProfile.preferences.gender;
  const conditions = [gte(profilesTable.age, ageMin), lte(profilesTable.age, ageMax)];
  if (gender && gender !== "Everyone") conditions.push(eq(profilesTable.gender, gender));
  if (params.data.city) conditions.push(eq(profilesTable.city, params.data.city));

  const [reacted, blockRows, candidates] = await Promise.all([
    db
      .select({ id: reactionsTable.toUserId })
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
      .select()
      .from(profilesTable)
      .where(and(...conditions))
      .limit(100),
  ]);
  const excluded = new Set([
    userId,
    ...reacted.map((row) => row.id),
    ...blockRows.flatMap((row) => [row.blockerId, row.blockedId]),
  ]);
  const profiles = candidates.filter((profile) => !excluded.has(profile.id));
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
  await db
    .insert(reactionsTable)
    .values({ fromUserId: userId, toUserId, type })
    .onConflictDoUpdate({
      target: [reactionsTable.fromUserId, reactionsTable.toUserId],
      set: { type, createdAt: new Date() },
    });

  let mutual = false;
  if (type !== "pass") {
    if (target.isDemo && process.env.NODE_ENV !== "production") {
      mutual = true;
    } else {
      const [reverseReaction] = await db
        .select({ id: reactionsTable.id })
        .from(reactionsTable)
        .where(
          and(
            eq(reactionsTable.fromUserId, toUserId),
            eq(reactionsTable.toUserId, userId),
            inArray(reactionsTable.type, ["like", "super"]),
          ),
        )
        .limit(1);
      mutual = !!reverseReaction;
    }
  }

  let matchId: string | null = null;
  if (mutual) {
    const [match] = await db
      .insert(matchesTable)
      .values({
        userAId: userId < toUserId ? userId : toUserId,
        userBId: userId < toUserId ? toUserId : userId,
        updatedAt: new Date(),
      })
      .onConflictDoNothing()
      .returning({ id: matchesTable.id });
    if (match) {
      matchId = match.id;
    } else {
      const [existing] = await db
        .select({ id: matchesTable.id })
        .from(matchesTable)
        .where(
          and(
            eq(matchesTable.userAId, userId < toUserId ? userId : toUserId),
            eq(matchesTable.userBId, userId < toUserId ? toUserId : userId),
          ),
        )
        .limit(1);
      matchId = existing?.id ?? null;
    }
  }
  res.json(CreateReactionResponse.parse({ matched: mutual, matchId }));
});

router.get("/vibeswipe/matches", async (req, res): Promise<void> => {
  const userId = currentUserId(req);
  const rows = await db
    .select()
    .from(matchesTable)
    .where(or(eq(matchesTable.userAId, userId), eq(matchesTable.userBId, userId)))
    .orderBy(desc(matchesTable.updatedAt));
  const visibleRows = [];
  for (const match of rows) {
    const otherId = match.userAId === userId ? match.userBId : match.userAId;
    if (await isBlockedBetween(userId, otherId)) continue;
    const [profile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, otherId))
      .limit(1);
    if (!profile) continue;
    const [last] = await db
      .select({ content: messagesTable.content })
      .from(messagesTable)
      .where(eq(messagesTable.matchId, match.id))
      .orderBy(desc(messagesTable.createdAt))
      .limit(1);
    visibleRows.push({
      id: match.id,
      profile,
      lastMessage: last?.content ?? null,
      updatedAt: match.updatedAt,
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
    const messages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.matchId, match.id))
      .orderBy(desc(messagesTable.createdAt))
      .limit(200);
    res.json(GetMessagesResponse.parse(messages));
  },
);

router.post(
  "/vibeswipe/matches/:matchId/messages",
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
    const content = body.data.content.trim();
    if (!content) {
      res.status(400).json({ error: "Message cannot be empty." });
      return;
    }
    const [message] = await db
      .insert(messagesTable)
      .values({ matchId: match.id, senderId: userId, content })
      .returning();
    await db
      .update(matchesTable)
      .set({ updatedAt: new Date() })
      .where(eq(matchesTable.id, match.id));
    res.status(201).json(SendMessageResponse.parse(message as Message));
  },
);

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
  await db
    .insert(blocksTable)
    .values({ blockerId: userId, blockedId: targetUserId })
    .onConflictDoNothing();
  await db
    .delete(matchesTable)
    .where(
      or(
        and(eq(matchesTable.userAId, userId), eq(matchesTable.userBId, targetUserId)),
        and(eq(matchesTable.userAId, targetUserId), eq(matchesTable.userBId, userId)),
      ),
    );
  await db
    .delete(reactionsTable)
    .where(
      or(
        and(eq(reactionsTable.fromUserId, userId), eq(reactionsTable.toUserId, targetUserId)),
        and(eq(reactionsTable.fromUserId, targetUserId), eq(reactionsTable.toUserId, userId)),
      ),
    );
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
    const maxSize = mediaType === "image" ? 15 * 1024 * 1024 : 50 * 1024 * 1024;
    if (!typeMatches || size > maxSize) {
      res.status(400).json({
        error:
          mediaType === "image"
            ? "Choose an image smaller than 15 MB."
            : "Choose a video smaller than 50 MB.",
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
    if (asset.ownerId !== userId) {
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
      const response = await objectStorage.downloadObject(file, 300);
      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));
      if (response.body) {
        Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
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
