import { getAuth } from "@clerk/express";
import {
  FollowProfileParams,
  ApproveFollowRequestParams,
  DeclineFollowRequestParams,
  GetFollowRequestsResponse,
  GetProfileDatingStateParams,
  GetProfileDatingStateResponse,
  GetProfileFollowSummaryParams,
  GetProfileFollowSummaryResponse,
  GetProfileFollowersQueryParams,
  GetProfileFollowersResponse,
  GetProfileFollowingQueryParams,
  GetProfileFollowingResponse,
  UnfollowProfileParams,
} from "@workspace/api-zod";
import {
  blocksTable,
  db,
  matchesTable,
  profilesTable,
  reactionsTable,
  reelsTable,
  vibeSwipeFollowsTable,
  vibeSwipeFollowRequestsTable,
  vibeSwipeNotificationsTable,
} from "@workspace/db";
import { and, count, desc, eq, ilike, inArray, notInArray, or, sql, type SQL } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import { requireAuth } from "../middlewares/auth";
import { planNewFollowNotification } from "../lib/vibeswipeFollowPolicy";
import { sendFollowPush } from "../lib/vibeswipePush";
import { canViewUserProfile } from "../lib/profile-privacy";
import { visibleReelCondition } from "../lib/reels-visibility";

const router: IRouter = Router();
router.use(requireAuth);

function currentUserId(req: Request): string {
  const userId = getAuth(req).userId;
  if (!userId) throw new Error("Authenticated user is missing from the request");
  return userId;
}

async function profileIsAvailable(profileId: string): Promise<boolean> {
  const [profile] = await db
    .select({
      id: profilesTable.id,
      isDemo: profilesTable.isDemo,
      deactivated: profilesTable.deactivated,
      adminSuspended: profilesTable.adminSuspended,
      privateAccount: profilesTable.privateAccount,
    })
    .from(profilesTable)
    .where(eq(profilesTable.id, profileId))
    .limit(1);
  return Boolean(profile && !profile.isDemo && !profile.deactivated && !profile.adminSuspended);
}

async function blockedBetween(userA: string, userB: string): Promise<boolean> {
  const [block] = await db
    .select({ id: blocksTable.id })
    .from(blocksTable)
    .where(or(
      and(eq(blocksTable.blockerId, userA), eq(blocksTable.blockedId, userB)),
      and(eq(blocksTable.blockerId, userB), eq(blocksTable.blockedId, userA)),
    ))
    .limit(1);
  return Boolean(block);
}

async function followSummary(viewerId: string, profileId: string) {
  const [postRows, matchRows, summaryRows] = await Promise.all([
    db.select({ total: count().mapWith(Number) }).from(reelsTable)
      .innerJoin(profilesTable, eq(profilesTable.id, reelsTable.userId))
      .where(and(eq(reelsTable.userId, profileId), visibleReelCondition(viewerId))),
    db.select({ total: count().mapWith(Number) }).from(matchesTable)
      .where(or(eq(matchesTable.userAId, profileId), eq(matchesTable.userBId, profileId))),
    db.select({
      followersCount: sql<number>`(select count(*) from ${vibeSwipeFollowsTable} where ${vibeSwipeFollowsTable.followedId} = ${profileId})`.mapWith(Number),
      followingCount: sql<number>`(select count(*) from ${vibeSwipeFollowsTable} where ${vibeSwipeFollowsTable.followerId} = ${profileId})`.mapWith(Number),
      isFollowing: sql<boolean>`exists (select 1 from ${vibeSwipeFollowsTable} where ${vibeSwipeFollowsTable.followerId} = ${viewerId} and ${vibeSwipeFollowsTable.followedId} = ${profileId})`.mapWith(Boolean),
      followsYou: sql<boolean>`exists (select 1 from ${vibeSwipeFollowsTable} where ${vibeSwipeFollowsTable.followerId} = ${profileId} and ${vibeSwipeFollowsTable.followedId} = ${viewerId})`.mapWith(Boolean),
      requestPendingByMe: sql<boolean>`exists (select 1 from ${vibeSwipeFollowRequestsTable} where ${vibeSwipeFollowRequestsTable.requesterId} = ${viewerId} and ${vibeSwipeFollowRequestsTable.targetId} = ${profileId})`.mapWith(Boolean),
      requestPendingForMe: sql<boolean>`exists (select 1 from ${vibeSwipeFollowRequestsTable} where ${vibeSwipeFollowRequestsTable.requesterId} = ${profileId} and ${vibeSwipeFollowRequestsTable.targetId} = ${viewerId})`.mapWith(Boolean),
    }).from(profilesTable).where(eq(profilesTable.id, profileId)).limit(1),
  ]);
  const postSummary = postRows[0];
  const matchSummary = matchRows[0];
  const summary = summaryRows[0];
  return {
    ...(summary ?? {
      followersCount: 0, followingCount: 0, isFollowing: false, followsYou: false,
      requestPendingByMe: false, requestPendingForMe: false,
    }),
    postCount: postSummary?.total ?? 0,
    matchCount: matchSummary?.total ?? 0,
  };
}

router.get(
  "/vibeswipe/profiles/:profileId/follow-summary",
  async (req, res): Promise<void> => {
    const params = GetProfileFollowSummaryParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const profileId = params.data.profileId;
    if (!(await profileIsAvailable(profileId))) {
      res.status(404).json({ error: "Profile not found." });
      return;
    }
    if (profileId !== currentUserId(req) && await blockedBetween(currentUserId(req), profileId)) {
      res.status(404).json({ error: "Profile not found." });
      return;
    }
    res.json(GetProfileFollowSummaryResponse.parse(
      await followSummary(currentUserId(req), profileId),
    ));
  },
);

router.get(
  "/vibeswipe/profiles/:profileId/dating-state",
  async (req, res): Promise<void> => {
    const params = GetProfileDatingStateParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const viewerId = currentUserId(req);
    const profileId = params.data.profileId;
    if (!(await profileIsAvailable(profileId))) {
      res.status(404).json({ error: "Profile not found." });
      return;
    }
    if (profileId !== viewerId && await blockedBetween(viewerId, profileId)) {
      res.status(404).json({ error: "Profile not found." });
      return;
    }
    const [reaction, match] = await Promise.all([
      db.select({ type: reactionsTable.type })
        .from(reactionsTable)
        .where(and(
          eq(reactionsTable.fromUserId, viewerId),
          eq(reactionsTable.toUserId, profileId),
          inArray(reactionsTable.type, ["like", "super"]),
        ))
        .limit(1),
      db.select({ id: matchesTable.id })
        .from(matchesTable)
        .where(or(
          and(eq(matchesTable.userAId, viewerId), eq(matchesTable.userBId, profileId)),
          and(eq(matchesTable.userAId, profileId), eq(matchesTable.userBId, viewerId)),
        ))
        .limit(1),
    ]);
    res.json(GetProfileDatingStateResponse.parse({
      reaction: reaction[0]?.type ?? null,
      matchId: match[0]?.id ?? null,
    }));
  },
);

router.delete(
  "/vibeswipe/profiles/:profileId/reaction",
  async (req, res): Promise<void> => {
    const params = GetProfileDatingStateParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const viewerId = currentUserId(req);
    const profileId = params.data.profileId;
    if (profileId === viewerId) {
      res.status(400).json({ error: "You cannot unlike your own profile." });
      return;
    }
    if (!(await profileIsAvailable(profileId))) {
      res.status(404).json({ error: "Profile not found." });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const lockedProfiles = await tx
        .select({ id: profilesTable.id })
        .from(profilesTable)
        .where(inArray(profilesTable.id, [viewerId, profileId]))
        .orderBy(profilesTable.id)
        .for("update");
      if (lockedProfiles.length !== 2) return "unavailable" as const;

      const [block] = await tx.select({ id: blocksTable.id }).from(blocksTable)
        .where(or(
          and(eq(blocksTable.blockerId, viewerId), eq(blocksTable.blockedId, profileId)),
          and(eq(blocksTable.blockerId, profileId), eq(blocksTable.blockedId, viewerId)),
        )).limit(1);
      if (block) return "unavailable" as const;

      const [match] = await tx.select({ id: matchesTable.id }).from(matchesTable)
        .where(or(
          and(eq(matchesTable.userAId, viewerId), eq(matchesTable.userBId, profileId)),
          and(eq(matchesTable.userAId, profileId), eq(matchesTable.userBId, viewerId)),
        )).limit(1);
      if (match) return "matched" as const;

      const [reaction] = await tx.select({ type: reactionsTable.type }).from(reactionsTable)
        .where(and(
          eq(reactionsTable.fromUserId, viewerId),
          eq(reactionsTable.toUserId, profileId),
        ))
        .limit(1);
      if (reaction?.type === "super") return "super-liked" as const;
      if (reaction?.type === "like") {
        await tx.delete(reactionsTable).where(and(
          eq(reactionsTable.fromUserId, viewerId),
          eq(reactionsTable.toUserId, profileId),
          eq(reactionsTable.type, "like"),
        ));
      }
      return "ok" as const;
    });

    if (result === "unavailable") {
      res.status(404).json({ error: "Profile not found." });
      return;
    }
    if (result === "matched") {
      res.status(409).json({ error: "Matched profiles cannot be unliked here." });
      return;
    }
    if (result === "super-liked") {
      res.status(409).json({ error: "A Super Like cannot be removed from this profile." });
      return;
    }
    res.status(204).end();
  },
);

router.post(
  "/vibeswipe/profiles/:profileId/follow",
  async (req, res): Promise<void> => {
    const params = FollowProfileParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const userId = currentUserId(req);
    const profileId = params.data.profileId;
    if (userId === profileId) {
      res.status(400).json({ error: "You cannot follow your own profile." });
      return;
    }
    if (!(await profileIsAvailable(profileId))) {
      res.status(404).json({ error: "Profile not found." });
      return;
    }
    const saved = await db.transaction(async (tx) => {
      const [target] = await tx.select({ privateAccount: profilesTable.privateAccount })
        .from(profilesTable).where(eq(profilesTable.id, profileId)).limit(1);
      if (!target) return { blocked: false, inserted: false, pending: false };
      const [block] = await tx.select({ id: blocksTable.id }).from(blocksTable)
        .where(or(
          and(eq(blocksTable.blockerId, userId), eq(blocksTable.blockedId, profileId)),
          and(eq(blocksTable.blockerId, profileId), eq(blocksTable.blockedId, userId)),
        )).limit(1);
      if (block) return { blocked: true, inserted: false };

      if (target.privateAccount) {
        const [existingFollow] = await tx.select({ followerId: vibeSwipeFollowsTable.followerId })
          .from(vibeSwipeFollowsTable).where(and(
            eq(vibeSwipeFollowsTable.followerId, userId),
            eq(vibeSwipeFollowsTable.followedId, profileId),
          )).limit(1);
        if (existingFollow) return { blocked: false, inserted: false, pending: false };
        await tx.insert(vibeSwipeFollowRequestsTable)
          .values({ requesterId: userId, targetId: profileId })
          .onConflictDoNothing();
        return { blocked: false, inserted: false, pending: true };
      }
      await tx.delete(vibeSwipeFollowRequestsTable).where(and(
        eq(vibeSwipeFollowRequestsTable.requesterId, userId),
        eq(vibeSwipeFollowRequestsTable.targetId, profileId),
      ));
      const [follow] = await tx.insert(vibeSwipeFollowsTable)
        .values({ followerId: userId, followedId: profileId })
        .onConflictDoNothing()
        .returning({ followerId: vibeSwipeFollowsTable.followerId });
      const notification = planNewFollowNotification({
        followerId: userId,
        followedId: profileId,
        inserted: Boolean(follow),
      });
      if (notification) {
        await tx.insert(vibeSwipeNotificationsTable).values({
          ...notification,
          matchId: null,
          messageId: null,
        });
      }
      return { blocked: false, inserted: Boolean(follow), pending: false };
    });
    if (saved.blocked) {
      res.status(409).json({ error: "You cannot follow this profile." });
      return;
    }
    if (saved.inserted) {
      void sendFollowPush({ recipientId: profileId, actorId: userId }).catch((error: unknown) => {
        console.error("Unable to send follow push notification", error);
      });
    }
    res.json(GetProfileFollowSummaryResponse.parse(await followSummary(userId, profileId)));
  },
);

router.delete(
  "/vibeswipe/profiles/:profileId/follow",
  async (req, res): Promise<void> => {
    const params = UnfollowProfileParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const userId = currentUserId(req);
    if (userId !== params.data.profileId) {
      await db.transaction(async (tx) => {
        await tx.delete(vibeSwipeFollowsTable).where(and(
          eq(vibeSwipeFollowsTable.followerId, userId),
          eq(vibeSwipeFollowsTable.followedId, params.data.profileId),
        ));
        await tx.delete(vibeSwipeFollowRequestsTable).where(and(
          eq(vibeSwipeFollowRequestsTable.requesterId, userId),
          eq(vibeSwipeFollowRequestsTable.targetId, params.data.profileId),
        ));
      });
    }
    res.status(204).end();
  },
);

router.get("/vibeswipe/follow-requests", async (req, res): Promise<void> => {
  const userId = currentUserId(req);
  const rows = await db.select({
    requesterId: profilesTable.id,
    displayName: profilesTable.name,
    photos: profilesTable.photos,
    privateAccount: profilesTable.privateAccount,
    createdAt: vibeSwipeFollowRequestsTable.createdAt,
  }).from(vibeSwipeFollowRequestsTable)
    .innerJoin(profilesTable, eq(profilesTable.id, vibeSwipeFollowRequestsTable.requesterId))
    .where(and(
      eq(vibeSwipeFollowRequestsTable.targetId, userId),
      eq(profilesTable.deactivated, false),
      eq(profilesTable.adminSuspended, false),
      eq(profilesTable.isDemo, false),
      sql`NOT EXISTS (
        SELECT 1 FROM ${blocksTable}
        WHERE (${blocksTable.blockerId} = ${userId} AND ${blocksTable.blockedId} = ${vibeSwipeFollowRequestsTable.requesterId})
          OR (${blocksTable.blockerId} = ${vibeSwipeFollowRequestsTable.requesterId} AND ${blocksTable.blockedId} = ${userId})
      )`,
    ))
    .orderBy(desc(vibeSwipeFollowRequestsTable.createdAt))
    .limit(100);
  const response = await Promise.all(rows.map(async (row) => {
    const mayViewProfile = await canViewUserProfile(userId, row.requesterId);
    return {
      requesterId: row.requesterId,
      displayName: mayViewProfile ? row.displayName : "Private account",
      photo: mayViewProfile ? row.photos[0] ?? null : null,
      createdAt: row.createdAt,
    };
  }));
  res.json(GetFollowRequestsResponse.parse(response));
});

router.post("/vibeswipe/follow-requests/:requesterId/approve", async (req, res): Promise<void> => {
  const params = ApproveFollowRequestParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid follow request." }); return; }
  const ownerId = currentUserId(req);
  const requesterId = params.data.requesterId;
  const result = await db.transaction(async (tx) => {
    const [request] = await tx.select({ requesterId: vibeSwipeFollowRequestsTable.requesterId })
      .from(vibeSwipeFollowRequestsTable).where(and(
        eq(vibeSwipeFollowRequestsTable.requesterId, requesterId),
        eq(vibeSwipeFollowRequestsTable.targetId, ownerId),
      )).limit(1);
    if (!request) return "missing" as const;
    const [block] = await tx.select({ id: blocksTable.id }).from(blocksTable).where(or(
      and(eq(blocksTable.blockerId, ownerId), eq(blocksTable.blockedId, requesterId)),
      and(eq(blocksTable.blockerId, requesterId), eq(blocksTable.blockedId, ownerId)),
    )).limit(1);
    if (block) {
      await tx.delete(vibeSwipeFollowRequestsTable).where(and(
        eq(vibeSwipeFollowRequestsTable.requesterId, requesterId),
        eq(vibeSwipeFollowRequestsTable.targetId, ownerId),
      ));
      return "blocked" as const;
    }
    const [follow] = await tx.insert(vibeSwipeFollowsTable).values({
      followerId: requesterId,
      followedId: ownerId,
    }).onConflictDoNothing().returning({ followerId: vibeSwipeFollowsTable.followerId });
    await tx.delete(vibeSwipeFollowRequestsTable).where(and(
      eq(vibeSwipeFollowRequestsTable.requesterId, requesterId),
      eq(vibeSwipeFollowRequestsTable.targetId, ownerId),
    ));
    return follow ? "approved" as const : "already-approved" as const;
  });
  if (result === "missing") { res.status(404).json({ error: "Follow request not found." }); return; }
  if (result === "blocked") { res.status(204).end(); return; }
  res.status(204).end();
});

router.delete("/vibeswipe/follow-requests/:requesterId", async (req, res): Promise<void> => {
  const params = DeclineFollowRequestParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid follow request." }); return; }
  const userId = currentUserId(req);
  const otherId = params.data.requesterId;
  await db.delete(vibeSwipeFollowRequestsTable).where(or(
    and(
      eq(vibeSwipeFollowRequestsTable.requesterId, otherId),
      eq(vibeSwipeFollowRequestsTable.targetId, userId),
    ),
    and(
      eq(vibeSwipeFollowRequestsTable.requesterId, userId),
      eq(vibeSwipeFollowRequestsTable.targetId, otherId),
    ),
  ));
  res.status(204).end();
});

async function listFollows(
  req: Request,
  res: Parameters<Parameters<typeof router.get>[1]>[1],
  kind: "followers" | "following",
): Promise<void> {
  const parsed = (kind === "followers"
    ? GetProfileFollowersQueryParams
    : GetProfileFollowingQueryParams).safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { profileId, limit, offset } = parsed.data;
  const search = parsed.data.search?.trim().replace(/\s+/g, " ");
  const viewerId = currentUserId(req);
  if (!(await profileIsAvailable(profileId))) {
    res.status(404).json({ error: "Profile not found." });
    return;
  }
  if (profileId !== viewerId && await blockedBetween(viewerId, profileId)) {
    res.status(404).json({ error: "Profile not found." });
    return;
  }
  if (profileId !== viewerId && !(await canViewUserProfile(viewerId, profileId))) {
    res.status(404).json({ error: "Profile not found." });
    return;
  }

  const blockedRows = await db.select({
    blockerId: blocksTable.blockerId,
    blockedId: blocksTable.blockedId,
  }).from(blocksTable).where(or(
    eq(blocksTable.blockerId, viewerId),
    eq(blocksTable.blockedId, viewerId),
    eq(blocksTable.blockerId, profileId),
    eq(blocksTable.blockedId, profileId),
  ));
  const hiddenIds = new Set(blockedRows.flatMap((row) => [row.blockerId, row.blockedId])
    .filter((id) => id !== viewerId && id !== profileId));
  const memberColumn = kind === "followers"
    ? vibeSwipeFollowsTable.followerId
    : vibeSwipeFollowsTable.followedId;
  const ownerColumn = kind === "followers"
    ? vibeSwipeFollowsTable.followedId
    : vibeSwipeFollowsTable.followerId;
  const conditions: SQL[] = [
    eq(ownerColumn, profileId),
    eq(profilesTable.deactivated, false),
    eq(profilesTable.adminSuspended, false),
    eq(profilesTable.isDemo, false),
  ];
  if (hiddenIds.size) conditions.push(notInArray(memberColumn, [...hiddenIds]));
  if (search) {
    const escaped = search.replace(/[\\%_]/g, "\\$&");
    conditions.push(ilike(profilesTable.name, `%${escaped}%`));
  }
  const where = and(...conditions);
  const [totalRow] = await db.select({ value: count() })
    .from(vibeSwipeFollowsTable)
    .innerJoin(profilesTable, eq(profilesTable.id, memberColumn))
    .where(where);
  const rows = await db.select({
    profile: profilesTable,
    followedAt: vibeSwipeFollowsTable.createdAt,
  }).from(vibeSwipeFollowsTable)
    .innerJoin(profilesTable, eq(profilesTable.id, memberColumn))
    .where(where)
    .orderBy(desc(vibeSwipeFollowsTable.createdAt), desc(profilesTable.name))
    .limit(limit)
    .offset(offset);

  const memberIds = rows.map(({ profile }) => profile.id);
  const [viewerFollowing, followsViewer] = memberIds.length ? await Promise.all([
    db.select({ profileId: vibeSwipeFollowsTable.followedId })
      .from(vibeSwipeFollowsTable)
      .where(and(
        eq(vibeSwipeFollowsTable.followerId, viewerId),
        inArray(vibeSwipeFollowsTable.followedId, memberIds),
      )),
    db.select({ profileId: vibeSwipeFollowsTable.followerId })
      .from(vibeSwipeFollowsTable)
      .where(and(
        inArray(vibeSwipeFollowsTable.followerId, memberIds),
        eq(vibeSwipeFollowsTable.followedId, viewerId),
      )),
  ]) : [[], []];
  const followingIds = new Set(viewerFollowing.map((row) => row.profileId));
  const followsViewerIds = new Set(followsViewer.map((row) => row.profileId));
  const entries = rows.map(({ profile, followedAt }) => ({
    profile: { ...profile, age: profile.showAge ? profile.age : null },
    isFollowing: followingIds.has(profile.id),
    followsYou: followsViewerIds.has(profile.id),
    followedAt,
  }));
  const total = Number(totalRow?.value ?? 0);
  const response = {
    entries,
    total,
    offset,
    limit,
    nextOffset: offset + entries.length < total ? offset + entries.length : null,
  };
  if (kind === "followers") {
    res.json(GetProfileFollowersResponse.parse(response));
  } else {
    res.json(GetProfileFollowingResponse.parse(response));
  }
}

router.get("/vibeswipe/profile-followers", async (req, res): Promise<void> => {
  await listFollows(req, res, "followers");
});

router.get("/vibeswipe/profile-following", async (req, res): Promise<void> => {
  await listFollows(req, res, "following");
});

export default router;
