import { useEffect, useState } from "react";
import { listCities, listCountries, listStates, type GeoOption } from "@/lib/geo-data";
import { validDiscoveryAges, type DiscoveryFilters } from "@/lib/discovery-filters";

export function DiscoveryFilterForm({ initialValue, travelMode, onApply }: {
  initialValue: DiscoveryFilters;
  travelMode: boolean;
  onApply: (value: DiscoveryFilters) => void;
}) {
  // Draft values never update the query until the member presses Show people.
  const [draft, setDraft] = useState<DiscoveryFilters>(() => ({ ...initialValue }));
  const [countries, setCountries] = useState<GeoOption[]>([]);
  const [states, setStates] = useState<GeoOption[]>([]);
  const [cities, setCities] = useState<GeoOption[]>([]);
  const [citySearch, setCitySearch] = useState(initialValue.city);
  const [loadingCities, setLoadingCities] = useState(false);
  const [locationError, setLocationError] = useState("");

  useEffect(() => {
    let active = true;
    void listCountries().then(items => { if (active) setCountries(items); })
      .catch(() => { if (active) setLocationError("Country names could not load. Close the filters and try again."); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setStates([]);
    if (draft.country) {
      void listStates(draft.country.code).then(items => { if (active) setStates(items); })
        .catch(() => { if (active) setLocationError("State names could not load. Close the filters and try again."); });
    }
    return () => { active = false; };
  }, [draft.country?.code]);

  useEffect(() => {
    let active = true;
    setCities([]);
    setLoadingCities(Boolean(draft.country));
    setLocationError("");
    if (draft.country) {
      void listCities(draft.country.code, draft.state?.code ?? "").then(items => { if (active) setCities(items); })
        .catch(() => { if (active) setLocationError("City names could not load. You can still search the selected country or state."); })
        .finally(() => { if (active) setLoadingCities(false); });
    }
    return () => { active = false; };
  }, [draft.country?.code, draft.state?.code]);

  function chooseCountry(code: string) {
    setDraft(value => ({ ...value, country: countries.find(item => item.code === code) ?? null, state: null, city: "", includePassed: false }));
    setCitySearch("");
  }
  function chooseState(code: string) {
    setDraft(value => ({ ...value, state: states.find(item => item.code === code) ?? null, city: "" }));
    setCitySearch("");
  }

  const search = citySearch.trim().toLocaleLowerCase();
  const suggestions = search.length >= 2 && citySearch !== draft.city
    ? cities.filter(item => item.name.toLocaleLowerCase().includes(search))
      .sort((a, b) => Number(b.name.toLocaleLowerCase().startsWith(search)) - Number(a.name.toLocaleLowerCase().startsWith(search)) || a.name.localeCompare(b.name))
      .slice(0, 12)
    : [];
  const agesValid = validDiscoveryAges(draft.ageMin, draft.ageMax);
  const locationValid = !search || Boolean(draft.city);

  return <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (agesValid && locationValid) onApply(draft); }}>
    <div className="grid grid-cols-2 gap-3">
      <label className="text-xs text-muted-foreground">Age from<input data-testid="input-filter-age-min" type="number" min="18" max="120" required value={draft.ageMin || ""} onChange={event => setDraft(value => ({ ...value, ageMin: Number(event.target.value) }))} className="field mt-2" /></label>
      <label className="text-xs text-muted-foreground">Age to<input data-testid="input-filter-age-max" type="number" min={Math.max(18, draft.ageMin)} max="120" required value={draft.ageMax || ""} onChange={event => setDraft(value => ({ ...value, ageMax: Number(event.target.value) }))} className="field mt-2" /></label>
    </div>
    {!agesValid && <p role="alert" className="text-xs text-destructive">Choose an age range from 18 to 120, with Age from no greater than Age to.</p>}
    <label className="block text-xs text-muted-foreground">Interested in<select data-testid="select-filter-gender" value={draft.gender ?? ""} onChange={event => setDraft(value => ({ ...value, gender: event.target.value || undefined }))} className="field mt-2"><option value="">Use signup preference</option><option>Everyone</option><option>Woman</option><option>Man</option><option>Non-binary</option></select></label>
    {travelMode && <p className="rounded-xl border border-primary/20 bg-accent px-3 py-2 text-xs text-foreground">Travel Mode is active. Turn it off in Settings to search another country.</p>}
    <label className="block text-xs text-muted-foreground">Country<select data-testid="select-filter-country" disabled={travelMode} value={draft.country?.code ?? ""} onChange={event => chooseCountry(event.target.value)} className="field mt-2 disabled:opacity-50"><option value="">Use my saved/default location</option>{countries.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
    <label className="block text-xs text-muted-foreground">State / region <span className="font-normal">(optional)</span><select data-testid="select-filter-state" disabled={!draft.country || travelMode} value={draft.state?.code ?? ""} onChange={event => chooseState(event.target.value)} className="field mt-2 disabled:opacity-50"><option value="">{draft.country ? "Any state / region" : "Choose a country first"}</option>{states.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
    <div>
      <label className="block text-xs text-muted-foreground">City <span className="font-normal">(optional)</span><input data-testid="input-filter-city" value={citySearch} onChange={event => { setCitySearch(event.target.value); setDraft(value => ({ ...value, city: "" })); }} disabled={!draft.country || travelMode} placeholder={draft.country ? "Any city" : "Choose a country first"} className="field mt-2 disabled:opacity-50" /></label>
      <p className="mt-1.5 text-[11px] text-muted-foreground">For everyone in Bauchi or Lagos State, choose the state above and leave City blank. Choose a city suggestion for that city only.</p>
      {loadingCities && <p role="status" className="mt-2 text-xs text-muted-foreground">Loading cities…</p>}
      {locationError && <p role="alert" className="mt-2 text-xs text-destructive">{locationError}</p>}
      {suggestions.length > 0 && <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-border">{suggestions.map(item => <button type="button" key={item.code} data-testid={`filter-city-${item.code}`} onClick={() => { setDraft(value => ({ ...value, city: item.name })); setCitySearch(item.name); }} className="block w-full border-b border-border px-3 py-2.5 text-left text-sm last:border-0 hover:bg-secondary">{item.name}</button>)}</div>}
      {!locationValid && !loadingCities && suggestions.length === 0 && <p className="mt-2 text-xs text-muted-foreground">Select a city suggestion, or clear City to search the selected country or state.</p>}
    </div>
    <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-xs">
      <input data-testid="checkbox-filter-include-passed" type="checkbox" checked={draft.includePassed} disabled={!draft.country || travelMode} onChange={event => setDraft(value => ({ ...value, includePassed: event.target.checked }))} className="mt-0.5 accent-[hsl(var(--primary))]" />
      <span>Include profiles I previously passed<span className="mt-1 block text-muted-foreground">Optional for location searches. Blocked, private and unavailable profiles stay protected.</span></span>
    </label>
    <p className="text-[11px] text-muted-foreground">All selected filters apply together after you tap Show people. Empty location fields mean Any.</p>
    <button type="submit" disabled={!agesValid || !locationValid} data-testid="button-apply-filters" className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50">Show people</button>
  </form>;
}
