import { useAuth } from "@clerk/expo";
import { createVideoPlayer, type VideoPlayer } from "expo-video";
import { useEffect, useRef, useState } from "react";
import type { Profile } from "@workspace/api-client-react";
import { profileVideoSource } from "@/lib/media";

export function useVideoPreloadQueue(profiles: Profile[], activeIndex: number) {
  const { getToken } = useAuth();
  const players = useRef(new Map<string, VideoPlayer>());
  const [activePlayer, setActivePlayer] = useState<VideoPlayer | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function synchronizeQueue() {
      const sessionToken = await getToken();
      if (cancelled) return;
      setToken(sessionToken);
      const activeProfile = profiles[activeIndex];
      const queueProfiles = profiles
        .slice(activeIndex, activeIndex + 3)
        .filter((profile) => !!profile.videoUrl);
      const queuedIds = new Set(queueProfiles.map((profile) => profile.id));

      for (const profile of queueProfiles) {
        if (!profile.videoUrl) continue;
        let player = players.current.get(profile.id);
        if (!player) {
          const source = profileVideoSource(profile.videoUrl, sessionToken);
          if (!source) continue;
          player = createVideoPlayer(source);
          player.loop = true;
          player.muted = true;
          player.bufferOptions = { preferredForwardBufferDuration: 5 };
          players.current.set(profile.id, player);
        }
        if (profile.id === activeProfile?.id) {
          player.muted = true;
          player.play();
          setActivePlayer(player);
        } else {
          player.pause();
        }
      }

      for (const [profileId, player] of players.current) {
        if (!queuedIds.has(profileId)) {
          player.pause();
          player.release();
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
        player.pause();
        player.release();
      }
      players.current.clear();
    },
    [],
  );

  return { player: activePlayer, token };
}
