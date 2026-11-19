import { useEffect, useMemo, useState } from "react";
import { useGetDiscoverProfiles, useGetMyProfile, type Profile } from "@workspace/api-client-react";
import { ArrowLeft, ChevronRight, LoaderCircle } from "lucide-react";
import { useLocation } from "wouter";
import { VerifiedBadge } from "@/components/verified-badge";

const profileMediaUrl = (ref?: string | null) => ref
  ? ref.startsWith("http")
    ? ref
    : ref.startsWith("media:")
      ? `/api/vibeswipe/media/${encodeURIComponent(ref.slice(6))}`
      : ref.startsWith("demo:")
        ? ""
        : `/api/storage${ref.startsWith("/") ? ref : `/${ref}`}`
  : "";

export function MemberSearchPage() {
  const [location, setLocation] = useLocation();
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get("q") ?? "");
  const [debouncedQuery, setDebouncedQuery] = useState(query.trim().replace(/\s+/g, " "));
  const myProfile = useGetMyProfile();
  const request = useMemo(() => ({ q: debouncedQuery }), [debouncedQuery]);
  const results = useGetDiscoverProfiles<Profile[]>(request, {
    query: {
      enabled: debouncedQuery.length >= 2,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim().replace(/\s+/g, " "));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  function updateQuery(value: string) {
    setQuery(value);
    const next = value ? `/search?q=${encodeURIComponent(value)}` : "/search";
    if (location !== next) setLocation(next, { replace: true });
  }

  function openProfile(profile: Profile) {
    const returnTo = `/search?q=${encodeURIComponent(query)}`;
    setLocation(`/profile/${encodeURIComponent(profile.id)}?returnTo=${encodeURIComponent(returnTo)}`);
  }

  const profiles = results.data ?? [];
  const isSearchingForSelf = Boolean(
    myProfile.data?.name
    && myProfile.data.name.toLocaleLowerCase().includes(debouncedQuery.toLocaleLowerCase()),
  );
  return (
    <main className="page-in mx-auto min-h-[100dvh] w-full max-w-[760px] px-4 pb-10 pt-3 text-foreground sm:px-6">
      <header className="mb-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setLocation("/discover")}
          aria-label="Back to Discover"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-foreground"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="brand text-2xl font-bold tracking-[-.04em]">Search</h1>
      </header>

      <label className="relative block">
        <input
          type="search"
          value={query}
          onChange={(event) => updateQuery(event.target.value)}
          placeholder="Search members"
          aria-label="Search members"
          autoComplete="off"
          maxLength={100}
          className="field h-12 rounded-2xl"
        />
      </label>

      {debouncedQuery.length >= 2 && results.isLoading && (
        <div className="flex justify-center py-8" role="status" aria-label="Searching">
          <LoaderCircle size={22} className="animate-spin text-primary" />
        </div>
      )}
      {debouncedQuery.length >= 2 && results.isError && (
        <p role="alert" className="py-8 text-center text-sm text-muted-foreground">Search unavailable</p>
      )}
      {debouncedQuery.length >= 2 && !results.isLoading && !results.isError && profiles.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {isSearchingForSelf ? "Your own profile isn’t shown in member search." : "No members found"}
        </p>
      )}
      {profiles.length > 0 && (
        <ul aria-label="Search results" className="mt-4 space-y-2">
          {profiles.map((profile) => {
            const imageUrl = profileMediaUrl(profile.photos[0]);
            const place = [profile.city?.trim(), profile.country?.trim()].filter(Boolean).join(", ");
            return (
              <li key={profile.id}>
                <button
                  type="button"
                  onClick={() => openProfile(profile)}
                  aria-label={`View ${profile.name}'s profile`}
                  className="flex w-full items-center gap-3 rounded-2xl bg-card px-3 py-3 text-left transition-colors hover:bg-secondary"
                >
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-lg font-bold text-primary">
                    {imageUrl
                      ? <img src={imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                      : profile.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center text-[15px] font-bold text-foreground">
                      <span className="truncate">{profile.name}{profile.age != null ? `, ${profile.age}` : ""}</span>
                      {profile.isVerified && <VerifiedBadge verified className="ml-1.5 shrink-0" />}
                    </span>
                    {place && <span className="mt-1 block truncate text-sm text-muted-foreground">{place}</span>}
                  </span>
                  <ChevronRight size={19} className="shrink-0 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
