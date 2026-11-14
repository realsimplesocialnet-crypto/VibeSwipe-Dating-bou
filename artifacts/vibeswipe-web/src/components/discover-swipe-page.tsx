import { useEffect, useMemo, useRef, useState } from "react";
import { listCities, listCountries, type GeoOption } from "@/lib/geo-data";
import { useQueryClient } from "@tanstack/react-query";
import { Link, Redirect, useLocation } from "wouter";
import {
  getGetBoostStatusQueryKey,
  getGetDailyLikeStatusQueryKey,
  getGetDiscoverProfilesQueryKey,
  getGetMatchesQueryKey,
  getGetProfileMediaQueryKey,
  getGetSuperLikeStatusQueryKey,
  getGetVibeSwipeSettingsQueryKey,
  useActivateBoost,
  useBlockProfile,
  useCreateReaction,
  useGetBoostStatus,
  useGetDailyLikeStatus,
  useGetDiscoverProfiles,
  useGetProfileMedia,
  useGetSuperLikeStatus,
  useGetVibeSwipeSettings,
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
  const [, setLocation] = useLocation();
  const [index, setIndex] = useState(0);
  const [ageMin, setAgeMin] = useState(22);
  const [ageMax, setAgeMax] = useState(35);
  const [gender, setGender] = useState<string | undefined>(undefined);
  const [country, setCountry] = useState<GeoOption | null>(null);
  const [city, setCity] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [lastPass, setLastPass] = useState<string | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const suppressCardOpen = useRef(false);
  const previousTravelFilter = useRef<string | null>(null);
  const settings = useGetVibeSwipeSettings({ query: { queryKey: getGetVibeSwipeSettingsQueryKey() } });

  const params = useMemo(
    () => ({
      ageMin,
      ageMax,
      ...(gender ? { gender } : {}),
      ...(country ? { country: country.name } : {}),
      ...(city.trim() ? { city: city.trim() } : {}),
    }),
    [ageMin, ageMax, city, country, gender],
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
    if (!settings.data) return;
    const filter = `${settings.data.travelMode}:${settings.data.travelCity ?? ""}`;
    if (previousTravelFilter.current !== null && previousTravelFilter.current !== filter) {
      setIndex(0);
      setCity("");
      setCountry(null);
    }
    previousTravelFilter.current = filter;
  }, [settings.data?.travelMode, settings.data?.travelCity]);

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
        <FilterDialog open={filtersOpen} onClose={() => setFiltersOpen(false)} ageMin={ageMin} ageMax={ageMax} gender={gender} country={country} city={city} travelMode={Boolean(settings.data?.travelMode)} setAgeMin={setAgeMin} setAgeMax={setAgeMax} setGender={setGender} setCountry={(value) => { setCountry(value); setCity(""); }} setCity={setCity} onApply={() => { setIndex(0); setFiltersOpen(false); }} />
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
        className="relative mx-auto flex h-[68dvh] min-h-[420px] max-h-[700px] w-full max-w-[520px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#17141b] shadow-xl touch-pan-y"
        onTouchStart={(event) => { touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          if (!start) return;
          const dx = event.changedTouches[0].clientX - start.x;
          const dy = event.changedTouches[0].clientY - start.y;
          if (Math.abs(dx) > 12 || Math.abs(dy) > 12) {
            suppressCardOpen.current = true;
            window.setTimeout(() => { suppressCardOpen.current = false; }, 350);
          }
          if (Math.abs(dx) > 90 && Math.abs(dx) > Math.abs(dy) * 1.2) void swipe(dx > 0 ? "like" : "pass");
          touchStart.current = null;
        }}
        onClick={() => {
          if (suppressCardOpen.current) return;
          setLocation(`/profile/${profile.id}`);
        }}
        onKeyDown={(event) => {
          if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            setLocation(`/profile/${profile.id}`);
          }
        }}
        data-testid={`card-discover-${profile.id}`}
        aria-label={`${profile.name}, ${profile.age}. Tap to view full profile.`}
        tabIndex={0}
      >
        <div className="relative min-h-0 flex-1">
          {profile.photos?.[0]
            ? <ProfilePhoto reference={profile.photos[0]} alt={`${profile.name}, ${profile.age}`} className="absolute inset-0 h-full w-full object-cover" />
            : <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_25%,#9f6076,#382b3a_55%,#1b1820)]" />}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#130f16] via-[#17121a]/10 to-[#17121a]/10" />
          <button type="button" onClick={(event) => { event.stopPropagation(); setOptionsOpen(true); }} data-testid="button-profile-details" aria-label={`Profile options for ${profile.name}`} className="absolute right-4 top-4 z-[2] rounded-full border border-white/20 bg-black/40 p-2.5 text-white backdrop-blur"><MoreHorizontal size={19} /></button>
          <div className="pointer-events-none absolute inset-x-5 bottom-5">
            <div className="flex items-end gap-2"><h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{profile.name}</h2><span className="pb-0.5 text-xl text-white/80 sm:text-2xl">{profile.age}</span></div>
            <div className="mt-2 flex items-center gap-1.5 text-sm text-white/80"><MapPin size={14} />{[profile.city, profile.state, profile.country].filter(Boolean).join(", ") || "Nearby"}</div>
            {!!profile.interests?.length && <div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full border border-white/20 bg-black/25 px-3 py-1 text-xs text-white backdrop-blur">{profile.interests[0]}</span></div>}
          </div>
        </div>

        <div className="z-[3] flex shrink-0 items-center justify-center gap-4 border-t border-white/[.08] bg-[#141117]/95 px-4 py-3 backdrop-blur-xl">
          <button type="button" onClick={(event) => { event.stopPropagation(); void swipe("pass"); }} disabled={reaction.isPending} data-testid="button-pass-profile" aria-label="Pass" className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-[#28232d] text-rose-300 disabled:opacity-40"><X size={23} /></button>
          <button type="button" onClick={(event) => { event.stopPropagation(); void undoLastSwipe(); }} disabled={!lastPass || undo.isPending} data-testid="button-undo-pass" aria-label="Undo last pass" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#28232d] text-muted-foreground disabled:opacity-40"><ArrowLeft size={17} /></button>
          <div className="flex flex-col items-center"><button type="button" onClick={(event) => { event.stopPropagation(); void swipe("super"); }} disabled={reaction.isPending || superLikes.data?.remaining === 0} data-testid="button-super-like" aria-label="Super like" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f3c75c] text-[#211a11] shadow-lg disabled:opacity-40"><Star size={21} /></button><span className="mt-1 text-[10px] text-muted-foreground">{superLikes.data?.remaining ?? "—"} left</span></div>
          <button type="button" onClick={(event) => { event.stopPropagation(); void swipe("like"); }} disabled={reaction.isPending || likes.data?.remaining === 0} data-testid="button-like-profile" aria-label="Like" className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-[#27101d] shadow-[0_8px_30px_rgba(243,78,154,.32)] disabled:opacity-40"><Heart size={25} fill="currentColor" /></button>
        </div>
      </article>

      {optionsOpen && <ProfileOptionsDialog onClose={() => setOptionsOpen(false)} onReport={(reason) => void reportCurrent(reason)} onBlock={() => void blockCurrent()} />}
      <FilterDialog open={filtersOpen} onClose={() => setFiltersOpen(false)} ageMin={ageMin} ageMax={ageMax} gender={gender} country={country} city={city} travelMode={Boolean(settings.data?.travelMode)} setAgeMin={setAgeMin} setAgeMax={setAgeMax} setGender={setGender} setCountry={(value) => { setCountry(value); setCity(""); }} setCity={setCity} onApply={() => { setIndex(0); setFiltersOpen(false); }} />
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

function FilterDialog({ open, onClose, ageMin, ageMax, gender, country, city, travelMode, setAgeMin, setAgeMax, setGender, setCountry, setCity, onApply }: {
  open: boolean; onClose: () => void; ageMin: number; ageMax: number; gender: string | undefined; country: GeoOption | null; city: string; travelMode: boolean;
  setAgeMin: (value: number) => void; setAgeMax: (value: number) => void; setGender: (value: string | undefined) => void; setCountry: (value: GeoOption | null) => void; setCity: (value: string) => void; onApply: () => void;
}) {
  const [countries, setCountries] = useState<GeoOption[]>([]);
  const [cities, setCities] = useState<GeoOption[]>([]);
  const [citySearch, setCitySearch] = useState(city);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [citiesError, setCitiesError] = useState(false);

  useEffect(() => {
    if (!open) return;
    void listCountries().then(setCountries).catch(() => setCountries([]));
  }, [open]);

  useEffect(() => {
    setCitySearch(city);
  }, [city]);

  useEffect(() => {
    if (!open || !country) {
      setCities([]);
      setCitiesError(false);
      return;
    }
    let active = true;
    setCitiesLoading(true);
    setCitiesError(false);
    void listCities(country.code, "").then((items) => {
      if (active) setCities(items);
    }).catch(() => {
      if (active) {
        setCities([]);
        setCitiesError(true);
      }
    }).finally(() => {
      if (active) setCitiesLoading(false);
    });
    return () => { active = false; };
  }, [country, open]);

  if (!open) return null;
  const citySuggestions = citySearch.trim().length >= 2 && citySearch !== city
    ? (() => {
      const search = citySearch.trim().toLocaleLowerCase();
      const matches = cities.filter((item) => item.name.toLocaleLowerCase().includes(search));
      return [
        ...matches.filter((item) => item.name.toLocaleLowerCase().startsWith(search)).sort((a, b) => a.name.localeCompare(b.name)),
        ...matches.filter((item) => !item.name.toLocaleLowerCase().startsWith(search)).sort((a, b) => a.name.localeCompare(b.name)),
      ].slice(0, 12);
    })()
    : [];
  const needsCountrySelection = citySearch.trim() !== "" && !city;
  const canApply = (!citySearch.trim() || Boolean(city));
  return <Dialog title="Discovery filters" onClose={onClose}><div className="space-y-5">
    <div className="grid grid-cols-2 gap-3"><label className="text-xs text-muted-foreground">Age from<input type="number" min="18" value={ageMin} onChange={(event) => setAgeMin(Number(event.target.value))} className="field mt-2" /></label><label className="text-xs text-muted-foreground">Age to<input type="number" min={ageMin} value={ageMax} onChange={(event) => setAgeMax(Number(event.target.value))} className="field mt-2" /></label></div>
    <label className="block text-xs text-muted-foreground">Interested in<select value={gender ?? ""} onChange={(event) => setGender(event.target.value || undefined)} className="field mt-2"><option value="">Use signup preference</option><option>Everyone</option><option>Woman</option><option>Man</option><option>Non-binary</option></select></label>
    {travelMode && <p className="rounded-xl border border-primary/20 bg-accent px-3 py-2 text-xs text-[#ffafd1]">Travel Mode is active. Turn it off in Settings to search another country.</p>}
    <label className="block text-xs text-muted-foreground">Country<select disabled={travelMode} value={country?.code ?? ""} onChange={(event) => setCountry(countries.find((item) => item.code === event.target.value) ?? null)} className="field mt-2 disabled:opacity-50"><option value="">Use my home location</option>{countries.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
    <div>
      <label className="block text-xs text-muted-foreground">City<input value={citySearch} onChange={(event) => { setCitySearch(event.target.value); if (event.target.value !== city) setCity(""); }} disabled={!country || travelMode} placeholder={country ? "Any city" : "Select a country first"} className="field mt-2 disabled:opacity-50" /></label>
      <p className="mt-1.5 text-[11px] text-muted-foreground">{country ? "Choose a city suggestion, or leave blank to search the whole country." : "Choose a country to search its cities."}</p>
      {citiesLoading && <p className="mt-2 text-xs text-muted-foreground">Loading cities…</p>}
      {citiesError && <p className="mt-2 text-xs text-rose-300">Could not load city names. Try again.</p>}
      {citySuggestions.length > 0 && <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-black/20">{citySuggestions.map((item) => <button type="button" key={item.code} onClick={() => { setCity(item.name); setCitySearch(item.name); }} className="block w-full border-b border-white/5 px-3 py-2.5 text-left text-sm last:border-0 hover:bg-white/5">{item.name}</button>)}</div>}
      {needsCountrySelection && citySearch.trim().length >= 2 && citySuggestions.length === 0 && !citiesLoading && !citiesError && <p className="mt-2 text-xs text-muted-foreground">No matching city. Select a suggestion or clear the field for any city.</p>}
    </div>
    <button type="button" onClick={onApply} disabled={!canApply} data-testid="button-apply-filters" className="w-full rounded-xl bg-primary py-3 font-bold text-[#27101d] disabled:opacity-50">Show people</button>
  </div></Dialog>;
}

function ProfileOptionsDialog({ onClose, onReport, onBlock }: { onClose: () => void; onReport: (reason: ReportInputReason) => void; onBlock: () => void }) {
  return <Dialog title="Profile options" onClose={onClose}><div className="space-y-4">
    <p className="text-sm text-muted-foreground">Manage this profile without opening its details.</p>
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
