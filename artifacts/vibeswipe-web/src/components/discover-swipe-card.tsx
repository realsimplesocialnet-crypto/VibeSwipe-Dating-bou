import { memo, useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useTransform, type Variants } from "framer-motion";
import { MapPin, MoreHorizontal } from "lucide-react";
import {
  getGetMediaPreviewQueryKey,
  useGetMediaPreview,
  type Profile,
} from "@workspace/api-client-react";
import { VerifiedBadge } from "@/components/verified-badge";

export type SwipeAction = "pass" | "like" | "super";
export type SwipeGesture = { offsetX: number; velocityX: number };
export type SwipeExit = {
  action: SwipeAction;
  x: number;
  y: number;
  rotate: number;
  reducedMotion: boolean;
};

type DiscoverSwipeCardProps = {
  profile: Profile;
  depth: number;
  active: boolean;
  reducedMotion: boolean;
  onSwipe: (profileId: string, action: SwipeAction, gesture: SwipeGesture) => void;
  onOpen: (profileId: string) => void;
  onOptions: (profileId: string) => void;
};

const SWIPE_OFFSET_PX = 54;
const SWIPE_VELOCITY_PX_PER_SECOND = 420;
const swipeCardVariants: Variants = {
  exit: (target: SwipeExit | null) => ({
    x: target?.x ?? 0,
    y: target?.y ?? -40,
    rotate: target?.rotate ?? 0,
    opacity: 0,
    pointerEvents: "none" as const,
    transition: target?.reducedMotion
      ? { duration: 0 }
      : { duration: 0.16, ease: [0.16, 0.84, 0.24, 1] as const },
  }),
};

export const DiscoverSwipeCard = memo(function DiscoverSwipeCard({
  profile,
  depth,
  active,
  reducedMotion,
  onSwipe,
  onOpen,
  onOptions,
}: DiscoverSwipeCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-520, 0, 520], [-11, 0, 11]);
  const likeOpacity = useTransform(x, [28, 104], [0, 1]);
  const passOpacity = useTransform(x, [-104, -28], [1, 0]);
  const [objectUrl, setObjectUrl] = useState("");

  const mediaId = profile.photos?.[0]?.startsWith("media:")
    ? profile.photos[0].slice(6)
    : "";
  const media = useGetMediaPreview(mediaId, {
    query: {
      enabled: Boolean(mediaId),
      queryKey: getGetMediaPreviewQueryKey(mediaId),
      staleTime: 10 * 60_000,
      gcTime: 30 * 60_000,
    },
  });

  useEffect(() => {
    if (!media.data) return;
    const nextUrl = URL.createObjectURL(media.data);
    setObjectUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [media.data]);

  const photo = profile.photos?.[0];
  const src = mediaId
    ? objectUrl
    : photo?.startsWith("http")
      ? photo
      : photo?.startsWith("demo:")
        ? ""
        : photo
          ? `/api/storage${photo.startsWith("/") ? photo : `/${photo}`}`
          : "";

  return (
    <motion.div
      className="discover-card-layer"
      data-card-depth={depth}
      aria-hidden={!active}
      style={{ zIndex: 10 - depth, pointerEvents: active ? "auto" : "none" }}
      initial={false}
      animate={{ y: depth * 10, scale: 1 - depth * 0.035, opacity: 1 - depth * 0.12 }}
      transition={reducedMotion
        ? { duration: 0 }
        : { type: "spring", stiffness: 720, damping: 38, mass: 0.6 }}
      variants={swipeCardVariants}
      exit="exit"
    >
      <motion.article
        className="relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-[30px] bg-[#17141b] shadow-xl"
        style={{ x, rotate, willChange: "transform" }}
        drag={active ? "x" : false}
        dragConstraints={{ left: -1400, right: 1400 }}
        dragElastic={0.08}
        dragMomentum={false}
        dragSnapToOrigin
        dragTransition={{ bounceStiffness: 720, bounceDamping: 32 }}
        whileDrag={reducedMotion ? undefined : { scale: 1.012 }}
        onDragEnd={(_, info) => {
          const direction = Math.sign(info.offset.x || info.velocity.x);
          const shouldSwipe =
            Math.abs(info.offset.x) >= SWIPE_OFFSET_PX ||
            (Math.abs(info.velocity.x) >= SWIPE_VELOCITY_PX_PER_SECOND && Math.abs(info.offset.x) >= 12);
          if (active && shouldSwipe && direction !== 0) {
            onSwipe(profile.id, direction > 0 ? "like" : "pass", {
              offsetX: info.offset.x,
              velocityX: info.velocity.x,
            });
          }
        }}
        onTap={() => { if (active) onOpen(profile.id); }}
        onKeyDown={(event) => {
          if (active && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            onOpen(profile.id);
          }
        }}
        data-testid={`card-discover-${profile.id}`}
        aria-label={`${profile.name}${profile.age !== null ? `, ${profile.age}` : ""}. Tap to view full profile.`}
        tabIndex={active ? 0 : -1}
      >
        <div className="relative min-h-0 flex-1">
          {src
            ? <img
                key={profile.id}
                src={src}
                alt={`${profile.name}${profile.age !== null ? `, ${profile.age}` : ""}`}
                className="absolute inset-0 h-full w-full object-cover object-top"
                loading="eager"
                fetchPriority={active ? "high" : "low"}
                decoding="async"
              />
            : <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_25%,#9f6076,#382b3a_55%,#1b1820)]" />}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#130f16] via-[#17121a]/10 to-[#17121a]/10" />

          <motion.span
            className="pointer-events-none absolute left-5 top-7 z-[2] rounded-lg border-2 border-emerald-300 px-3 py-1 text-2xl font-black uppercase tracking-widest text-emerald-200"
            style={{ opacity: likeOpacity, rotate: -12 }}
            aria-hidden="true"
          >
            Like
          </motion.span>
          <motion.span
            className="pointer-events-none absolute right-5 top-7 z-[2] rounded-lg border-2 border-rose-300 px-3 py-1 text-2xl font-black uppercase tracking-widest text-rose-200"
            style={{ opacity: passOpacity, rotate: 12 }}
            aria-hidden="true"
          >
            Pass
          </motion.span>

          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onOptions(profile.id);
            }}
            data-testid="button-profile-details"
            aria-label={`Profile options for ${profile.name}`}
            className="absolute right-4 top-4 z-[3] rounded-full border border-white/20 bg-black/40 p-2.5 text-white backdrop-blur"
          >
            <MoreHorizontal size={19} />
          </button>

          <div className="pointer-events-none absolute inset-x-5 bottom-5">
            <div className="flex min-w-0 items-end justify-between gap-3">
              <h2 className="min-w-0 break-words text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
                {profile.name}<VerifiedBadge verified={profile.isVerified} />
              </h2>
              {profile.age !== null && <span className="shrink-0 pb-0.5 text-xl text-white/80 sm:text-2xl">{profile.age}</span>}
            </div>
            <div className="mt-2 flex min-w-0 items-center gap-1.5 text-sm text-white/80">
              <MapPin size={14} className="shrink-0" />
              <span className="truncate">{[profile.city, profile.state, profile.country].filter(Boolean).join(", ") || "Nearby"}</span>
            </div>
            {!!profile.interests?.length && (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/20 bg-black/25 px-3 py-1 text-xs text-white backdrop-blur">{profile.interests[0]}</span>
              </div>
            )}
          </div>
        </div>
      </motion.article>
    </motion.div>
  );
});

DiscoverSwipeCard.displayName = "DiscoverSwipeCard";
