import { getAuth } from "@clerk/express";
import {
  HeartbeatPresenceBody,
  GetChatReadReceiptParams,
  GetChatReadReceiptResponse,
  GetMatchPresenceParams,
  GetMatchPresenceResponse,
  GetNotificationsResponse,
  HeartbeatPresenceResponse,
  MarkChatReadParams,
  MarkChatReadResponse,
  MarkNotificationReadParams,
  MarkNotificationReadResponse,
  MarkNotificationsReadBody,
} from "@workspace/api-zod";
import {
  blocksTable,
  db,
  matchesTable,
  profilesTable,
  vibeSwipeNotificationsTable,
  vibeSwipePresenceTable,
  vibeSwipeReadReceiptsTable,
} from "@workspace/db";
import { and, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import { requireAuth } from "../middlewares/auth";
import { CHAT_EVENT_CHANNEL } from "../lib/chatEventStream";

const router: IRouter = Router();
const ONLINE_WINDOW_MS = 45_000;

router.use(requireAuth);

function currentUserId(req: Request): string {
  const userId = getAuth(req).userId;
  if (!userId) throw new Error("Authenticated user is missing from the request");
  return userId;
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
  return Boolean(block);
}

async function requireAvailableMatch(matchId: string, userId: string) {
  const match = await getMatchForUser(matchId, userId);
  if (!match) return { match: null, error: "A valid match is required." };
  if (await isBlockedBetween(match.userAId, match.userBId)) {
    return { match: null, error: "Chat is unavailable while blocked." };
  }
  return { match, error: null };
}

router.put("/vibeswipe/presence", async (req, res): Promise<void> => {
  const body = HeartbeatPresenceBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const userId = currentUserId(req);
  const lastSeenAt = new Date();
  const [previousPresence] = await db
    .select({ isOnline: vibeSwipePresenceTable.isOnline })
    .from(vibeSwipePresenceTable)
    .where(eq(vibeSwipePresenceTable.userId, userId))
    .limit(1);
  await db
    .insert(vibeSwipePresenceTable)
    .values({ userId, lastSeenAt, isOnline: body.data.isActive })
    .onConflictDoUpdate({
      target: vibeSwipePresenceTable.userId,
      set: { lastSeenAt, isOnline: body.data.isActive },
    });
  if ((previousPresence?.isOnline ?? false) !== body.data.isActive) {
    const userMatches = await db
      .select({ id: matchesTable.id })
      .from(matchesTable)
      .where(
        or(eq(matchesTable.userAId, userId), eq(matchesTable.userBId, userId)),
      );
    await Promise.all(
      userMatches.map(({ id }) =>
        db.execute(
          sql`SELECT pg_notify(${CHAT_EVENT_CHANNEL}, ${JSON.stringify({
            type: "presence",
            matchId: id,
          })})`,
        ),
      ),
    );
  }
  HeartbeatPresenceResponse.parse(undefined);
  res.status(204).end();
});

router.get(
  "/vibeswipe/matches/:matchId/presence",
  async (req, res): Promise<void> => {
    const params = GetMatchPresenceParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const userId = currentUserId(req);
    const { match, error } = await requireAvailableMatch(
      params.data.matchId,
      userId,
    );
    if (!match) {
      res.status(403).json({ error });
      return;
    }
    const otherUserId = match.userAId === userId ? match.userBId : match.userAId;
    const [presence] = await db
      .select({
        lastSeenAt: vibeSwipePresenceTable.lastSeenAt,
        isOnline: vibeSwipePresenceTable.isOnline,
      })
      .from(vibeSwipePresenceTable)
      .where(eq(vibeSwipePresenceTable.userId, otherUserId))
      .limit(1);
    const lastSeenAt = presence?.lastSeenAt ?? null;
    const now = Date.now();
    res.json(
      GetMatchPresenceResponse.parse({
        isOnline:
          presence?.isOnline === true &&
          lastSeenAt !== null &&
          lastSeenAt.getTime() <= now &&
          now - lastSeenAt.getTime() <= ONLINE_WINDOW_MS,
        lastSeenAt,
      }),
    );
  },
);

router.put(
  "/vibeswipe/matches/:matchId/read",
  async (req, res): Promise<void> => {
    const params = MarkChatReadParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const userId = currentUserId(req);
    const { match, error } = await requireAvailableMatch(
      params.data.matchId,
      userId,
    );
    if (!match) {
      res.status(403).json({ error });
      return;
    }
    const readAt = new Date();
    await db.transaction(async (tx) => {
      await tx
        .insert(vibeSwipeReadReceiptsTable)
        .values({ userId, matchId: match.id, readAt })
        .onConflictDoUpdate({
          target: [
            vibeSwipeReadReceiptsTable.userId,
            vibeSwipeReadReceiptsTable.matchId,
          ],
          set: { readAt },
        });
      await tx.update(vibeSwipeNotificationsTable).set({ readAt }).where(and(
        eq(vibeSwipeNotificationsTable.recipientId, userId),
        eq(vibeSwipeNotificationsTable.matchId, match.id),
        eq(vibeSwipeNotificationsTable.type, "new_message"),
        isNull(vibeSwipeNotificationsTable.readAt),
        lte(vibeSwipeNotificationsTable.createdAt, readAt),
      ));
    });
    MarkChatReadResponse.parse(undefined);
    res.status(204).end();
  },
);

router.get(
  "/vibeswipe/matches/:matchId/read",
  async (req, res): Promise<void> => {
    const params = GetChatReadReceiptParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const userId = currentUserId(req);
    const { match, error } = await requireAvailableMatch(
      params.data.matchId,
      userId,
    );
    if (!match) {
      res.status(403).json({ error });
      return;
    }
    const otherUserId = match.userAId === userId ? match.userBId : match.userAId;
    const [receipt] = await db
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
      GetChatReadReceiptResponse.parse({ readAt: receipt?.readAt ?? null }),
    );
  },
);

router.get("/vibeswipe/notifications", async (req, res): Promise<void> => {
  const userId = currentUserId(req);
  const notificationRows = await db
    .select({
      notification: vibeSwipeNotificationsTable,
      actor: profilesTable,
    })
    .from(vibeSwipeNotificationsTable)
    .innerJoin(
      profilesTable,
      eq(vibeSwipeNotificationsTable.actorId, profilesTable.id),
    )
    .where(eq(vibeSwipeNotificationsTable.recipientId, userId))
    .orderBy(desc(vibeSwipeNotificationsTable.createdAt));

  const unreadCounts = { matches: 0, messages: 0, views: 0, likes: 0, reels: 0 };
  const notifications = notificationRows.map(({ notification, actor }) => {
    if (!notification.readAt) {
      if (notification.type === "new_match") unreadCounts.matches += 1;
      if (notification.type === "new_message") unreadCounts.messages += 1;
      if (notification.type === "profile_view") unreadCounts.views += 1;
      if (notification.type === "reel_like" || notification.type === "reel_comment_reply") unreadCounts.reels += 1;
      if (notification.type === "new_like" || notification.type === "new_super_like") unreadCounts.likes += 1;
    }
    return {
      id: notification.id,
      type: notification.type,
      actor,
      matchId: notification.matchId,
      messageId: notification.messageId,
      reelId: notification.reelId,
      commentId: notification.commentId,
      createdAt: notification.createdAt,
      readAt: notification.readAt,
    };
  });
  res.json(GetNotificationsResponse.parse({ notifications, unreadCounts }));
});

router.put("/vibeswipe/notifications/read", async (req, res): Promise<void> => {
  const body = MarkNotificationsReadBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid notification IDs." });
    return;
  }
  await db.update(vibeSwipeNotificationsTable).set({ readAt: new Date() }).where(and(
    eq(vibeSwipeNotificationsTable.recipientId, currentUserId(req)),
    inArray(vibeSwipeNotificationsTable.id, body.data.notificationIds),
    isNull(vibeSwipeNotificationsTable.readAt),
  ));
  res.status(204).end();
});

router.put(
  "/vibeswipe/notifications/:notificationId/read",
  async (req, res): Promise<void> => {
    const params = MarkNotificationReadParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const userId = currentUserId(req);
    const [notification] = await db
      .update(vibeSwipeNotificationsTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(vibeSwipeNotificationsTable.id, params.data.notificationId),
          eq(vibeSwipeNotificationsTable.recipientId, userId),
        ),
      )
      .returning({ id: vibeSwipeNotificationsTable.id });
    if (!notification) {
      res.status(404).json({ error: "Notification not found." });
      return;
    }
    MarkNotificationReadResponse.parse(undefined);
    res.status(204).end();
  },
);

export default router;
