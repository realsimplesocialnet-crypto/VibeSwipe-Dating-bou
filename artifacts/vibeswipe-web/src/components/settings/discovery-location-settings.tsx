import { useEffect, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import type { Profile } from "@workspace/api-client-react";
import { listCities, listCountries, listStates, type GeoOption } from "@/lib/geo-data";

type LocationScope = "city" | "state" | "country" | "radius";
type DiscoveryLocation = NonNullable<Profile["preferences"]["discoveryLocation"]>;

function initialLocation(profile: Profile): DiscoveryLocation {
  const saved = profile.preferences.discoveryLocation;
  return {
    scope: saved?.scope ?? "city",
    country: saved?.country ?? profile.country ?? null,
    state: saved?.state ?? profile.state ?? null,
    city: saved?.city ?? profile.city ?? null,
    radiusKm: saved?.radiusKm ?? profile.preferences.distanceKm ?? 50,
  };
}

export function DiscoveryLocationSettings({
  profile,
  saving,
  onSave,
}: {
  profile: Profile;
  saving: boolean;
  onSave: (changes: Partial<Profile["preferences"]>) => Promise<void>;
}) {
  const initial = initialLocation(profile);
  const [scope, setScope] = useState<LocationScope>(initial.scope);
  const [country, setCountry] = useState(initial.country ?? "");
  const [state, setState] = useState(initial.state ?? "");
  const [city, setCity] = useState(initial.city ?? "");
  const [radiusKm, setRadiusKm] = useState(initial.radiusKm ?? 50);
  const [countries, setCountries] = useState<GeoOption[]>([]);
  const [states, setStates] = useState<GeoOption[]>([]);
  const [cities, setCities] = useState<GeoOption[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [locationError, setLocationError] = useState("");

  const countryCode = useMemo(
    () => countries.find((option) => option.name === country)?.code ?? "",
    [countries, country],
  );
  const stateCode = useMemo(
    () => states.find((option) => option.name === state)?.code ?? "",
    [states, state],
  );
  const saved = initialLocation(profile);
  const saveKey = (value: DiscoveryLocation) =>
    [value.scope, value.country ?? "", value.state ?? "", value.city ?? "", value.radiusKm ?? ""].join("|");
  const currentLocation: DiscoveryLocation = {
    scope,
    country: country || null,
    state: scope === "country" ? null : state || null,
    city: scope === "city" || scope === "radius" ? city || null : null,
    radiusKm: scope === "radius" ? radiusKm : null,
  };
  const canSave = Boolean(
    country &&
      (scope === "country" ||
        (state && (scope === "state" || (city && (scope === "city" || scope === "radius"))))),
  );
  const dirty =
    saveKey(currentLocation) !==
    saveKey({
      ...saved,
      radiusKm: saved.scope === "radius" ? saved.radiusKm : null,
    });

  useEffect(() => {
    let active = true;
    setLoadingCountries(true);
    setLocationError("");
    void listCountries()
      .then((items) => {
        if (active) setCountries(items);
      })
      .catch(() => {
        if (active) setLocationError("Country names could not be loaded. Check your connection and try again.");
      })
      .finally(() => {
        if (active) setLoadingCountries(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!countryCode || scope === "country") {
      setStates([]);
      setCities([]);
      return () => {
        active = false;
      };
    }
    setLoadingLocations(true);
    setLocationError("");
    void listStates(countryCode)
      .then((items) => {
        if (active) setStates(items);
      })
      .catch(() => {
        if (active) setLocationError("State names could not be loaded. Check your connection and try again.");
      })
      .finally(() => {
        if (active) setLoadingLocations(false);
      });
    return () => {
      active = false;
    };
  }, [countryCode, scope]);

  useEffect(() => {
    let active = true;
    if (!countryCode || !stateCode || !(scope === "city" || scope === "radius")) {
      setCities([]);
      return () => {
        active = false;
      };
    }
    setLoadingLocations(true);
    setLocationError("");
    void listCities(countryCode, stateCode)
      .then((items) => {
        if (active) setCities(items);
      })
      .catch(() => {
        if (active) setLocationError("City names could not be loaded. Check your connection and try again.");
      })
      .finally(() => {
        if (active) setLoadingLocations(false);
      });
    return () => {
      active = false;
    };
  }, [countryCode, stateCode, scope]);

  useEffect(() => {
    const next = initialLocation(profile);
    setScope(next.scope);
    setCountry(next.country ?? "");
    setState(next.state ?? "");
    setCity(next.city ?? "");
    setRadiusKm(next.radiusKm ?? 50);
  }, [
    profile.id,
    profile.preferences.discoveryLocation?.scope,
    profile.preferences.discoveryLocation?.country,
    profile.preferences.discoveryLocation?.state,
    profile.preferences.discoveryLocation?.city,
    profile.preferences.discoveryLocation?.radiusKm,
    profile.country,
    profile.state,
    profile.city,
    profile.preferences.distanceKm,
  ]);

  function chooseCountry(value: string) {
    setCountry(value);
    setState("");
    setCity("");
  }

  function useHomeLocation() {
    setScope("city");
    setCountry(profile.country ?? "");
    setState(profile.state ?? "");
    setCity(profile.city ?? "");
  }

  return (
    <section className="rounded-2xl border border-white/[.08] bg-card p-5" data-testid="discovery-location-settings">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"><MapPin size={18}/></span>
        <div>
          <h2 className="text-sm font-bold">Preferred discovery area</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">By default, we show your city first, then other people in your state. We won’t automatically show people from another state or country.</p>
        </div>
      </div>

      <div className="space-y-4">
        <label className="grid gap-2 text-xs font-semibold text-muted-foreground">
          Search area
          <select aria-label="Discovery area" data-testid="select-discovery-location-scope" value={scope} onChange={(event) => setScope(event.target.value as LocationScope)} className="field">
            <option value="city">City, then my state</option>
            <option value="state">State or region</option>
            <option value="country">Entire country</option>
            <option value="radius">Distance radius from a city</option>
          </select>
        </label>

        {loadingCountries ? <p role="status" className="text-xs text-muted-foreground">Loading real country names…</p> : (
          <label className="grid gap-2 text-xs font-semibold text-muted-foreground">
            Country
            <select aria-label="Discovery country" data-testid="select-discovery-country" value={country} onChange={(event) => chooseCountry(event.target.value)} className="field">
              <option value="">Choose a country</option>
              {countries.map((option) => <option key={option.code} value={option.name}>{option.name}</option>)}
            </select>
          </label>
        )}

        {scope !== "country" && (
          <label className="grid gap-2 text-xs font-semibold text-muted-foreground">
            State / region
            <select aria-label="Discovery state or region" data-testid="select-discovery-state" value={state} onChange={(event) => { setState(event.target.value); setCity(""); }} disabled={!countryCode || loadingLocations} className="field disabled:opacity-50">
              <option value="">Choose a state or region</option>
              {states.map((option) => <option key={option.code} value={option.name}>{option.name}</option>)}
            </select>
          </label>
        )}

        {(scope === "city" || scope === "radius") && (
          <label className="grid gap-2 text-xs font-semibold text-muted-foreground">
            City
            <select aria-label="Discovery city" data-testid="select-discovery-city" value={city} onChange={(event) => setCity(event.target.value)} disabled={!stateCode || loadingLocations} className="field disabled:opacity-50">
              <option value="">{loadingLocations ? "Loading cities…" : "Choose a city"}</option>
              {cities.map((option) => <option key={option.code} value={option.name}>{option.name}</option>)}
            </select>
          </label>
        )}

        {scope === "radius" && (
          <label className="grid gap-3 text-xs font-semibold text-muted-foreground">
            Distance · {radiusKm} km
            <input type="range" min={1} max={500} value={radiusKm} data-testid="input-settings-distance" onChange={(event) => setRadiusKm(Number(event.target.value))} className="w-full accent-[#f34e9a]"/>
          </label>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button type="button" disabled={!canSave || !dirty || saving} onClick={() => void onSave({ discoveryLocation: currentLocation, ...(scope === "radius" ? { distanceKm: radiusKm } : {}) })} data-testid="button-save-discovery-location" className="rounded-xl bg-secondary px-4 py-2.5 text-sm font-bold disabled:opacity-45">
            {saving ? "Saving…" : "Save location"}
          </button>
          <button type="button" onClick={useHomeLocation} data-testid="button-use-home-location" className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
            Use my registered location
          </button>
        </div>

        {locationError && <p role="alert" className="text-xs text-rose-300">{locationError}</p>}
        {scope === "radius" && <p className="text-xs leading-5 text-muted-foreground">Radius uses approximate city-center locations. Nearby people may be in another state if they fall within the radius you selected.</p>}
        <p className="text-xs text-muted-foreground">Travel Mode temporarily overrides this saved discovery area.</p>
      </div>
    </section>
  );
}
