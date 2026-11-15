import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import "./onboarding-video.css";

export const onboardingAsset = (name: string) =>
  `${import.meta.env.BASE_URL}api/vibeswipe/onboarding-art/${name}`;

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
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const sync = () => setRestricted(preference.matches || !!connection?.saveData);
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
      <video ref={video} src={loaded ? onboardingAsset("loop-v1.mp4") : undefined}
        poster={onboardingAsset("poster-v1.webp")} autoPlay muted loop playsInline
        preload="none" disablePictureInPicture tabIndex={-1}
        onPlaying={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onError={() => { setFailed(true); setPlaying(false); }}
        data-testid="onboarding-background-video" />
      <div className="onboarding-cinema-shade" />
    </div>
    <button type="button" onClick={toggle}
      className={`onboarding-motion-control ${form ? "onboarding-motion-control-form" : ""}`}
      aria-label={playing ? "Pause onboarding animation" : "Play onboarding animation"}
      title={playing ? "Pause animation" : "Play animation"}
      data-testid="button-onboarding-motion">
      {playing ? <Pause size={17}/> : <Play size={17}/>}
    </button>
  </>;
}
