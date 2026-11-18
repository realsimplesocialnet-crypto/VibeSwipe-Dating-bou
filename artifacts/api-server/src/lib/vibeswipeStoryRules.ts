export const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;

export function storyExpiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + STORY_LIFETIME_MS);
}

export function canViewStory({
  viewerId,
  ownerId,
  hasMutualFollow,
}: {
  viewerId: string;
  ownerId: string;
  hasMutualFollow: boolean;
}): boolean {
  return viewerId === ownerId || hasMutualFollow;
}
