/** Location searches can revisit passes without erasing history or bypassing safety. */
export function discoveryExcludedIds({
  viewerId, reactions, blocks, includePassed, hasRequestedLocation, travelMode,
}: {
  viewerId: string;
  reactions: { id: string; type: string }[];
  blocks: { blockerId: string; blockedId: string }[];
  includePassed: boolean;
  hasRequestedLocation: boolean;
  travelMode: boolean;
}): Set<string> {
  const revisitPasses = includePassed && hasRequestedLocation && !travelMode;
  return new Set([
    viewerId,
    ...reactions.filter(row => !revisitPasses || row.type !== "pass").map(row => row.id),
    ...blocks.flatMap(row => [row.blockerId, row.blockedId]),
  ]);
}
