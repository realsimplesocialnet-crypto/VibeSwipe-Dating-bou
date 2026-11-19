import { getAuth } from "@clerk/express";
import {
  GetDirectChatMessagesQueryParams,
  GetDirectChatMessagesResponse,
  GetDirectChatsResponse,
  MarkDirectChatReadParams,
  SendDirectChatMessageBody,
  SendDirectChatMessageResponse,
  StartDirectChatBody,
  StartDirectChatResponse,
} from "@workspace/api-zod";
import {
  blocksTable,
  db,
  directConversationsTable,
  directMessagesTable,
  profilesTable,
  vibeSwipeFollowsTable,
} from "@workspace/db";
import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import { requireAuth } from "../middlewares/auth";
import { canStartChat, canViewUserProfile } from "../lib/profile-privacy";

const router: IRouter = Router();
router.use(requireAuth);

function uid(req: Request): string {
  const userId = getAuth(req).userId;
  if (!userId) throw new Error("Authenticated user is missing from the request");
  return userId;
}

async function visibleProfile(viewerId: string, profile: typeof profilesTable.$inferSelect) {
  if (await canViewUserProfile(viewerId, profile.id)) {
    return { ...profile, age: profile.showAge ? profile.age : null };
  }
  return {
    ...profile,
    name: "Private account",
    age: null,
    showAge: false,
    gender: "",
    lookingFor: "",
    bio: "",
    city: "",
    country: null,
    state: null,
    interests: [],
    occupation: "",
    occupationOther: "",
    photos: [],
    videoUrl: null,
    isDemo: false,
  };
}

async function getConversationForMember(conversationId: string, userId: string) {
  const [conversation] = await db.select().from(directConversationsTable)
    .where(and(
      eq(directConversationsTable.id, conversationId),
      or(eq(directConversationsTable.userAId, userId), eq(directConversationsTable.userBId, userId)),
    )).limit(1);
  return conversation;
}

router.get("/vibeswipe/direct-chats", async (req, res): Promise<void> => {
  const userId = uid(req);
  const otherProfileId = sql<string>`CASE
    WHEN ${directConversationsTable.userAId} = ${userId}
    THEN ${directConversationsTable.userBId}
    ELSE ${directConversationsTable.userAId}
  END`;
  const rows = await db.select({
    id: directConversationsTable.id,
    profile: profilesTable,
    lastMessage: sql<string | null>`(
      SELECT dm.content FROM ${directMessagesTable} dm
      WHERE dm.conversation_id = ${directConversationsTable.id}
      ORDER BY dm.created_at DESC, dm.id DESC LIMIT 1
    )`,
    lastMessageAt: sql<Date | null>`(
      SELECT dm.created_at FROM ${directMessagesTable} dm
      WHERE dm.conversation_id = ${directConversationsTable.id}
      ORDER BY dm.created_at DESC, dm.id DESC LIMIT 1
    )`,
    unreadCount: sql<number>`(
      SELECT count(*)::int FROM ${directMessagesTable} dm
      WHERE dm.conversation_id = ${directConversationsTable.id}
        AND dm.sender_id <> ${userId} AND dm.read_at IS NULL
    )`,
    updatedAt: directConversationsTable.updatedAt,
  }).from(directConversationsTable)
    .innerJoin(profilesTable, eq(profilesTable.id, otherProfileId))
    .where(and(
      or(eq(directConversationsTable.userAId, userId), eq(directConversationsTable.userBId, userId)),
      eq(profilesTable.deactivated, false),
      eq(profilesTable.adminSuspended, false),
    ))
    .orderBy(desc(directConversationsTable.updatedAt))
    .limit(100);
  const blockRows = await db.select({
    blockerId: blocksTable.blockerId,
    blockedId: blocksTable.blockedId,
  }).from(blocksTable).where(or(
    eq(blocksTable.blockerId, userId),
    eq(blocksTable.blockedId, userId),
  ));
  const blockedIds = new Set(blockRows.map((row) =>
    row.blockerId === userId ? row.blockedId : row.blockerId,
  ));
  const visibleRows = await Promise.all(rows
    .filter((row) => !blockedIds.has(row.profile.id))
    .map(async (row) => ({
      id: row.id,
      profile: await visibleProfile(userId, row.profile),
      lastMessage: row.lastMessage,
      lastMessageAt: row.lastMessageAt,
      unreadCount: Number(row.unreadCount),
    })));
  res.json(GetDirectChatsResponse.parse(visibleRows));
});

router.post("/vibeswipe/direct-chats", async (req, res): Promise<void> => {
  const body = StartDirectChatBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Choose a profile to message." }); return; }
  const userId = uid(req);
  const recipientId = body.data.recipientId;
  if (recipientId === userId) { res.status(400).json({ error: "You cannot message yourself." }); return; }

  const result = await db.transaction(async (tx) => {
    const [recipient] = await tx.select().from(profilesTable)
      .where(eq(profilesTable.id, recipientId)).for("update").limit(1);
    if (!recipient || recipient.deactivated || recipient.adminSuspended || recipient.isDemo) {
      return { status: "unavailable" as const };
    }
    const [block] = await tx.select({ id: blocksTable.id }).from(blocksTable).where(or(
      and(eq(blocksTable.blockerId, userId), eq(blocksTable.blockedId, recipientId)),
      and(eq(blocksTable.blockerId, recipientId), eq(blocksTable.blockedId, userId)),
    )).limit(1);
    if (block) return { status: "blocked" as const };

    const userAId = userId < recipientId ? userId : recipientId;
    const userBId = userId < recipientId ? recipientId : userId;
    let [conversation] = await tx.select().from(directConversationsTable).where(and(
      eq(directConversationsTable.userAId, userAId),
      eq(directConversationsTable.userBId, userBId),
    )).limit(1);
    if (!conversation) {
      if (recipient.whoCanMessage === "no_one") return { status: "not-allowed" as const };
      if (recipient.whoCanMessage === "followers") {
        const [approved] = await tx.select({ followerId: vibeSwipeFollowsTable.followerId })
          .from(vibeSwipeFollowsTable).where(and(
            eq(vibeSwipeFollowsTable.followerId, userId),
            eq(vibeSwipeFollowsTable.followedId, recipientId),
          )).limit(1);
        if (!approved) return { status: "not-allowed" as const };
      }
      [conversation] = await tx.insert(directConversationsTable).values({
        userAId,
        userBId,
        startedById: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).onConflictDoNothing().returning();
      if (!conversation) {
        [conversation] = await tx.select().from(directConversationsTable).where(and(
          eq(directConversationsTable.userAId, userAId),
          eq(directConversationsTable.userBId, userBId),
        )).limit(1);
      }
    }
    if (!conversation) return { status: "unavailable" as const };
    return { status: "ok" as const, conversation, recipient };
  });

  if (result.status === "unavailable") { res.status(404).json({ error: "Profile not found." }); return; }
  if (result.status === "blocked") { res.status(403).json({ error: "Messaging is unavailable with this person." }); return; }
  if (result.status === "not-allowed") { res.status(403).json({ error: "This person does not allow you to start a chat." }); return; }
  const [lastMessage] = await db.select().from(directMessagesTable)
    .where(eq(directMessagesTable.conversationId, result.conversation.id))
    .orderBy(desc(directMessagesTable.createdAt), desc(directMessagesTable.id)).limit(1);
  const [unread] = await db.select({ value: sql<number>`count(*)::int` })
    .from(directMessagesTable).where(and(
      eq(directMessagesTable.conversationId, result.conversation.id),
      sql`${directMessagesTable.senderId} <> ${userId}`,
      sql`${directMessagesTable.readAt} IS NULL`,
    ));
  res.status(201).json(StartDirectChatResponse.parse({
    id: result.conversation.id,
    profile: await visibleProfile(userId, result.recipient),
    lastMessage: lastMessage?.content ?? null,
    lastMessageAt: lastMessage?.createdAt ?? null,
    unreadCount: Number(unread?.value ?? 0),
  }));
});

router.get("/vibeswipe/direct-chat-messages", async (req, res): Promise<void> => {
  const query = GetDirectChatMessagesQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "Invalid direct chat page." }); return; }
  const userId = uid(req);
  const conversation = await getConversationForMember(query.data.conversationId, userId);
  if (!conversation) { res.status(403).json({ error: "You are not a participant in this conversation." }); return; }
  const otherId = conversation.userAId === userId ? conversation.userBId : conversation.userAId;
  const [block] = await db.select({ id: blocksTable.id }).from(blocksTable).where(or(
    and(eq(blocksTable.blockerId, userId), eq(blocksTable.blockedId, otherId)),
    and(eq(blocksTable.blockerId, otherId), eq(blocksTable.blockedId, userId)),
  )).limit(1);
  if (block) { res.status(403).json({ error: "This conversation is unavailable." }); return; }
  const { before, limit } = query.data;
  const rows = await db.select().from(directMessagesTable)
    .where(and(
      eq(directMessagesTable.conversationId, conversation.id),
      before ? lt(directMessagesTable.createdAt, before) : undefined,
    ))
    .orderBy(desc(directMessagesTable.createdAt), desc(directMessagesTable.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit).reverse();
  const nextBefore = rows.length > limit ? page[0]?.createdAt ?? null : null;
  res.json(GetDirectChatMessagesResponse.parse({ items: page, nextBefore }));
});

router.post("/vibeswipe/direct-chat-messages", async (req, res): Promise<void> => {
  const body = SendDirectChatMessageBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Enter a message up to 2,000 characters." }); return; }
  const userId = uid(req);
  const conversation = await getConversationForMember(body.data.conversationId, userId);
  if (!conversation) { res.status(403).json({ error: "You are not a participant in this conversation." }); return; }
  const otherId = conversation.userAId === userId ? conversation.userBId : conversation.userAId;
  if (await (async () => {
    const [block] = await db.select({ id: blocksTable.id }).from(blocksTable).where(or(
      and(eq(blocksTable.blockerId, userId), eq(blocksTable.blockedId, otherId)),
      and(eq(blocksTable.blockerId, otherId), eq(blocksTable.blockedId, userId)),
    )).limit(1);
    return Boolean(block);
  })()) {
    res.status(403).json({ error: "Messaging is unavailable while blocked." });
    return;
  }
  const [existingMessage] = await db.select({ id: directMessagesTable.id })
    .from(directMessagesTable)
    .where(eq(directMessagesTable.conversationId, conversation.id))
    .limit(1);
  if (!existingMessage && !(await canStartChat(userId, otherId))) {
    res.status(403).json({ error: "This person does not allow you to start a chat." });
    return;
  }
  const [message] = await db.transaction(async (tx) => {
    const [created] = await tx.insert(directMessagesTable).values({
      conversationId: conversation.id,
      senderId: userId,
      content: body.data.content.trim(),
      createdAt: new Date(),
    }).returning();
    await tx.update(directConversationsTable)
      .set({ updatedAt: created.createdAt })
      .where(eq(directConversationsTable.id, conversation.id));
    return [created];
  });
  res.status(201).json(SendDirectChatMessageResponse.parse(message));
});

router.post("/vibeswipe/direct-chats/:conversationId/read", async (req, res): Promise<void> => {
  const params = MarkDirectChatReadParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid conversation." }); return; }
  const userId = uid(req);
  const conversation = await getConversationForMember(params.data.conversationId, userId);
  if (!conversation) { res.status(403).json({ error: "You are not a participant in this conversation." }); return; }
  await db.update(directMessagesTable)
    .set({ readAt: new Date() })
    .where(and(
      eq(directMessagesTable.conversationId, conversation.id),
      sql`${directMessagesTable.senderId} <> ${userId}`,
      sql`${directMessagesTable.readAt} IS NULL`,
    ));
  res.status(204).end();
});

export default router;
