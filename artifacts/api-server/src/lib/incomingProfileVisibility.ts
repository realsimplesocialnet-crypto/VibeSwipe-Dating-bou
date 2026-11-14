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
