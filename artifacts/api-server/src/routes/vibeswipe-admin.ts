import { clerkClient, getAuth } from "@clerk/express";
import {
  adminAuditTable,
  adminDeletedUsersTable,
  adminMediaDeletionTable,
  db,
  matchesTable,
  mediaAssetsTable,
  messagesTable,
  profilesTable,
  reactionsTable,
  vibeSwipePresenceTable,
  faceVerificationSessionsTable,
} from "@workspace/db";
import { and, desc, eq, gte, ilike, inArray, lt, or, sql } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import { createAdminGuard } from "../lib/admin-access";
import { loadAdminIdentity } from "../lib/admin-identity";
import { adminTimestamp } from "../lib/admin-timestamp";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";
import { CHAT_EVENT_CHANNEL } from "../lib/chatEventStream";

const router: IRouter = Router();
const storage = new ObjectStorageService();
const PAGE_SIZE = 25;
const MAX_EXPORT_MESSAGES = 50_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const adminGuard = createAdminGuard({
  userId: (req) => getAuth(req).userId,
  loadUser: async (id) => clerkClient.users.getUser(id),
  email: () => process.env.VIBESWIPE_ADMIN_EMAIL ?? "",
});
router.use("/vibeswipe/admin", adminGuard);

function currentAdmin(req: Request): string {
  return getAuth(req).userId!;
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function dateRange(query: Request["query"]): { from?: Date; to?: Date } | null {
  const from = query.from;
  const to = query.to;
  if ((from !== undefined && !validDate(from)) || (to !== undefined && !validDate(to))) return null;
  if (typeof from === "string" && typeof to === "string" && from > to) return null;
  return {
    ...(typeof from === "string" ? { from: new Date(`${from}T00:00:00.000Z`) } : {}),
    ...(typeof to === "string" ? { to: new Date(`${to}T00:00:00.000Z`) } : {}),
  };
}

function rangeConditions(column: typeof messagesTable.createdAt, range: { from?: Date; to?: Date }) {
  const conditions = [];
  if (range.from) conditions.push(gte(column, range.from));
  if (range.to) conditions.push(lt(column, new Date(range.to.getTime() + 86_400_000)));
  return conditions;
}

async function getAdminUser(profile: typeof profilesTable.$inferSelect) {
  const [presence, matches, identity] = await Promise.all([
    db.select().from(vibeSwipePresenceTable).where(eq(vibeSwipePresenceTable.userId, profile.id)).limit(1),
    db.select({ id: matchesTable.id }).from(matchesTable)
      .where(or(eq(matchesTable.userAId, profile.id), eq(matchesTable.userBId, profile.id))),
    loadAdminIdentity(() => clerkClient.users.getUser(profile.id)),
  ]);
  const phone = identity?.phoneNumbers.find((item) => item.id === identity.primaryPhoneNumberId)?.phoneNumber ?? null;
  const email = identity?.emailAddresses.find((item) => item.id === identity.primaryEmailAddressId)?.emailAddress ?? null;
  const lastSeenAt = presence[0]?.lastSeenAt ?? null;
  return {
    id: profile.id,
    name: profile.name,
    age: profile.age,
    city: profile.city,
    state: profile.state,
    country: profile.country,
    gender: profile.gender,
    bio: profile.bio,
    occupation: profile.occupation,
    interests: profile.interests,
    photos: profile.photos,
    verified: profile.isVerified,
    suspended: profile.adminSuspended,
    deactivated: profile.deactivated,
    online: !!presence[0]?.isOnline && !!lastSeenAt && Date.now() - lastSeenAt.getTime() <= 45_000,
    connectionCount: matches.length,
    joinedAt: profile.createdAt.toISOString(),
    lastSeenAt: lastSeenAt?.toISOString() ?? null,
    username: identity?.username ?? null,
    phone,
    email,
  };
}

async function chatInfo(match: typeof matchesTable.$inferSelect) {
  const [profiles, messageSummary] = await Promise.all([
    db.select({ id: profilesTable.id, name: profilesTable.name }).from(profilesTable)
      .where(inArray(profilesTable.id, [match.userAId, match.userBId])),
    db.select({
      lastMessageAt: sql<Date | string | null>`max(${messagesTable.createdAt})`,
      messageCount: sql<number>`count(*)::int`,
    }).from(messagesTable).where(eq(messagesTable.matchId, match.id)),
  ]);
  const names = new Map(profiles.map((profile) => [profile.id, profile.name]));
  const summary = messageSummary[0];
  return {
    id: match.id,
    userAId: match.userAId,
    userBId: match.userBId,
    userAName: names.get(match.userAId) ?? "Deleted user",
    userBName: names.get(match.userBId) ?? "Deleted user",
    createdAt: match.createdAt.toISOString(),
    lastMessageAt: adminTimestamp(summary?.lastMessageAt),
    messageCount: Number(summary?.messageCount ?? 0),
    lastMessage: null,
  };
}

async function stats() {
  const [users] = await db.select({ count: sql<number>`count(*)::int` }).from(profilesTable);
  const [online] = await db.select({ count: sql<number>`count(*)::int` }).from(vibeSwipePresenceTable)
    .innerJoin(profilesTable, eq(vibeSwipePresenceTable.userId, profilesTable.id))
    .where(and(
      eq(vibeSwipePresenceTable.isOnline, true),
      gte(vibeSwipePresenceTable.lastSeenAt, new Date(Date.now() - 45_000)),
      eq(profilesTable.deactivated, false),
      eq(profilesTable.adminSuspended, false),
    ));
  const [chats] = await db.select({ count: sql<number>`count(*)::int` }).from(matchesTable);
  const [activeChats] = await db.select({ count: sql<number>`count(distinct ${messagesTable.matchId})::int` }).from(messagesTable)
    .where(gte(messagesTable.createdAt, new Date(new Date().toISOString().slice(0, 10))));
  const [today] = await db.select({ count: sql<number>`count(*)::int` }).from(profilesTable)
    .where(gte(profilesTable.createdAt, new Date(new Date().toISOString().slice(0, 10))));
  const [likes] = await db.select({ count: sql<number>`count(*)::int` }).from(reactionsTable)
    .where(and(
      inArray(reactionsTable.type, ["like", "super"]),
      sql`NOT EXISTS (
        SELECT 1 FROM vibeswipe_reactions reciprocal
        WHERE reciprocal.from_user_id = ${reactionsTable.toUserId}
          AND reciprocal.to_user_id = ${reactionsTable.fromUserId}
          AND reciprocal.type IN ('like', 'super')
      )`,
    ));
  return {
    totalUsers: Number(users?.count ?? 0),
    onlineUsers: Number(online?.count ?? 0),
    activeChats: Number(activeChats?.count ?? 0),
    signupsToday: Number(today?.count ?? 0),
    totalMatches: Number(chats?.count ?? 0),
    pendingLikes: Number(likes?.count ?? 0),
  };
}

async function auditPrivateAccess(req: Request, action: string, targetId: string): Promise<void> {
  await db.insert(adminAuditTable).values({ actorId: currentAdmin(req), action, targetId });
}

function adminActivityDescription(action: string): string {
  const descriptions: Record<string, string> = {
    verify: "Administrator verified a member",
    unverify: "Administrator removed a member’s verification",
    block: "Administrator suspended a member",
    unblock: "Administrator restored a member’s access",
    delete_user: "Administrator deleted a member account",
    delete_chat: "Administrator deleted a conversation",
    delete_message: "Administrator deleted a message",
    remove_connection: "Administrator removed a connection",
    read_chat: "Administrator viewed a private conversation",
    export_chat: "Administrator exported a private conversation",
    access_media: "Administrator accessed private media",
  };
  return descriptions[action] ?? "Administrator performed an administrative action";
}

async function closeAdminChat(matchId: string): Promise<void> {
  await db.execute(sql`SELECT pg_notify(${CHAT_EVENT_CHANNEL}, ${JSON.stringify({ type: "close", matchId })})`);
}

async function closeAdminUserChats(userId: string): Promise<void> {
  const matches = await db.select({ id: matchesTable.id }).from(matchesTable)
    .where(or(eq(matchesTable.userAId, userId), eq(matchesTable.userBId, userId)));
  await Promise.all(matches.map((match) => closeAdminChat(match.id)));
}

router.get("/vibeswipe/admin/session", async (req, res): Promise<void> => {
  res.json(res.locals.adminIdentity);
});

router.get("/vibeswipe/admin/dashboard", async (req, res): Promise<void> => {
  const section = typeof req.query.section === "string" ? req.query.section : "overview";
  const sections = ["overview", "users", "chats", "online", "connections", "user", "chat"];
  const page = Number(req.query.page ?? 1);
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const range = dateRange(req.query);
  const userId = typeof req.query.userId === "string" ? req.query.userId : "";
  const chatId = typeof req.query.chatId === "string" ? req.query.chatId : "";
  if (!sections.includes(section) || !Number.isInteger(page) || page < 1 || page > 100_000 ||
      (req.query.section !== undefined && typeof req.query.section !== "string") ||
      (req.query.q !== undefined && typeof req.query.q !== "string") ||
      (req.query.userId !== undefined && typeof req.query.userId !== "string") ||
      (req.query.chatId !== undefined && typeof req.query.chatId !== "string") || !range ||
      q.length > 150 || (userId && userId.length > 150) || (chatId && !UUID.test(chatId))) {
    res.status(400).json({ error: "Invalid dashboard query." });
    return;
  }
  const offset = (page - 1) * PAGE_SIZE;
  const result = {
    section, page, pageSize: PAGE_SIZE, total: 0,
    users: [] as unknown[], chats: [] as unknown[], messages: [] as unknown[],
    connections: [] as unknown[], activity: [] as unknown[], stats: await stats(),
    selectedUser: null as unknown, selectedChat: null as unknown,
  };

  if (section === "overview") {
    const [recentProfiles, recentMessages, recentMatches, recentActions] = await Promise.all([
      db.select().from(profilesTable).orderBy(desc(profilesTable.createdAt)).limit(6),
      db.select({ id: messagesTable.id, createdAt: messagesTable.createdAt, senderId: messagesTable.senderId })
        .from(messagesTable).orderBy(desc(messagesTable.createdAt)).limit(10),
      db.select().from(matchesTable).orderBy(desc(matchesTable.updatedAt)).limit(6),
      db.select().from(adminAuditTable).orderBy(desc(adminAuditTable.createdAt)).limit(10),
    ]);
    const [messageSenders, recentChatInfo] = await Promise.all([
      recentMessages.length
        ? db.select({ id: profilesTable.id, name: profilesTable.name }).from(profilesTable)
          .where(inArray(profilesTable.id, [...new Set(recentMessages.map((message) => message.senderId))]))
        : Promise.resolve([] as { id: string; name: string }[]),
      Promise.all(recentMatches.map(chatInfo)),
    ]);
    result.users = await Promise.all(recentProfiles.map(getAdminUser));
    result.chats = recentChatInfo;
    const feed = [
      ...recentProfiles.map((profile) => ({ id: `user:${profile.id}`, description: `${profile.name} joined`, createdAt: profile.createdAt })),
      ...recentMessages.map((message) => ({
        id: `message:${message.id}`,
        description: `New message from ${messageSenders.find((sender) => sender.id === message.senderId)?.name ?? "a member"}`,
        createdAt: message.createdAt,
      })),
      ...recentMatches.map((match) => ({
        id: `match:${match.id}`,
        description: `A new conversation started between ${
          recentChatInfo.find((chat) => chat.id === match.id)?.userAName ?? "a member"
        } and ${recentChatInfo.find((chat) => chat.id === match.id)?.userBName ?? "a member"}`,
        createdAt: match.createdAt,
      })),
      ...recentActions.map((item) => ({
        id: `action:${item.id}`,
        description: adminActivityDescription(item.action),
        createdAt: item.createdAt,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 20);
    result.activity = feed.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() }));
    result.total = feed.length;
  } else if (section === "users" || section === "online" || section === "user") {
    const profiles = section === "user"
      ? (userId ? await db.select().from(profilesTable).where(eq(profilesTable.id, userId)).limit(1) : [])
      : await db.select().from(profilesTable).orderBy(desc(profilesTable.createdAt));
    let matches = profiles;
    if (section === "online") {
      const recent = await db.select({ userId: vibeSwipePresenceTable.userId }).from(vibeSwipePresenceTable)
        .innerJoin(profilesTable, eq(vibeSwipePresenceTable.userId, profilesTable.id))
        .where(and(
          eq(vibeSwipePresenceTable.isOnline, true),
          gte(vibeSwipePresenceTable.lastSeenAt, new Date(Date.now() - 45_000)),
          eq(profilesTable.deactivated, false),
          eq(profilesTable.adminSuspended, false),
        ));
      const onlineIds = new Set(recent.map((entry) => entry.userId));
      matches = profiles.filter((profile) =>
        onlineIds.has(profile.id) && !profile.deactivated && !profile.adminSuspended);
    }
    if (range.from || range.to) {
      matches = matches.filter((profile) =>
        (!range.from || profile.createdAt >= range.from) &&
        (!range.to || profile.createdAt < new Date(range.to.getTime() + 86_400_000)));
    }
    if (q || userId) {
      const search = q || userId;
      const identityMatches = q
        ? await clerkClient.users.getUserList({ query: q, limit: 500 })
        : { data: [] };
      const identityIds = new Set(identityMatches.data.map((entry) => entry.id));
      matches = matches.filter((profile) => (!userId || profile.id === userId) &&
        (!q || identityIds.has(profile.id) || profile.id.toLowerCase().includes(search.toLowerCase()) ||
          profile.name.toLowerCase().includes(search.toLowerCase())));
    }
    result.total = matches.length;
    result.users = await Promise.all(matches.slice(offset, offset + PAGE_SIZE).map(getAdminUser));
    if (section === "user" && result.users[0]) result.selectedUser = result.users[0];
  } else if (section === "chats" || section === "chat") {
    const all = chatId
      ? await db.select().from(matchesTable).where(eq(matchesTable.id, chatId)).limit(1)
      : await db.select().from(matchesTable).orderBy(desc(matchesTable.updatedAt));
    const chats = await Promise.all(all.map(chatInfo));
    let filtered = chats;
    if ((range.from || range.to) && !(section === "chat" && chatId)) {
      filtered = chats.filter((chat) => {
        const when = chat.lastMessageAt ?? chat.createdAt;
        const time = new Date(when).getTime();
        return (!range.from || time >= range.from.getTime()) &&
          (!range.to || time < range.to.getTime() + 86_400_000);
      });
    }
    if (userId) filtered = filtered.filter((chat) => chat.userAId === userId || chat.userBId === userId);
    if (q && !(section === "chat" && chatId)) filtered = filtered.filter((chat) => `${chat.userAName} ${chat.userBName} ${chat.userAId} ${chat.userBId}`.toLowerCase().includes(q.toLowerCase()));
    result.total = filtered.length;
    const pageChats = section === "chat" ? filtered : filtered.slice(offset, offset + PAGE_SIZE);
    result.chats = pageChats;
    if (section === "chat" && pageChats[0]) {
      result.selectedChat = pageChats[0];
      await auditPrivateAccess(req, "read_chat", pageChats[0].id);
      const selectedMessageConditions = [
        eq(messagesTable.matchId, pageChats[0].id),
        ...rangeConditions(messagesTable.createdAt, range),
        ...(q ? [ilike(messagesTable.content, `%${q.replace(/[\\%_]/g, "\\$&")}%`)] : []),
      ];
      const [messageCount] = await db.select({ count: sql<number>`count(*)::int` })
        .from(messagesTable).where(and(...selectedMessageConditions));
      result.total = Number(messageCount?.count ?? 0);
      const messageRows = await db.select().from(messagesTable).where(and(...selectedMessageConditions))
        .orderBy(desc(messagesTable.createdAt), desc(messagesTable.id)).limit(PAGE_SIZE).offset(offset);
      result.messages = await Promise.all(messageRows.map(async (message) => {
        const [sender] = await db.select({ name: profilesTable.name }).from(profilesTable).where(eq(profilesTable.id, message.senderId)).limit(1);
        return {
          id: message.id, senderId: message.senderId, senderName: sender?.name ?? "Deleted user",
          content: message.content, mediaReference: message.mediaReference, mediaType: message.mediaType,
          deleted: message.deletedForEveryone, createdAt: message.createdAt.toISOString(),
        };
      }));
    }
  } else if (section === "connections") {
    const [matches, reactions] = await Promise.all([
      db.select().from(matchesTable).orderBy(desc(matchesTable.createdAt)),
      db.select().from(reactionsTable).where(inArray(reactionsTable.type, ["like", "super"])).orderBy(desc(reactionsTable.createdAt)),
    ]);
    const pending: typeof reactions = [];
    const reciprocalMatches = new Set(matches.flatMap((match) => [`${match.userAId}\u0000${match.userBId}`, `${match.userBId}\u0000${match.userAId}`]));
    for (const reaction of reactions) {
      if (reciprocalMatches.has(`${reaction.toUserId}\u0000${reaction.fromUserId}`)) continue;
      pending.push(reaction);
    }
    const rows = [
      ...matches.map((match) => ({ id: match.id, userAId: match.userAId, userBId: match.userBId, status: "mutual", mutualCount: 2, createdAt: match.createdAt })),
      ...pending.map((reaction) => ({ id: reaction.id, userAId: reaction.fromUserId, userBId: reaction.toUserId, status: reaction.type === "super" ? "pending_super_like" : "pending_like", mutualCount: 1, createdAt: reaction.createdAt })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    let filteredRows = rows;
    if (userId) filteredRows = filteredRows.filter((row) => row.userAId === userId || row.userBId === userId);
    if (range.from || range.to) {
      filteredRows = filteredRows.filter((row) =>
        (!range.from || row.createdAt >= range.from) &&
        (!range.to || row.createdAt < new Date(range.to.getTime() + 86_400_000)));
    }
    if (q) {
      const queryIds = new Set((await clerkClient.users.getUserList({ query: q, limit: 500 })).data.map((user) => user.id));
      const queryProfiles = await db.select({ id: profilesTable.id, name: profilesTable.name }).from(profilesTable);
      const matchingIds = new Set(queryProfiles.filter((profile) =>
        profile.name.toLowerCase().includes(q.toLowerCase()) || queryIds.has(profile.id) ||
        profile.id.toLowerCase().includes(q.toLowerCase())).map((profile) => profile.id));
      filteredRows = filteredRows.filter((row) => matchingIds.has(row.userAId) || matchingIds.has(row.userBId));
    }
    const pageRows = filteredRows.slice(offset, offset + PAGE_SIZE);
    const ids = [...new Set(pageRows.flatMap((row) => [row.userAId, row.userBId]))];
    const names = ids.length ? await db.select({ id: profilesTable.id, name: profilesTable.name }).from(profilesTable).where(inArray(profilesTable.id, ids)) : [];
    const nameMap = new Map(names.map((profile) => [profile.id, profile.name]));
    result.total = filteredRows.length;
    result.connections = pageRows.map((row) => ({
      ...row, userAName: nameMap.get(row.userAId) ?? "Deleted user", userBName: nameMap.get(row.userBId) ?? "Deleted user",
      createdAt: row.createdAt.toISOString(),
    }));
  }
  res.json(result);
});

router.get("/vibeswipe/admin/export", async (req, res): Promise<void> => {
  const chatId = typeof req.query.chatId === "string" ? req.query.chatId : "";
  const format = req.query.format;
  const range = dateRange(req.query);
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const userId = typeof req.query.userId === "string" ? req.query.userId : "";
  if (!UUID.test(chatId) || (format !== "txt" && format !== "json") || !range ||
      (req.query.q !== undefined && typeof req.query.q !== "string") ||
      (req.query.userId !== undefined && typeof req.query.userId !== "string") ||
      q.length > 150 || (userId && userId.length > 150)) {
    res.status(400).json({ error: "A valid chatId, format, and date range are required." });
    return;
  }
  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, chatId)).limit(1);
  if (!match || (userId && match.userAId !== userId && match.userBId !== userId)) {
    res.status(404).json({ error: "Chat not found for the selected user." }); return;
  }
  const conditions = [
    eq(messagesTable.matchId, chatId),
    ...rangeConditions(messagesTable.createdAt, range),
    ...(q ? [ilike(messagesTable.content, `%${q.replace(/[\\%_]/g, "\\$&")}%`)] : []),
  ];
  const [count] = await db.select({ count: sql<number>`count(*)::int` }).from(messagesTable).where(and(...conditions));
  if (Number(count?.count ?? 0) > MAX_EXPORT_MESSAGES) {
    res.status(413).json({ error: `Export exceeds the ${MAX_EXPORT_MESSAGES} message limit.` });
    return;
  }
  await auditPrivateAccess(req, "export_chat", chatId);
  const messages = await db.select().from(messagesTable).where(and(...conditions))
    .orderBy(messagesTable.createdAt, messagesTable.id).limit(MAX_EXPORT_MESSAGES + 1);
  const senders = [...new Set(messages.map((message) => message.senderId))];
  const profiles = senders.length ? await db.select({ id: profilesTable.id, name: profilesTable.name }).from(profilesTable).where(inArray(profilesTable.id, senders)) : [];
  const names = new Map(profiles.map((profile) => [profile.id, profile.name]));
  const exported = messages.map((message) => ({
    id: message.id, senderId: message.senderId, senderName: names.get(message.senderId) ?? "Deleted user",
    content: message.deletedForEveryone ? "[Message deleted]" : message.content,
    mediaReference: message.deletedForEveryone ? null : message.mediaReference,
    mediaType: message.deletedForEveryone ? null : message.mediaType,
    deleted: message.deletedForEveryone, createdAt: message.createdAt.toISOString(),
  }));
  const content = format === "json"
    ? JSON.stringify({ chatId, messages: exported }, null, 2)
    : exported.map((message) => `[${message.createdAt}] ${message.senderName}: ${message.content}${message.mediaReference ? ` [${message.mediaType ?? "media"}: ${message.mediaReference}]` : ""}`).join("\n");
  res.json({
    filename: `chat-${chatId}.${format}`,
    content,
    mimeType: format === "json" ? "application/json" : "text/plain",
  });
});

router.get("/vibeswipe/admin/media/:mediaId", async (req, res): Promise<void> => {
  const mediaId = Array.isArray(req.params.mediaId) ? req.params.mediaId[0] : req.params.mediaId;
  if (!UUID.test(mediaId)) { res.status(400).json({ error: "Invalid media id." }); return; }
  const [asset] = await db.select().from(mediaAssetsTable).where(eq(mediaAssetsTable.id, mediaId)).limit(1);
  if (!asset) { res.status(404).json({ error: "Media not found." }); return; }
  await auditPrivateAccess(req, "access_media", asset.id);
  try {
    const file = await storage.getObjectEntityFile(asset.objectPath);
    const [metadata] = await file.getMetadata();
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Type", metadata.contentType ?? asset.contentType ?? "application/octet-stream");
    if (metadata.size) res.setHeader("Content-Length", String(metadata.size));
    file.createReadStream().on("error", () => {
      if (!res.headersSent) res.status(404).end();
      else res.destroy();
    }).pipe(res);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) { res.status(404).json({ error: "Media not found." }); return; }
    throw error;
  }
});

router.post("/vibeswipe/admin/actions", async (req, res): Promise<void> => {
  const { action, targetId, confirmation } = req.body ?? {};
  const actions = ["verify", "unverify", "block", "unblock", "delete_user", "delete_chat", "delete_message", "remove_connection"];
  if (!actions.includes(action) || typeof targetId !== "string" || !targetId.trim() || targetId.length > 150 ||
      (confirmation !== undefined && (typeof confirmation !== "string" || confirmation.length > 30))) {
    res.status(400).json({ error: "Invalid moderation action." }); return;
  }
  const requiredConfirmation: Record<string, string> = {
    delete_user: "DELETE", delete_chat: "DELETE", delete_message: "DELETE", remove_connection: "REMOVE",
  };
  if (requiredConfirmation[action] && confirmation !== requiredConfirmation[action]) {
    res.status(400).json({ error: `Confirmation must exactly match "${requiredConfirmation[action]}".` }); return;
  }
  const actorId = currentAdmin(req);
  const doAudit = async () => db.insert(adminAuditTable).values({ actorId, action, targetId });
  if (action === "verify" || action === "unverify" || action === "block" || action === "unblock" || action === "delete_user") {
    if (targetId === actorId) { res.status(400).json({ error: "Administrators cannot moderate their own account." }); return; }
    const [target] = await db.select({ id: profilesTable.id }).from(profilesTable).where(eq(profilesTable.id, targetId)).limit(1);
    if (!target) { res.status(404).json({ error: "User not found." }); return; }
    if (action === "verify") {
      res.status(409).json({ error: "Review and approve the checked photo in the Verification queue. Direct badge grants are disabled." }); return;
    } else if (action === "unverify") {
      await db.transaction(async tx => {
        await tx.update(profilesTable).set({ isVerified: false }).where(eq(profilesTable.id, targetId));
        await tx.update(faceVerificationSessionsTable).set({ status: "cancelled", rejectionReason: "Verification was removed by the administrator." }).where(and(
          eq(faceVerificationSessionsTable.userId, targetId),
          inArray(faceVerificationSessionsTable.status, ["pending", "processing", "awaiting_review"]),
        ));
      });
    } else if (action === "block" || action === "unblock") {
      if (action === "block") {
        await db.update(profilesTable).set({ adminSuspended: true }).where(eq(profilesTable.id, targetId));
        await closeAdminUserChats(targetId);
      } else {
        await db.update(profilesTable).set({ adminSuspended: false }).where(eq(profilesTable.id, targetId));
      }
      // Suspension is enforced by shared requireAuth middleware on every dating API route.
    } else {
      const userMatches = await db.select({ id: matchesTable.id }).from(matchesTable)
        .where(or(eq(matchesTable.userAId, targetId), eq(matchesTable.userBId, targetId)));
      const assets = await db.select({ id: mediaAssetsTable.id, objectPath: mediaAssetsTable.objectPath }).from(mediaAssetsTable)
        .where(and(eq(mediaAssetsTable.ownerId, targetId), sql`${mediaAssetsTable.matchId} IS NOT NULL`));
      await db.transaction(async (tx) => {
        for (const asset of assets) await tx.insert(adminMediaDeletionTable).values({ objectPath: asset.objectPath, mediaId: asset.id }).onConflictDoNothing();
        await tx.insert(adminDeletedUsersTable).values({ userId: targetId }).onConflictDoNothing();
        await tx.delete(profilesTable).where(eq(profilesTable.id, targetId));
      });
      await Promise.all(userMatches.map((match) => closeAdminChat(match.id)));
      try { await clerkClient.users.deleteUser(targetId); } catch {
        // The account profile is gone, so app access is already denied. Preserve audit and report partial external cleanup.
        await doAudit();
        res.status(502).json({ error: "Application data was deleted, but identity-provider account cleanup failed." }); return;
      }
    }
  } else if (action === "delete_chat") {
    if (!UUID.test(targetId)) { res.status(400).json({ error: "Invalid chat id." }); return; }
    const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, targetId)).limit(1);
    if (!match) { res.status(404).json({ error: "Chat not found." }); return; }
    const assets = await db.select({ id: mediaAssetsTable.id, objectPath: mediaAssetsTable.objectPath }).from(mediaAssetsTable).where(eq(mediaAssetsTable.matchId, targetId));
    await db.transaction(async (tx) => {
      for (const asset of assets) await tx.insert(adminMediaDeletionTable).values({ objectPath: asset.objectPath, mediaId: asset.id }).onConflictDoNothing();
      await tx.delete(matchesTable).where(eq(matchesTable.id, targetId));
    });
    await closeAdminChat(targetId);
  } else if (action === "delete_message") {
    if (!UUID.test(targetId)) { res.status(400).json({ error: "Invalid message id." }); return; }
    const [message] = await db.select().from(messagesTable).where(eq(messagesTable.id, targetId)).limit(1);
    if (!message) { res.status(404).json({ error: "Message not found." }); return; }
    await db.transaction(async (tx) => {
      if (message.mediaReference?.startsWith("media:")) {
        const mediaId = message.mediaReference.slice(6);
        const [asset] = await tx.select().from(mediaAssetsTable).where(eq(mediaAssetsTable.id, mediaId)).limit(1);
        if (asset) {
          await tx.insert(adminMediaDeletionTable).values({ objectPath: asset.objectPath, mediaId: asset.id }).onConflictDoNothing();
        }
      }
      await tx.delete(messagesTable).where(eq(messagesTable.id, targetId));
    });
    await closeAdminChat(message.matchId);
  } else {
    if (UUID.test(targetId)) {
      const [match] = await db.select({ id: matchesTable.id }).from(matchesTable).where(eq(matchesTable.id, targetId)).limit(1);
      if (match) {
        const assets = await db.select({ id: mediaAssetsTable.id, objectPath: mediaAssetsTable.objectPath })
          .from(mediaAssetsTable).where(eq(mediaAssetsTable.matchId, targetId));
        await db.transaction(async (tx) => {
          for (const asset of assets) {
            await tx.insert(adminMediaDeletionTable).values({ objectPath: asset.objectPath, mediaId: asset.id }).onConflictDoNothing();
          }
          await tx.delete(matchesTable).where(eq(matchesTable.id, targetId));
        });
        await closeAdminChat(targetId);
      } else {
        const [reaction] = await db.delete(reactionsTable).where(eq(reactionsTable.id, targetId)).returning({ id: reactionsTable.id });
        if (!reaction) { res.status(404).json({ error: "Connection not found." }); return; }
      }
    } else {
      res.status(400).json({ error: "Invalid connection id." }); return;
    }
  }
  await doAudit();
  res.json({ message: "Moderation action applied." });
});

export default router;
