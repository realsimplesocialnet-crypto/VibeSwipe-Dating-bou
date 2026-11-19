import type { ReelMusicTrack } from "@workspace/api-zod";

const licenseUrl = "https://creativecommons.org/licenses/by/3.0/";
const artist = "Jason Shaw (Audionautix.com)";
const attribution = "Music by Jason Shaw / Audionautix.com, licensed under CC BY 3.0.";

export const REEL_MUSIC_CATALOG: ReelMusicTrack[] = [
  {
    id: "acoustic-meditation",
    title: "Acoustic Meditation",
    artist,
    category: "Calm · acoustic",
    audioUrl: "https://upload.wikimedia.org/wikipedia/commons/0/08/Audionautix-com-ccby-acousticmeditation2.mp3",
    license: "CC BY 3.0",
    licenseUrl,
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Audionautix-com-ccby-acousticmeditation2.mp3",
    attribution,
  },
  {
    id: "hip-hop-1",
    title: "Hip Hop 1",
    artist,
    category: "Hip-hop · upbeat",
    audioUrl: "https://upload.wikimedia.org/wikipedia/commons/0/08/Audionautix-com-ccby-hiphop1.mp3",
    license: "CC BY 3.0",
    licenseUrl,
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Audionautix-com-ccby-hiphop1.mp3",
    attribution,
  },
  {
    id: "drifting",
    title: "Drifting",
    artist,
    category: "Bright · relaxed",
    audioUrl: "https://upload.wikimedia.org/wikipedia/commons/d/dd/Audionautix-com-ccby-drifting2.mp3",
    license: "CC BY 3.0",
    licenseUrl,
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Audionautix-com-ccby-drifting2.mp3",
    attribution,
  },
  {
    id: "energy-bed-2",
    title: "Energy Bed 2",
    artist,
    category: "Blues · energetic",
    audioUrl: "https://upload.wikimedia.org/wikipedia/commons/5/59/Audionautix-com-ccby-energybed2.mp3",
    license: "CC BY 3.0",
    licenseUrl,
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Audionautix-com-ccby-energybed2.mp3",
    attribution,
  },
  {
    id: "solo-acoustic-3",
    title: "Solo Acoustic #3",
    artist,
    category: "Acoustic · calm",
    audioUrl: "https://upload.wikimedia.org/wikipedia/commons/5/59/Audionautix-com-ccby-soloacoustic3.mp3",
    license: "CC BY 3.0",
    licenseUrl,
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Audionautix-com-ccby-soloacoustic3.mp3",
    attribution,
  },
  {
    id: "movie-theme-1",
    title: "Movie Theme 1",
    artist,
    category: "Cinematic · uplifting",
    audioUrl: "https://upload.wikimedia.org/wikipedia/commons/b/bb/Audionautix-com-ccby-movietheme1.mp3",
    license: "CC BY 3.0",
    licenseUrl,
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Audionautix-com-ccby-movietheme1.mp3",
    attribution,
  },
];

export function getReelSoundtrack(id: string | null | undefined): ReelMusicTrack | null {
  if (!id) return null;
  return REEL_MUSIC_CATALOG.find((track) => track.id === id) ?? null;
}
