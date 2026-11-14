import {
  db,
  matchesTable,
  messagesTable,
  profilesTable,
  vibeSwipeNotificationsTable,
} from "@workspace/db";
import { and, eq, or } from "drizzle-orm";

export type CreateVibeSwipeNotificationInput = {
  recipientId: string;
  actorId: string;
  type: "new_match" | "new_message" | "new_like" | "profile_view";
  matchId?: string;
  messageId?: string;
};

const uuidPattern =
  /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export async function createVibeSwipeNotification(
  input: CreateVibeSwipeNotificationInput,
): Promise<void> {
  if (
    !input ||
    typeof input.recipientId !== "string" ||
    !input.recipientId.trim() ||
    typeof input.actorId !== "string" ||
    !input.actorId.trim() ||
    !["new_match", "new_message", "new_like", "profile_view"].includes(
      input.type,
    ) ||
    (input.matchId !== undefined && !uuidPattern.test(input.matchId)) ||
    (input.messageId !== undefined && !uuidPattern.test(input.messageId))
  ) {
    throw new Error("Invalid VibeSwipe notification input.");
  }
  const recipientId = input.recipientId.trim();
  const actorId = input.actorId.trim();
  const { type, matchId, messageId } = input;
  if (recipientId === actorId) {
    throw new Error("A VibeSwipe notification cannot target its actor.");
  }

  const requiresMatch = type === "new_match" || type === "new_message";
  if (requiresMatch !== Boolean(matchId)) {
    throw new Error(`${type} notifications require a matchId.`);
  }
  if ((type === "new_message") !== Boolean(messageId)) {
    throw new Error(`${type} notifications require a messageId.`);
  }
  if (messageId && !matchId) {
    throw new Error("A message notification requires a matchId.");
  }

  const [recipient] = await db
    .select({
      id: profilesTable.id,
      notifyMatches: profilesTable.notifyMatches,
      notifyMessages: profilesTable.notifyMessages,
      notifyProfileViews: profilesTable.notifyProfileViews,
    })
    .from(profilesTable)
    .where(eq(profilesTable.id, recipientId))
    .limit(1);
  const [actor] = await db
    .select({ id: profilesTable.id })
    .from(profilesTable)
    .where(eq(profilesTable.id, actorId))
    .limit(1);
  if (!recipient || !actor) {
    throw new Error("VibeSwipe notification users must have profiles.");
  }

  if (matchId) {
    const [match] = await db
      .select()
      .from(matchesTable)
      .where(eq(matchesTable.id, matchId))
      .limit(1);
    const areParticipants =
      match &&
      [match.userAId, match.userBId].includes(recipientId) &&
      [match.userAId, match.userBId].includes(actorId);
    if (!areParticipants) {
      throw new Error("Notification users must belong to the specified match.");
    }
  }

  if (messageId) {
    const [message] = await db
      .select({
        matchId: messagesTable.matchId,
        senderId: messagesTable.senderId,
      })
      .from(messagesTable)
      .where(eq(messagesTable.id, messageId))
      .limit(1);
    if (
      !message ||
      message.matchId !== matchId ||
      message.senderId !== actorId
    ) {
      throw new Error("The notification message must belong to its actor and match.");
    }
  }

  const notificationsEnabled =
    type === "new_message"
      ? recipient.notifyMessages
      : type === "profile_view"
        ? recipient.notifyProfileViews
        : recipient.notifyMatches;
  if (!notificationsEnabled) return;

  await db.insert(vibeSwipeNotificationsTable).values({
    recipientId,
    actorId,
    type,
    matchId: matchId ?? null,
    messageId: messageId ?? null,
  });
}
