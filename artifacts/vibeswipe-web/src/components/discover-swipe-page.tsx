import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, Redirect } from "wouter";
import {
  getGetBoostStatusQueryKey,
  getGetDailyLikeStatusQueryKey,
  getGetDiscoverProfilesQueryKey,
  getGetMatchesQueryKey,
  getGetProfileMediaQueryKey,
  getGetSuperLikeStatusQueryKey,
  useActivateBoost,
  useBlockProfile,
  useCreateReaction,
  useGetBoostStatus,
  useGetDailyLikeStatus,
  useGetDiscoverProfiles,
  useGetProfileMedia,
  useGetSuperLikeStatus,
  useRecordProfileView,
  useReportProfile,
  useUndoLastPass,
  type Profile,
  type ReportInputReason,
} from "@workspace/api-client-react";
import { ArrowLeft, Heart, MapPin, MoreHorizontal, SlidersHorizontal, Star, X, Zap } from "lucide-react";
import { isDiscoverSetupRequired, shouldRetryDiscover } from "@/lib/profile-query-state";

const mediaUrl = (ref?: string | null) => ref
  ? ref.startsWith("http")
    ? ref
    : ref.startsWith("media:")
      ? `/api/vibeswipe/media/${encodeURIComponent(ref.slice(6))}`
      : ref.startsWith("demo:")
        ? ""
        : `/api/storage${ref.startsWith("/") ? ref : `/${ref}`}`
  : "";

export function DiscoverSwipePage() {
  const queryClient = useQueryClient();
  const [index, setIndex] = useState(0);
  const [ageMin, setAgeMin] = useState(22);
  const [ageMax, setAgeMax] = useState(35);
  const [gender, setGender] = useState("Everyone");
  const [city, setCity] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [lastPass, setLastPass] = useState<string | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const params = useMemo(
    () => ({ ageMin, ageMax, gender, ...(city.trim() ? { city: city.trim() } : {}) }),
    [ageMin, ageMax, city, gender],
  );
  const discover = useGetDiscoverProfiles<Profile[]>(params, {
    query: {
      queryKey: getGetDiscoverProfilesQueryKey(params),
      refetchOnWindowFocus: false,
      retry: shouldRetryDiscover,
    },
  });
  const profiles = discover.data ?? [];
  const profile = profiles[index];
  const reaction = useCreateReaction();
  const undo = useUndoLastPass();
  const likes = useGetDailyLikeStatus({ query: { queryKey: getGetDailyLikeStatusQueryKey(), refetchInterval: 60_000 } });
  const superLikes = useGetSuperLikeStatus({ query: { queryKey: getGetSuperLikeStatusQueryKey(), refetchInterval: 60_000 } });
  const boost = useGetBoostStatus({ query: { queryKey: getGetBoostStatusQueryKey(), refetchInterval: 10_000 } });
  const activateBoost = useActivateBoost();
  const recordView = useRecordProfileView();
  const block = useBlockProfile();
  const report = useReportProfile();
  const viewed = useRef(new Set<string>());

  useEffect(() => {
    if (profile && !profile.isDemo && !viewed.current.has(profile.id)) {
      viewed.current.add(profile.id);
      recordView.mutate({ profileId: profile.id });
    }
  }, [profile?.id]);

  async function swipe(type: "pass" | "like" | "super") {
    if (!profile || reaction.isPending) return;
    if (type === "like" && likes.data?.remaining === 0) {
      setNotice("You’ve reached your daily like limit. Come back in 24 hours.");
      return;
    }
    const current = profile;
    setIndex((value) => value + 1);
    setNotice("");
    try {
      const result = await reaction.mutateAsync({ data: { toUserId: current.id, type } });
      setLastPass(type === "pass" ? current.id : null);
      if (type === "like") void queryClient.invalidateQueries({ queryKey: getGetDailyLikeStatusQueryKey() });
      if (type === "super") void queryClient.invalidateQueries({ queryKey: getGetSuperLikeStatusQueryKey() });
      if (result.matched) {
        await queryClient.invalidateQueries({ queryKey: getGetMatchesQueryKey() });
        setNotice(`You and ${current.name} matched.`);
      }
    } catch {
      setIndex((value) => Math.max(0, value - 1));
      setNotice("That swipe did not save. Try again.");
    }
  }

  async function undoLastSwipe() {
    if (!lastPass || undo.isPending) return;
    try {
      const result = await undo.mutateAsync();
      if (result.undone && result.targetUserId === lastPass) {
        setIndex((value) => Math.max(0, value - 1));
        setLastPass(null);
        await queryClient.invalidateQueries({ queryKey: getGetDiscoverProfilesQueryKey(params) });
      }
    } catch {
      setNotice("Could not undo that pass. Try again.");
    }
  }

  async function blockCurrent() {
    if (!profile) return;
    try {
      await block.mutateAsync({ data: { targetUserId: profile.id } });
      setOptionsOpen(false);
      await queryClient.invalidateQueries({ queryKey: getGetDiscoverProfilesQueryKey(params) });
    } catch {
      setNotice("Could not block this profile. Try again.");
    }
  }

  async function reportCurrent(reason: ReportInputReason) {
    if (!profile) return;
    try {
      await report.mutateAsync({ data: { targetUserId: profile.id, reason } });
      setOptionsOpen(false);
      setNotice("Report received. Thank you for looking out for the community.");
    } catch {
      setNotice("Could not submit this report. Try again.");
    }
  }

  async function startBoost() {
    if (!boost.data?.available || activateBoost.isPending) return;
    try {
      await activateBoost.mutateAsync();
      await queryClient.invalidateQueries({ queryKey: getGetBoostStatusQueryKey() });
      setNotice("Your boost is active for 30 minutes.");
    } catch {
      setNotice("Boost is active or still cooling down.");
    }
  }

  if (discover.isLoading) {
    return <div className="mx-auto max-w-xl px-4 py-12 text-center text-sm text-muted-foreground">Finding people nearby…</div>;
  }
  if (discover.isError && isDiscoverSetupRequired(discover.error)) return <Redirect to="/onboarding" />;
  if (discover.isError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">Discovery could not load right now.</p>
        <button onClick={() => void discover.refetch()} className="mt-4 rounded-xl bg-secondary px-4 py-2.5 text-sm font-semibold">Try again</button>
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center">
        <h1 className="brand text-2xl font-bold">That’s everyone for now</h1>
        <p className="mt-2 text-sm text-muted-foreground">Try broadening your filters or check back soon.</p>
        <button onClick={() => setFiltersOpen(true)} data-testid="button-open-filters-empty" className="mt-5 rounded-xl bg-primary px-4 py-3 font-bold text-[#27101d]">Adjust filters</button>
        <FilterDialog open={filtersOpen} onClose={() => setFiltersOpen(false)} ageMin={ageMin} ageMax={ageMax} gender={gender} city={city} setAgeMin={setAgeMin} setAgeMax={setAgeMax} setGender={setGender} setCity={setCity} onApply={() => { setIndex(0); setFiltersOpen(false); }} />
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[680px] px-4 pb-8 pt-5 sm:px-6 sm:pt-7">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="brand text-2xl font-bold tracking-[-.04em]">Meet someone new</h1>
          <p className="mt-1 text-xs text-muted-foreground" data-testid="text-discover-likes">
            {likes.data?.remaining === 0 ? "Daily like limit reached" : `${likes.data?.remaining ?? "—"} likes left`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void startBoost()}
            disabled={!boost.data?.available || activateBoost.isPending}
            aria-label={boost.data?.active ? "Boost active" : "Activate boost"}
            data-testid="button-activate-boost"
            className="rounded-xl border border-white/10 p-2.5 text-amber-300 disabled:opacity-40"
          ><Zap size={17} /></button>
          <button type="button" onClick={() => setFiltersOpen(true)} aria-label="Discovery filters" data-testid="button-discovery-filters" className="rounded-xl border border-white/10 p-2.5">
            <SlidersHorizontal size={17} />
          </button>
        </div>
      </header>

      {notice && <div role="status" data-testid="status-discover" className="mb-3 rounded-xl border border-primary/20 bg-accent px-4 py-3 text-sm text-[#ffafd1]">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss message" className="float-right"><X size={16} /></button></div>}

      <article
        className="relative mx-auto h-[68dvh] min-h-[420px] max-h-[700px] w-full max-w-[520px] overflow-y-auto overscroll-contain rounded-[28px] border border-white/10 bg-[#17141b] shadow-xl touch-pan-y"
        onTouchStart={(event) => { touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          if (!start) return;
          const dx = event.changedTouches[0].clientX - start.x;
          const dy = event.changedTouches[0].clientY - start.y;
          if (Math.abs(dx) > 90 && Math.abs(dx) > Math.abs(dy) * 1.2) void swipe(dx > 0 ? "like" : "pass");
          touchStart.current = null;
        }}
        data-testid={`card-discover-${profile.id}`}
        aria-label={`${profile.name}, ${profile.age}`}
      >
        <div className="relative h-[60dvh] min-h-[350px] max-h-[560px]">
          {profile.photos?.[0]
            ? <ProfilePhoto reference={profile.photos[0]} alt={`${profile.name}, ${profile.age}`} className="absolute inset-0 h-full w-full object-cover" />
            : <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_25%,#9f6076,#382b3a_55%,#1b1820)]" />}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#130f16] via-[#17121a]/10 to-[#17121a]/10" />
          {profile.superLikedYou && <span className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/45 px-3 py-2 text-xs font-bold text-amber-200 backdrop-blur"><Star size={14} />Super liked you</span>}
          <button type="button" onClick={() => setOptionsOpen(true)} data-testid="button-profile-details" aria-label={`Profile options for ${profile.name}`} className="absolute right-4 top-4 rounded-full border border-white/20 bg-black/40 p-2.5 text-white backdrop-blur"><MoreHorizontal size={19} /></button>
          <div className="absolute inset-x-5 bottom-5">
            <div className="flex items-end gap-2"><h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{profile.name}</h2><span className="pb-0.5 text-xl text-white/80 sm:text-2xl">{profile.age}</span></div>
            <div className="mt-2 flex items-center gap-1.5 text-sm text-white/80"><MapPin size={14} />{profile.city || "Nearby"}{profile.country ? `, ${profile.country}` : ""}</div>
            {!!profile.interests?.length && <div className="mt-3 flex flex-wrap gap-2">{profile.interests.slice(0, 4).map((interest) => <span key={interest} className="rounded-full border border-white/20 bg-black/25 px-3 py-1 text-xs text-white backdrop-blur">{interest}</span>)}</div>}
          </div>
        </div>

        <section className="space-y-5 px-5 py-5">
          <div><h3 className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">About {profile.name}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/80">{profile.bio || "No bio added yet."}</p></div>
          {profile.photos?.length > 1 && <div><h3 className="mb-3 text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">More photos</h3><div className="grid grid-cols-2 gap-2">{profile.photos.slice(1).map((photo, photoIndex) => <ProfilePhoto key={`${photo}-${photoIndex}`} reference={photo} alt={`${profile.name}'s photo ${photoIndex + 2}`} className="aspect-[.82] w-full rounded-xl object-cover" />)}</div></div>}
          {!!profile.interests?.length && <div><h3 className="mb-3 text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Interests</h3><div className="flex flex-wrap gap-2">{profile.interests.map((interest) => <span key={interest} className="rounded-full border border-primary/20 bg-accent px-3 py-1.5 text-xs text-[#ffafd1]">{interest}</span>)}</div></div>}
        </section>

        <div className="sticky bottom-0 z-[3] flex items-center justify-center gap-4 border-t border-white/[.08] bg-[#141117]/95 px-4 py-3 backdrop-blur-xl">
          <button type="button" onClick={() => void swipe("pass")} disabled={reaction.isPending} data-testid="button-pass-profile" aria-label="Pass" className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-[#28232d] text-rose-300 disabled:opacity-40"><X size={23} /></button>
          <button type="button" onClick={() => void undoLastSwipe()} disabled={!lastPass || undo.isPending} data-testid="button-undo-pass" aria-label="Undo last pass" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#28232d] text-muted-foreground disabled:opacity-40"><ArrowLeft size={17} /></button>
          <div className="flex flex-col items-center"><button type="button" onClick={() => void swipe("super")} disabled={reaction.isPending || superLikes.data?.remaining === 0} data-testid="button-super-like" aria-label="Super like" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f3c75c] text-[#211a11] shadow-lg disabled:opacity-40"><Star size={21} /></button><span className="mt-1 text-[10px] text-muted-foreground">{superLikes.data?.remaining ?? "—"} left</span></div>
          <button type="button" onClick={() => void swipe("like")} disabled={reaction.isPending || likes.data?.remaining === 0} data-testid="button-like-profile" aria-label="Like" className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-[#27101d] shadow-[0_8px_30px_rgba(243,78,154,.32)] disabled:opacity-40"><Heart size={25} fill="currentColor" /></button>
        </div>
      </article>

      {optionsOpen && <ProfileOptionsDialog profile={profile} onClose={() => setOptionsOpen(false)} onReport={(reason) => void reportCurrent(reason)} onBlock={() => void blockCurrent()} />}
      <FilterDialog open={filtersOpen} onClose={() => setFiltersOpen(false)} ageMin={ageMin} ageMax={ageMax} gender={gender} city={city} setAgeMin={setAgeMin} setAgeMax={setAgeMax} setGender={setGender} setCity={setCity} onApply={() => { setIndex(0); setFiltersOpen(false); }} />
    </main>
  );
}

function ProfilePhoto({ reference, alt, className }: { reference: string; alt: string; className: string }) {
  const mediaId = reference.startsWith("media:") ? reference.slice(6) : "";
  const media = useGetProfileMedia(mediaId, {
    query: { enabled: Boolean(mediaId), queryKey: getGetProfileMediaQueryKey(mediaId) },
  });
  const [objectUrl, setObjectUrl] = useState("");
  useEffect(() => {
    if (!media.data) return;
    const url = URL.createObjectURL(media.data);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [media.data]);
  const src = mediaId ? objectUrl : mediaUrl(reference);
  return src ? <img src={src} alt={alt} className={className} /> : null;
}

function FilterDialog({ open, onClose, ageMin, ageMax, gender, city, setAgeMin, setAgeMax, setGender, setCity, onApply }: {
  open: boolean; onClose: () => void; ageMin: number; ageMax: number; gender: string; city: string;
  setAgeMin: (value: number) => void; setAgeMax: (value: number) => void; setGender: (value: string) => void; setCity: (value: string) => void; onApply: () => void;
}) {
  if (!open) return null;
  return <Dialog title="Discovery filters" onClose={onClose}><div className="space-y-5">
    <div className="grid grid-cols-2 gap-3"><label className="text-xs text-muted-foreground">Age from<input type="number" min="18" value={ageMin} onChange={(event) => setAgeMin(Number(event.target.value))} className="field mt-2" /></label><label className="text-xs text-muted-foreground">Age to<input type="number" min={ageMin} value={ageMax} onChange={(event) => setAgeMax(Number(event.target.value))} className="field mt-2" /></label></div>
    <label className="block text-xs text-muted-foreground">Interested in<select value={gender} onChange={(event) => setGender(event.target.value)} className="field mt-2"><option>Everyone</option><option>Woman</option><option>Man</option><option>Non-binary</option></select></label>
    <label className="block text-xs text-muted-foreground">City<input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Any city" className="field mt-2" /></label>
    <button type="button" onClick={onApply} data-testid="button-apply-filters" className="w-full rounded-xl bg-primary py-3 font-bold text-[#27101d]">Show people</button>
  </div></Dialog>;
}

function ProfileOptionsDialog({ profile, onClose, onReport, onBlock }: { profile: Profile; onClose: () => void; onReport: (reason: ReportInputReason) => void; onBlock: () => void }) {
  return <Dialog title={`${profile.name}, ${profile.age}`} onClose={onClose}><div className="space-y-4">
    <p className="text-sm text-muted-foreground">{profile.city} · {profile.gender} · Looking for {profile.lookingFor}</p>
    <p className="whitespace-pre-wrap text-sm leading-6">{profile.bio || "No bio added yet."}</p>
    <div className="flex flex-wrap gap-2">{profile.interests?.map((interest) => <span key={interest} className="rounded-full bg-accent px-3 py-1.5 text-xs text-[#ffafd1]">{interest}</span>)}</div>
    <div className="grid grid-cols-2 gap-2 pt-2"><button type="button" onClick={() => onReport("inappropriate")} data-testid="button-report-profile" className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold">Report</button><button type="button" onClick={onBlock} data-testid="button-block-profile" className="rounded-xl border border-rose-400/20 px-4 py-3 text-sm font-semibold text-rose-300">Block profile</button></div>
  </div></Dialog>;
}

function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-[26px] border border-white/10 bg-[#211d25] p-5 shadow-2xl sm:rounded-[26px] sm:p-7">
      <div className="mb-6 flex items-center justify-between"><h2 className="brand text-2xl font-bold">{title}</h2><button type="button" onClick={onClose} aria-label="Close" data-testid="button-close-dialog" className="rounded-lg p-2 text-muted-foreground hover:bg-white/5"><X size={19} /></button></div>
      {children}
    </section>
  </div>;
}
