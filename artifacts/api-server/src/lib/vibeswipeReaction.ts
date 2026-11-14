export type ReactionType = "like" | "super" | "pass";

export type ReactionNotification = {
  recipientId: string;
  actorId: string;
  type: "new_like" | "new_super_like" | "new_match";
  matchId?: string;
};

export type ReactionEffectInput = {
  fromUserId: string;
  toUserId: string;
  type: ReactionType;
  previousType: string | null;
  reverseType: string | null;
  existingMatchId: string | null;
  targetIsDemo: boolean;
  isProduction: boolean;
};

export function planReactionEffects(input: ReactionEffectInput): {
  matched: boolean;
  createMatch: boolean;
  notifications: ReactionNotification[];
} {
  const hasReverseInterest =
    input.reverseType === "like" || input.reverseType === "super";
  const matched =
    input.type !== "pass" &&
    ((input.targetIsDemo && !input.isProduction) || hasReverseInterest);
  const createMatch = matched && !input.existingMatchId;
  const notifications: ReactionNotification[] = [];

  if (!input.targetIsDemo) {
    if (createMatch) {
      notifications.push(
        { recipientId: input.fromUserId, actorId: input.toUserId, type: "new_match" },
        { recipientId: input.toUserId, actorId: input.fromUserId, type: "new_match" },
      );
    }
    // A first Super Like (including upgrading an ordinary like) is distinct,
    // even when it also creates a mutual match.
    if (input.type === "super" && input.previousType !== "super") {
      notifications.push({
        recipientId: input.toUserId,
        actorId: input.fromUserId,
        type: "new_super_like",
      });
    } else if (
      input.type === "like" &&
      !matched &&
      input.previousType !== "like" &&
      input.previousType !== "super"
    ) {
      notifications.push({
        recipientId: input.toUserId,
        actorId: input.fromUserId,
        type: "new_like",
      });
    }
  }

  return { matched, createMatch, notifications };
}
