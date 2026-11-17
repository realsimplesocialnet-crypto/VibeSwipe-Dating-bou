import { getAuth } from "@clerk/express";
import {
  GetProfileByIdParams,
  GetProfileByIdResponse,
  GetWhoViewedYouResponse,
  GetWhoLikedYouResponse,
  RecordProfileViewParams,
} from "@workspace/api-zod";
import {
  blocksTable,
  db,
  matchesTable,
  profilesTable,
  reactionsTable,
  vibeswipeProfileViewsTable,
  vibeSwipeNotificationsTable,
} from "@workspace/db";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import { requireAuth } from "../middlewares/auth";
import { createVibeSwipeNotification } from "../lib/vibeswipeNotifications";
import { canShowIncomingLike, canShowIncomingProfile } from "../lib/incomingProfileVisibility";

const router: IRouter = Router();

router.use(requireAuth);

function currentUserId(req: Request): string {
  const userId = getAuth(req).userId;
  if (!userId) throw new Error("Authenticated user is missing from the request");
  return userId;
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

router.post(
  "/vibeswipe/profiles/:profileId/views",
  async (req, res): Promise<void> => {
    const params = RecordProfileViewParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const viewerId = currentUserId(req);
    const profileId = params.data.profileId;
    if (viewerId === profileId) {
      res.status(400).json({ error: "You cannot record a view of your own profile." });
      return;
    }

    const [viewer, profile] = await Promise.all([
      db
        .select({ id: profilesTable.id, isDemo: profilesTable.isDemo })
        .from(profilesTable)
        .where(eq(profilesTable.id, viewerId))
        .limit(1)
        .then((rows) => rows[0]),
      db
        .select({ id: profilesTable.id, isDemo: profilesTable.isDemo })
        .from(profilesTable)
        .where(eq(profilesTable.id, profileId))
        .limit(1)
        .then((rows) => rows[0]),
    ]);

    if (!viewer || viewer.isDemo) {
      res.status(409).json({ error: "Complete your profile before viewing profiles." });
      return;
    }
    if (!profile || profile.isDemo) {
      res.status(404).json({ error: "Profile not found." });
      return;
    }
    if (await isBlockedBetween(viewerId, profileId)) {
      res.status(204).end();
      return;
    }

    const viewedAt = new Date();
    await db
      .insert(vibeswipeProfileViewsTable)
      .values({ viewerId, profileId, viewedAt })
      .onConflictDoUpdate({
        target: [
          vibeswipeProfileViewsTable.viewerId,
          vibeswipeProfileViewsTable.profileId,
        ],
        set: { viewedAt },
      });
    const [unreadView] = await db
      .select({ id: vibeSwipeNotificationsTable.id })
      .from(vibeSwipeNotificationsTable)
      .where(
        and(
          eq(vibeSwipeNotificationsTable.recipientId, profileId),
          eq(vibeSwipeNotificationsTable.actorId, viewerId),
          eq(vibeSwipeNotificationsTable.type, "profile_view"),
          isNull(vibeSwipeNotificationsTable.readAt),
        ),
      )
      .limit(1);
    if (unreadView) {
      await db
        .update(vibeSwipeNotificationsTable)
        .set({ createdAt: viewedAt })
        .where(eq(vibeSwipeNotificationsTable.id, unreadView.id));
    } else {
      await createVibeSwipeNotification({
        recipientId: profileId,
        actorId: viewerId,
        type: "profile_view",
      });
    }

    res.status(204).end();
  },
);

router.get("/vibeswipe/likes", async (req, res): Promise<void> => {
  const userId = currentUserId(req);
  const [rows, blocks, outgoing, matches] = await Promise.all([
    db
      .select({ profile: profilesTable, likedAt: reactionsTable.createdAt, type: reactionsTable.type })
      .from(reactionsTable)
      .innerJoin(profilesTable, eq(reactionsTable.fromUserId, profilesTable.id))
      .where(and(eq(reactionsTable.toUserId, userId), inArray(reactionsTable.type, ["like", "super"])))
      .orderBy(desc(reactionsTable.createdAt)),
    db.select({
      blockerId: blocksTable.blockerId,
      blockedId: blocksTable.blockedId,
    }).from(blocksTable).where(or(
      eq(blocksTable.blockerId, userId),
      eq(blocksTable.blockedId, userId),
    )),
    db.select({
      targetId: reactionsTable.toUserId,
      type: reactionsTable.type,
      createdAt: reactionsTable.createdAt,
    }).from(reactionsTable).where(eq(reactionsTable.fromUserId, userId)),
    db.select({
      userAId: matchesTable.userAId,
      userBId: matchesTable.userBId,
    }).from(matchesTable).where(or(
      eq(matchesTable.userAId, userId),
      eq(matchesTable.userBId, userId),
    )),
  ]);
  const blockedIds = new Set(blocks.map((block) =>
    block.blockerId === userId ? block.blockedId : block.blockerId));
  const outgoingById = new Map(outgoing.map((reaction) => [reaction.targetId, reaction]));
  const matchedIds = new Set(matches.flatMap((match) => [
    match.userAId === userId ? match.userBId : match.userAId,
  ]));
  res.json(GetWhoLikedYouResponse.parse(rows
    .filter(({ profile, likedAt }) => canShowIncomingLike({
      profile,
      currentUserId: userId,
      blockedProfileIds: blockedIds,
      matchedProfileIds: matchedIds,
      likedAt,
      outgoingReaction: outgoingById.get(profile.id),
    }))
    .map(({ profile, likedAt, type }) => ({
      profile: { ...profile, age: profile.showAge ? profile.age : null },
      likedAt,
      isSuperLike: type === "super",
    }))));
});

router.get("/vibeswipe/views", async (req, res): Promise<void> => {
  const userId = currentUserId(req);
  const rows = await db
    .select({ profile: profilesTable, viewedAt: vibeswipeProfileViewsTable.viewedAt })
    .from(vibeswipeProfileViewsTable)
    .innerJoin(
      profilesTable,
      eq(vibeswipeProfileViewsTable.viewerId, profilesTable.id),
    )
    .where(eq(vibeswipeProfileViewsTable.profileId, userId))
    .orderBy(desc(vibeswipeProfileViewsTable.viewedAt));

  const blocks = await db
    .select({
      blockerId: blocksTable.blockerId,
      blockedId: blocksTable.blockedId,
    })
    .from(blocksTable)
    .where(
      or(eq(blocksTable.blockerId, userId), eq(blocksTable.blockedId, userId)),
    );
  const blockedProfileIds = new Set(
    blocks.map((block) =>
      block.blockerId === userId ? block.blockedId : block.blockerId,
    ),
  );
  const visibleRows = rows
    .filter(
      ({ profile }) =>
        canShowIncomingProfile(profile, userId, blockedProfileIds),
    )
    .map(({ profile, viewedAt }) => ({
      profile: {
        ...profile,
        age: profile.showAge ? profile.age : null,
      },
      viewedAt,
    }));

  res.json(GetWhoViewedYouResponse.parse(visibleRows));
});

router.get(
  "/vibeswipe/profiles/:profileId",
  async (req, res): Promise<void> => {
    const params = GetProfileByIdParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const userId = currentUserId(req);
    const profileId = params.data.profileId;
    const [profile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, profileId))
      .limit(1);
    if (!profile || (profileId !== userId && profile.deactivated)) {
      res.status(404).json({ error: "Profile not found." });
      return;
    }
    if (profileId !== userId && (await isBlockedBetween(userId, profileId))) {
      res.status(404).json({ error: "Profile not found." });
      return;
    }

    res.json(
      GetProfileByIdResponse.parse({
        ...profile,
        age: profileId === userId || profile.showAge ? profile.age : null,
      }),
    );
  },
);

export default router;
