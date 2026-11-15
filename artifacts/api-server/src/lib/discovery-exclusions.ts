/** Explicit searches and exhausted feeds may revisit passes; likes/blocks stay excluded. */
export function discoveryExcludedIds({
  viewerId, reactions, blocks, includePassed, hasRequestedLocation, travelMode, recyclePassed = false,
}: {
  viewerId: string;
  reactions: { id: string; type: string }[];
  blocks: { blockerId: string; blockedId: string }[];
  includePassed: boolean;
  hasRequestedLocation: boolean;
  travelMode: boolean;
  recyclePassed?: boolean;
}): Set<string> {
  const revisitPasses = recyclePassed || (includePassed && hasRequestedLocation && !travelMode);
  return new Set([
    viewerId,
    ...reactions.filter(row => !revisitPasses || row.type !== "pass").map(row => row.id),
    ...blocks.flatMap(row => [row.blockerId, row.blockedId]),
  ]);
}
