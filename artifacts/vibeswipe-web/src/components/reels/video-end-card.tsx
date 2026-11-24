import type { CSSProperties, ReactNode } from "react";
import { Heart } from "lucide-react";
import "./video-end-card.css";

export type VideoEndCardProps = {
  /** Keep false for normal in-app playback. Set true only in an export/preview flow. */
  exportMode?: boolean;
  /** Seconds remaining in the exported video. The card appears at 2 seconds or less. */
  remainingSeconds?: number;
  brandName?: string;
  tagline?: string;
  code?: string;
  accentColor?: string;
  textColor?: string;
  logo?: ReactNode;
};

export function VideoEndCard({
  exportMode = false,
  remainingSeconds = 0,
  brandName = "MyAge Beauty",
  tagline = "Find Your Match",
  code = "MYB-01",
  accentColor = "#ffffff",
  textColor = "#ffffff",
  logo,
}: VideoEndCardProps) {
  if (!exportMode || remainingSeconds <= 0 || remainingSeconds > 2) return null;

  return (
    <div className="video-end-card" style={{ "--end-card-accent": accentColor, "--end-card-text": textColor } as CSSProperties} aria-label={`${brandName}. ${tagline}. ${code}`}>
      <span className="video-end-card-logo" aria-hidden="true">{logo ?? <Heart size={24} fill="currentColor" strokeWidth={2.5}/>}</span>
      <span className="video-end-card-copy">
        <span className="video-end-card-title">{brandName}</span>
        <span className="video-end-card-tagline">{tagline}</span>
      </span>
      <span className="video-end-card-code">{code}</span>
    </div>
  );
}
