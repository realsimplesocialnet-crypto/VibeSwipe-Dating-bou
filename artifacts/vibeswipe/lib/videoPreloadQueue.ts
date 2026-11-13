type ProfileWithVideo = {
  id: string;
  videoUrl?: string | null;
};

export function getQueuedVideoProfiles(
  profiles: ProfileWithVideo[],
  activeIndex: number,
): ProfileWithVideo[] {
  return profiles
    .slice(activeIndex, activeIndex + 3)
    .filter((profile) => !!profile.videoUrl);
}
