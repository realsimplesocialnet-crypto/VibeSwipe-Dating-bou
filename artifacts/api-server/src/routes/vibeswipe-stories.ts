import { getAuth } from "@clerk/express";
import {
  CreateStoryBody,
  CreateStoryResponse,
  DeleteStoryParams,
  GetStoriesResponse,
  MarkStoryViewedParams,
  RequestStoryMediaUploadBody,
  RequestStoryMediaUploadResponse,
  TranscodeStoryVideoParams,
  TranscodeStoryVideoResponse,
} from "@workspace/api-zod";
import {
  and,
  desc,
  eq,
  gt,
  inArray,
  or,
} from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import {
  blocksTable,
  db,
  matchesTable,
  mediaAssetsTable,
  profilesTable,
  storiesTable,
  storyViewsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { ObjectStorageService } from "../lib/objectStorage";
import { removeUnreferencedProfileMedia } from "../lib/profileMediaCleanup";
import {
  cleanupExpiredStories,
  getUnblockedMatchBetween,
} from "../lib/vibeswipeStories";
import { canViewStory, storyExpiresAt } from "../lib/vibeswipeStoryRules";
import {
  MAX_STORY_VIDEO_DURATION_SECONDS,
  ProfileVideoValidationError,
  transcodeProfileVideo,
} from "../lib/profileVideoTranscoder";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();
const STORY_IMAGE_MAX_BYTES = 15 * 1024 * 1024;
const STORY_VIDEO_SOURCE_MAX_BYTES = 100 * 1024 * 1024;
const STORY_VIDEO_MIME_TYPES = new Set(["video/mp4", "video/quicktime"]);
const STORY_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
]);

router.use(requireAuth);

function currentUserId(req: Request): string {
  const userId = getAuth(req).userId;
  if (!userId) throw new Error("Authenticated user is missing from the request");
  return userId;
}

function storyItem(
  story: typeof storiesTable.$inferSelect,
  viewed: boolean,
) {
  return {
    id: story.id,
    mediaUrl: story.mediaUrl,
    mediaType: story.mediaType as "image" | "video" | null,
    caption: story.caption,
    backgroundColor: story.backgroundColor,
    createdAt: story.createdAt.toISOString(),
    expiresAt: story.expiresAt.toISOString(),
    viewed,
  };
}

router.get("/vibeswipe/stories", async (req, res): Promise<void> => {
  await cleanupExpiredStories();
  const userId = currentUserId(req);
  const now = new Date();
  const ownStories = await db
    .select()
    .from(storiesTable)
    .where(and(eq(storiesTable.userId, userId), gt(storiesTable.expiresAt, now)))
    .orderBy(desc(storiesTable.createdAt));

  const matchRows = await db
    .select({
      id: matchesTable.id,
      userAId: matchesTable.userAId,
      userBId: matchesTable.userBId,
    })
    .from(matchesTable)
    .where(
      or(eq(matchesTable.userAId, userId), eq(matchesTable.userBId, userId)),
    );
  const partnerById = new Map<string, string>();
  for (const match of matchRows) {
    const partnerId =
      match.userAId === userId ? match.userBId : match.userAId;
    if (partnerId !== userId && !partnerById.has(partnerId)) {
      partnerById.set(partnerId, match.id);
    }
  }
  const partnerIds = [...partnerById.keys()];
  if (partnerIds.length === 0) {
    res.json(
      GetStoriesResponse.parse({
        ownStories: ownStories.map((story) => storyItem(story, true)),
        matches: [],
      }),
    );
    return;
  }

  const blockRows = await db
    .select({
      blockerId: blocksTable.blockerId,
      blockedId: blocksTable.blockedId,
    })
    .from(blocksTable)
    .where(or(eq(blocksTable.blockerId, userId), eq(blocksTable.blockedId, userId)));
  const blockedPartners = new Set(
    blockRows.map((block) =>
      block.blockerId === userId ? block.blockedId : block.blockerId,
    ),
  );
  const visiblePartnerIds = partnerIds.filter(
    (partnerId) => !blockedPartners.has(partnerId),
  );
  if (visiblePartnerIds.length === 0) {
    res.json(
      GetStoriesResponse.parse({
        ownStories: ownStories.map((story) => storyItem(story, true)),
        matches: [],
      }),
    );
    return;
  }

  const [profiles, matchStories] = await Promise.all([
    db
      .select({
        id: profilesTable.id,
        name: profilesTable.name,
        photos: profilesTable.photos,
      })
      .from(profilesTable)
      .where(inArray(profilesTable.id, visiblePartnerIds)),
    db
      .select()
      .from(storiesTable)
      .where(
        and(
          inArray(storiesTable.userId, visiblePartnerIds),
          gt(storiesTable.expiresAt, now),
        ),
      )
      .orderBy(desc(storiesTable.createdAt)),
  ]);
  const storyIds = matchStories.map((story) => story.id);
  const views = storyIds.length
    ? await db
        .select({ storyId: storyViewsTable.storyId })
        .from(storyViewsTable)
        .where(
          and(
            eq(storyViewsTable.viewerId, userId),
            inArray(storyViewsTable.storyId, storyIds),
          ),
        )
    : [];
  const viewedIds = new Set(views.map((view) => view.storyId));
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const grouped = new Map<
    string,
    { matchId: string; poster: { id: string; name: string; photo: string | null }; stories: ReturnType<typeof storyItem>[] }
  >();
  for (const story of matchStories) {
    const poster = profilesById.get(story.userId);
    const matchId = partnerById.get(story.userId);
    if (!poster || !matchId) continue;
    const group = grouped.get(story.userId) ?? {
      matchId,
      poster: {
        id: poster.id,
        name: poster.name,
        photo: poster.photos[0] ?? null,
      },
      stories: [],
    };
    group.stories.push(storyItem(story, viewedIds.has(story.id)));
    grouped.set(story.userId, group);
  }
  const matches = [...grouped.values()].sort((first, second) =>
    second.stories[0].createdAt.localeCompare(first.stories[0].createdAt),
  );
  res.json(
    GetStoriesResponse.parse({
      ownStories: ownStories.map((story) => storyItem(story, true)),
      matches,
    }),
  );
});

router.post("/vibeswipe/stories/uploads/request-url", async (req, res): Promise<void> => {
  const body = RequestStoryMediaUploadBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Choose a supported story photo or video." });
    return;
  }
  const { contentType, mediaType, size } = body.data;
  const isImage = mediaType === "image" && STORY_IMAGE_MIME_TYPES.has(contentType);
  const isVideo = mediaType === "video" && STORY_VIDEO_MIME_TYPES.has(contentType);
  const maxSize = mediaType === "image"
    ? STORY_IMAGE_MAX_BYTES
    : STORY_VIDEO_SOURCE_MAX_BYTES;
  if ((!isImage && !isVideo) || size > maxSize) {
    res.status(400).json({
      error: mediaType === "image"
        ? "Choose a JPG, PNG, WebP, or HEIC photo under 15 MB."
        : "Choose an MP4 or MOV video under 100 MB.",
    });
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
    res.status(500).json({ error: "Could not register the story upload." });
    return;
  }
  res.json(
    RequestStoryMediaUploadResponse.parse({
      uploadURL,
      mediaId: asset.id,
      mediaReference: `media:${asset.id}`,
    }),
  );
});

router.post(
  "/vibeswipe/stories/uploads/:mediaId/transcode",
  async (req, res): Promise<void> => {
    const params = TranscodeStoryVideoParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid story video upload." });
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
      const result = await transcodeProfileVideo(
        file,
        MAX_STORY_VIDEO_DURATION_SECONDS,
      );
      await db
        .update(mediaAssetsTable)
        .set({ contentType: "video/mp4", durationSeconds: result.duration })
        .where(eq(mediaAssetsTable.id, asset.id));
      res.json(
        TranscodeStoryVideoResponse.parse({
          mediaReference: `media:${asset.id}`,
          ...result,
        }),
      );
    } catch (error) {
      if (error instanceof ProfileVideoValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      req.log.error({ err: error, mediaId: asset.id }, "Failed to prepare story video");
      res.status(500).json({ error: "The story video could not be prepared." });
    }
  },
);

router.post("/vibeswipe/stories", async (req, res): Promise<void> => {
  const body = CreateStoryBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Check the story and try again." });
    return;
  }
  const userId = currentUserId(req);
  const mediaUrl = body.data.mediaUrl?.trim() || null;
  const mediaType = body.data.mediaType ?? null;
  const caption = body.data.caption?.trim() ?? "";
  const backgroundColor = body.data.backgroundColor ?? null;
  if (Boolean(mediaUrl) !== Boolean(mediaType) || (!mediaUrl && !caption)) {
    res.status(400).json({ error: "Add a photo, video, or text to your story." });
    return;
  }

  if (mediaUrl) {
    const mediaId = /^media:([0-9a-f-]{36})$/i.exec(mediaUrl)?.[1];
    if (!mediaId || !mediaType) {
      res.status(400).json({ error: "The uploaded story media is invalid." });
      return;
    }
    const [asset] = await db
      .select()
      .from(mediaAssetsTable)
      .where(eq(mediaAssetsTable.id, mediaId))
      .limit(1);
    if (!asset || asset.ownerId !== userId || asset.matchId !== null || asset.mediaType !== mediaType) {
      res.status(403).json({ error: "This upload does not belong to your account." });
      return;
    }
    if (mediaType === "video") {
      if (
        asset.contentType !== "video/mp4" ||
        asset.durationSeconds === null ||
        asset.durationSeconds <= 0 ||
        asset.durationSeconds > MAX_STORY_VIDEO_DURATION_SECONDS
      ) {
        res.status(400).json({
          error: "Prepare a video that is 60 seconds or shorter before posting.",
        });
        return;
      }
    } else if (!asset.contentType.startsWith("image/")) {
      res.status(400).json({ error: "The uploaded file is not a supported photo." });
      return;
    }
  }

  const createdAt = new Date();
  const expiresAt = storyExpiresAt(createdAt);
  const [story] = await db
    .insert(storiesTable)
    .values({
      userId,
      mediaUrl,
      mediaType,
      caption,
      backgroundColor,
      createdAt,
      expiresAt,
    })
    .onConflictDoNothing()
    .returning({
      id: storiesTable.id,
      createdAt: storiesTable.createdAt,
      expiresAt: storiesTable.expiresAt,
    });
  if (!story) {
    res.status(409).json({ error: "That upload has already been used in a story." });
    return;
  }
  res.status(201).json(
    CreateStoryResponse.parse({
      id: story.id,
      createdAt: story.createdAt.toISOString(),
      expiresAt: story.expiresAt.toISOString(),
    }),
  );
});

router.post(
  "/vibeswipe/stories/:storyId/view",
  async (req, res): Promise<void> => {
    const params = MarkStoryViewedParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid story." });
      return;
    }
    const userId = currentUserId(req);
    const [story] = await db
      .select()
      .from(storiesTable)
      .where(
        and(
          eq(storiesTable.id, params.data.storyId),
          gt(storiesTable.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (!story) {
      res.status(404).json({ error: "This story has expired or was removed." });
      return;
    }
    const match = story.userId === userId
      ? null
      : await getUnblockedMatchBetween(userId, story.userId);
    if (!canViewStory({ viewerId: userId, ownerId: story.userId, hasUnblockedMatch: !!match })) {
      res.status(403).json({ error: "Only mutual matches can view this story." });
      return;
    }
    if (story.userId !== userId) {
      await db
        .insert(storyViewsTable)
        .values({ storyId: story.id, viewerId: userId })
        .onConflictDoUpdate({
          target: [storyViewsTable.storyId, storyViewsTable.viewerId],
          set: { viewedAt: new Date() },
        });
    }
    res.status(204).end();
  },
);

router.delete("/vibeswipe/stories/:storyId", async (req, res): Promise<void> => {
  const params = DeleteStoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid story." });
    return;
  }
  const userId = currentUserId(req);
  const [deleted] = await db
    .delete(storiesTable)
    .where(
      and(
        eq(storiesTable.id, params.data.storyId),
        eq(storiesTable.userId, userId),
      ),
    )
    .returning({ mediaUrl: storiesTable.mediaUrl, userId: storiesTable.userId });
  if (!deleted) {
    res.status(404).json({ error: "Story not found." });
    return;
  }
  const mediaId = /^media:([0-9a-f-]{36})$/i.exec(deleted.mediaUrl ?? "")?.[1];
  if (mediaId) {
    try {
      await removeUnreferencedProfileMedia(mediaId, deleted.userId);
    } catch (error) {
      req.log.error({ err: error, mediaId }, "Could not remove deleted story media");
    }
  }
  res.status(204).end();
});

export default router;
