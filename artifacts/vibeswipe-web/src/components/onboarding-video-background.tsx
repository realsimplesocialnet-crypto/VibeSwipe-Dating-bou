import { useEffect, useRef, useState } from "react";
import "./onboarding-video.css";

export const onboardingAsset = (asset: "loop" | "poster") =>
  `${import.meta.env.BASE_URL}api/vibeswipe/onboarding-art/${asset === "loop" ? "loop-v1.mp4" : "poster-v1.webp"}`;

export function OnboardingVideoBackground({ form = false }: { form?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [choice, setChoice] = useState<boolean | null>(null);
  const [restricted, setRestricted] = useState(true);
  const [visible, setVisible] = useState(!document.hidden);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const shouldPlay = (choice ?? !restricted) && visible && !failed;
  // Keep a loaded source on pause, but don't request it initially for reduced
  // motion / data-saving users until they explicitly choose to play.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const device = navigator as Navigator & {
      connection?: { saveData?: boolean };
      deviceMemory?: number;
    };
    const lowMemory = typeof device.deviceMemory === "number" && device.deviceMemory <= 2;
    const sync = () => setRestricted(preference.matches || !!device.connection?.saveData || lowMemory);
    const visibility = () => setVisible(!document.hidden);
    sync();
    preference.addEventListener("change", sync);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      preference.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  useEffect(() => {
    if (shouldPlay) setLoaded(true);
    const element = video.current;
    if (!element) return;
    if (shouldPlay && loaded) {
      element.muted = true;
      void element.play().catch(() => setPlaying(false));
    } else element.pause();
  }, [shouldPlay, loaded]);

  useEffect(() => {
    if (!shouldPlay || !loaded) return;
    // Retry autoplay on an ordinary page interaction when a mobile browser
    // requires a gesture. Never display a video-player button over the artwork.
    const resume = () => {
      if (video.current?.paused) void video.current.play().catch(() => {});
    };
    document.addEventListener("pointerdown", resume, { passive: true });
    document.addEventListener("keydown", resume);
    return () => {
      document.removeEventListener("pointerdown", resume);
      document.removeEventListener("keydown", resume);
    };
  }, [shouldPlay, loaded]);

  const toggle = () => {
    if (playing) { setChoice(false); video.current?.pause(); }
    else {
      setFailed(false);
      setChoice(true);
      if (failed) video.current?.load();
      // A direct gesture also permits playback in browsers blocking autoplay.
      if (video.current?.src) void video.current.play().catch(() => setPlaying(false));
    }
  };

  return <>
    <div className={`onboarding-cinema ${form ? "onboarding-cinema-form" : ""}`} aria-hidden="true">
      <video ref={video} src={loaded ? onboardingAsset("loop") : undefined}
        poster={onboardingAsset("poster")} autoPlay muted loop playsInline
        controls={false} preload="none" disablePictureInPicture disableRemotePlayback tabIndex={-1}
        onPlaying={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onError={() => { setFailed(true); setPlaying(false); }}
        data-testid="onboarding-background-video" />
      <div className="onboarding-cinema-shade" />
    </div>
    <button type="button" onClick={toggle}
      className="sr-only focus:not-sr-only focus:fixed focus:right-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-black"
      aria-label={playing ? "Pause onboarding animation" : "Resume onboarding animation"}
      data-testid="button-onboarding-motion">
      {playing ? "Pause background animation" : "Resume background animation"}
    </button>
  </>;
}
