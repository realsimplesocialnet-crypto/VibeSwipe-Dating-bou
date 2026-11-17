export type NewFollowNotification = {
  recipientId: string;
  actorId: string;
  type: "new_follow";
};

/** A follow notice is emitted only for a newly inserted, non-self relationship. */
export function planNewFollowNotification(input: {
  followerId: string;
  followedId: string;
  inserted: boolean;
}): NewFollowNotification | null {
  if (!input.inserted || input.followerId === input.followedId) return null;
  return {
    recipientId: input.followedId,
    actorId: input.followerId,
    type: "new_follow",
  };
}
