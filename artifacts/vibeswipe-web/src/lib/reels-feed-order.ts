export type ReelWithCreator = { id: string; creatorId: string };

/**
 * Rotate creators within each already-paginated batch without dropping Reels
 * or changing the order of one creator's own videos.
 */
export function mixReelsByCreator<T extends ReelWithCreator>(
  reels: readonly T[],
  previousCreatorId?: string,
): T[] {
  if (reels.length < 2) return [...reels];

  const order: string[] = [];
  const groups = new Map<string, T[]>();
  for (const reel of reels) {
    const key = reel.creatorId || `reel:${reel.id}`;
    let group = groups.get(key);
    if (!group) {
      group = [];
      groups.set(key, group);
      order.push(key);
    }
    group.push(reel);
  }
  if (order.length < 2) return [...reels];

  let start = 0;
  if (previousCreatorId) {
    const firstDifferent = order.findIndex((id) => id !== previousCreatorId);
    if (firstDifferent > 0) start = firstDifferent;
  }

  const offsets = new Map(order.map((id) => [id, 0]));
  const mixed: T[] = [];
  while (mixed.length < reels.length) {
    for (let step = 0; step < order.length; step++) {
      const creatorId = order[(start + step) % order.length];
      const group = groups.get(creatorId)!;
      const offset = offsets.get(creatorId)!;
      if (offset >= group.length) continue;
      mixed.push(group[offset]);
      offsets.set(creatorId, offset + 1);
    }
  }
  return mixed;
}
