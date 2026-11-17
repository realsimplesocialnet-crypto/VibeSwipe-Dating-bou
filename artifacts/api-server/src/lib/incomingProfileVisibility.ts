/** Both incoming-like and viewer lists must exclude self, demos and blocks. */
export function canShowIncomingProfile(
  profile: { id: string; isDemo?: boolean },
  currentUserId: string,
  blockedProfileIds: ReadonlySet<string>,
): boolean {
  return profile.id !== currentUserId
    && !profile.isDemo
    && !blockedProfileIds.has(profile.id);
}

export function canShowIncomingLike(input: {
  profile: { id: string; isDemo?: boolean };
  currentUserId: string;
  blockedProfileIds: ReadonlySet<string>;
  matchedProfileIds: ReadonlySet<string>;
  likedAt: Date;
  outgoingReaction?: { type: string; createdAt: Date };
}): boolean {
  if (
    !canShowIncomingProfile(input.profile, input.currentUserId, input.blockedProfileIds)
    || input.matchedProfileIds.has(input.profile.id)
  ) return false;
  const ownReaction = input.outgoingReaction;
  return !(ownReaction?.type === "pass" && ownReaction.createdAt >= input.likedAt);
}
