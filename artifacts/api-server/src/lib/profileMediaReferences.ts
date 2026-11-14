export function removedProfilePhotoMediaIds(
  previousPhotos: readonly string[],
  nextPhotos: readonly string[],
): string[] {
  const retained = new Set(nextPhotos);
  return [...new Set(
    previousPhotos
      .filter((reference) => reference.startsWith("media:") && !retained.has(reference))
      .map((reference) => reference.slice("media:".length)),
  )];
}
