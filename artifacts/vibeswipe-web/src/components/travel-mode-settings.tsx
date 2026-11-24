import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MapPin, Navigation, Search } from "lucide-react";
import {
  getGetDiscoverProfilesQueryKey,
  getGetVibeSwipeSettingsQueryKey,
  getSearchTravelCitiesQueryKey,
  useGetVibeSwipeSettings,
  useSearchTravelCities,
  useUpdateVibeSwipeSettings,
} from "@workspace/api-client-react";

export function TravelModeSettings() {
  const queryClient = useQueryClient();
  const settings = useGetVibeSwipeSettings({ query: { queryKey: getGetVibeSwipeSettingsQueryKey() } });
  const update = useUpdateVibeSwipeSettings();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const travelMode = settings.data?.travelMode ?? false;
  const cities = useSearchTravelCities({ search: debouncedSearch }, {
    query: {
      queryKey: getSearchTravelCitiesQueryKey({ search: debouncedSearch }),
      enabled: travelMode && debouncedSearch.length >= 2,
      retry: false,
    },
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const savedCity = settings.data?.travelCity ?? "";
    setSearch(savedCity);
    setSelectedCity(savedCity);
  }, [settings.data?.travelCity]);

  async function saveSettings(travelModeValue: boolean, travelCity: string | null, confirmation: string) {
    setError("");
    setMessage("");
    try {
      const saved = await update.mutateAsync({
        data: {
          ...(settings.data ?? {}),
          incognito: settings.data?.incognito ?? false,
          travelMode: travelModeValue,
          travelCity,
        } as NonNullable<typeof settings.data>,
      });
      queryClient.setQueryData(getGetVibeSwipeSettingsQueryKey(), saved);
      await queryClient.invalidateQueries({ queryKey: getGetDiscoverProfilesQueryKey() });
      setMessage(confirmation);
      return true;
    } catch {
      setError("Travel Mode could not be saved. Check your connection and try again.");
      return false;
    }
  }

  async function toggleTravelMode(enabled: boolean) {
    const city = enabled ? settings.data?.travelCity ?? null : null;
    const confirmation = enabled
      ? city ? `Now showing people in ${city}.` : "Travel Mode is on. Search for a real city, then save it."
      : "Travel Mode is off. Discovery is back to your registered city.";
    const saved = await saveSettings(enabled, city, confirmation);
    if (saved && !enabled) {
      setSearch("");
      setSelectedCity("");
    }
  }

  async function saveCity() {
    if (!selectedCity || !cities.data?.some((city) => city.name === selectedCity)) {
      setError("Choose a real city from the search results before saving.");
      return;
    }
    await saveSettings(true, selectedCity, `Now showing people in ${selectedCity}.`);
  }

  return (
    <section className="rounded-2xl border border-white/[.08] bg-card p-5" data-testid="travel-mode-settings">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-primary"><Navigation size={18} /></div>
        <div className="flex-1">
          <h3 className="font-bold">Travel Mode</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {travelMode && settings.data?.travelCity ? `Discovering people in ${settings.data.travelCity}.` : "Choose a city to explore people there."}
          </p>
        </div>
        <input
          type="checkbox"
          aria-label="Travel mode"
          data-testid="toggle-travel-mode"
          checked={travelMode}
          disabled={settings.isLoading || update.isPending}
          onChange={(event) => void toggleTravelMode(event.target.checked)}
          className="h-5 w-5 accent-primary"
        />
      </div>

      {travelMode && (
        <div className="mt-5 space-y-3">
          <label className="relative block">
            <span className="sr-only">Search real cities</span>
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              data-testid="input-travel-city"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setSelectedCity(""); setError(""); setMessage(""); }}
              placeholder="Search any real city"
              autoComplete="off"
              className="field pl-10"
            />
          </label>
          {selectedCity && <p className="text-xs text-foreground" data-testid="selected-travel-city">Selected city: {selectedCity}</p>}
          {debouncedSearch.length >= 2 && cities.isFetching && <p role="status" className="text-xs text-muted-foreground">Searching real cities…</p>}
          {cities.isError && <p role="alert" className="text-xs text-rose-300">City search is unavailable. Check your connection and try again.</p>}
          {cities.data?.length ? (
            <div role="listbox" aria-label="Real city search results" className="max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-[#18151d] p-1">
              {cities.data.map((city) => (
                <button
                  key={city.name}
                  type="button"
                  role="option"
                  aria-selected={selectedCity === city.name}
                  onClick={() => { setSelectedCity(city.name); setSearch(city.name); setMessage(""); setError(""); }}
                  data-testid={`option-travel-city-${city.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm ${selectedCity === city.name ? "bg-accent text-primary" : "text-foreground hover:bg-white/[.06]"}`}
                >
                  <MapPin size={14} />{city.name}
                </button>
              ))}
            </div>
          ) : debouncedSearch.length >= 2 && !cities.isFetching && !cities.isError ? (
            <p className="text-xs text-muted-foreground">No real city matches that search. Try another name.</p>
          ) : null}
          <button
            type="button"
            onClick={() => void saveCity()}
            disabled={!selectedCity || update.isPending}
            data-testid="button-save-travel-city"
            className="w-full rounded-xl bg-secondary px-4 py-3 text-sm font-bold text-foreground disabled:opacity-45"
          >
            {update.isPending ? "Saving city…" : "Save city"}
          </button>
        </div>
      )}
      {message && <p role="status" data-testid="travel-mode-confirmation" className="mt-4 text-sm text-emerald-300">{message}</p>}
      {error && <p role="alert" data-testid="travel-mode-error" className="mt-4 text-sm text-rose-300">{error}</p>}
    </section>
  );
}
