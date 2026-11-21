export function canDownloadReel(
  reelPermission: boolean | null | undefined,
  mediaType: "video" | "slides",
  profileDefault: boolean,
): boolean {
  return reelPermission ?? (mediaType === "video" && profileDefault);
}
