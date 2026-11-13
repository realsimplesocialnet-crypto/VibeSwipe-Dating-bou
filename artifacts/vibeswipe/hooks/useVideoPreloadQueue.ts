import { useAuth } from "@clerk/expo";
import { createVideoPlayer, type VideoPlayer } from "expo-video";
import { useEffect, useRef, useState } from "react";
import type { Profile } from "@workspace/api-client-react";
import { profileVideoSource } from "@/lib/media";
import { getQueuedVideoProfiles } from "@/lib/videoPreloadQueue";

export function useVideoPreloadQueue(profiles: Profile[], activeIndex: number) {
  const { getToken } = useAuth();
  const players = useRef(new Map<string, { videoUrl: string; player: VideoPlayer }>());
  const [activePlayer, setActivePlayer] = useState<VideoPlayer | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function synchronizeQueue() {
      const sessionToken = await getToken();
      if (cancelled) return;
      setToken(sessionToken);
      const activeProfile = profiles[activeIndex];
      const queueProfiles = getQueuedVideoProfiles(profiles, activeIndex);
      const queuedIds = new Set(queueProfiles.map((profile) => profile.id));

      for (const profile of queueProfiles) {
        const videoUrl = profile.videoUrl;
        if (!videoUrl) continue;
        const existing = players.current.get(profile.id);
        if (existing && existing.videoUrl !== videoUrl) {
          existing.player.pause();
          existing.player.release();
          players.current.delete(profile.id);
        }
        let player = players.current.get(profile.id)?.player;
        if (!player) {
          const source = profileVideoSource(videoUrl, sessionToken);
          if (!source) continue;
          player = createVideoPlayer(source);
          player.loop = true;
          player.muted = true;
          player.bufferOptions = { preferredForwardBufferDuration: 5 };
          players.current.set(profile.id, { videoUrl, player });
        }
        if (profile.id === activeProfile?.id) {
          player.muted = true;
          player.play();
          setActivePlayer(player);
        } else {
          player.pause();
        }
      }

       for (const [profileId, queued] of players.current) {
        if (!queuedIds.has(profileId)) {
          queued.player.pause();
          queued.player.release();
          players.current.delete(profileId);
        }
      }
      if (!activeProfile?.videoUrl) setActivePlayer(null);
    }

    void synchronizeQueue();
    return () => {
      cancelled = true;
    };
  }, [activeIndex, getToken, profiles]);

  useEffect(
    () => () => {
      for (const player of players.current.values()) {
        player.player.pause();
        player.player.release();
      }
      players.current.clear();
    },
    [],
  );

  return { player: activePlayer, token };
}
