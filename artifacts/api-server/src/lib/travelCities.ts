import { City, Country, State } from "country-state-city";

export type DiscoveryLocationScope = "city" | "state" | "country" | "radius";
export type DiscoveryLocationPreference = {
  scope: DiscoveryLocationScope;
  country: string | null;
  state: string | null;
  city: string | null;
  radiusKm: number | null;
};
export type ResolvedDiscoveryArea = DiscoveryLocationPreference;

type CityNameEntry = { normalized: string; name: string };
type CityPoint = { latitude: number; longitude: number };
type GpsCityPoint = { name: string; stateCode: string; latitude: number; longitude: number };
export type DiscoveryGpsLocation = {
  country: { code: string; name: string };
  state: { code: string; name: string } | null;
  city: { code: string; name: string };
};

let cityNames: CityNameEntry[] | undefined;
let cityPoints: Map<string, CityPoint> | undefined;
const gpsCityPoints = new Map<string, GpsCityPoint[]>();

function distanceKm(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(latitudeB - latitudeA);
  const longitudeDelta = radians(longitudeB - longitudeA);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(latitudeA)) *
      Math.cos(radians(latitudeB)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getGpsCityPoints(countryCode: string): GpsCityPoint[] {
  const cached = gpsCityPoints.get(countryCode);
  if (cached) return cached;
  const points = (City.getCitiesOfCountry(countryCode) ?? []).flatMap((city) => {
    const latitude = Number(city.latitude);
    const longitude = Number(city.longitude);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return [];
    }
    return [{ name: city.name, stateCode: city.stateCode, latitude, longitude }];
  });
  gpsCityPoints.set(countryCode, points);
  return points;
}

/**
 * Resolve a one-time GPS fix to the nearest supported city in its country.
 * Raw coordinates remain in memory and are never persisted or returned.
 */
export function resolveDiscoveryGpsLocation(
  latitude: number,
  longitude: number,
  countryCode: string,
): DiscoveryGpsLocation | null {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  const country = Country.getAllCountries().find(
    (item) => item.isoCode === countryCode,
  );
  if (!country) return null;

  const states = new Map(
    State.getStatesOfCountry(countryCode).map((state) => [
      state.isoCode,
      state.name,
    ]),
  );
  let nearest:
    | { city: GpsCityPoint; distance: number }
    | undefined;

  for (const city of getGpsCityPoints(countryCode)) {
    const distance = distanceKm(
      latitude,
      longitude,
      city.latitude,
      city.longitude,
    );
    if (!nearest || distance < nearest.distance) nearest = { city, distance };
  }

  if (!nearest) return null;
  return {
    country: { code: country.isoCode, name: country.name },
    state: states.has(nearest.city.stateCode)
      ? { code: nearest.city.stateCode, name: states.get(nearest.city.stateCode)! }
      : null,
    city: { code: nearest.city.name, name: nearest.city.name },
  };
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase();
}

function locationKey(country: string, state: string | null | undefined, city: string): string {
  return [country, state ?? "", city].map(normalize).join("|");
}

function getCityPoints(): Map<string, CityPoint> {
  if (cityPoints) return cityPoints;

  const countries = new Map(Country.getAllCountries().map((country) => [country.isoCode, country.name]));
  const states = new Map(
    State.getAllStates().map((state) => [`${state.countryCode}:${state.isoCode}`, state.name]),
  );
  const points = new Map<string, CityPoint>();
  for (const city of City.getAllCities()) {
    const latitude = Number(city.latitude);
    const longitude = Number(city.longitude);
    const country = countries.get(city.countryCode);
    const state = states.get(`${city.countryCode}:${city.stateCode}`) ?? "";
    if (!country || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    const key = locationKey(country, state, city.name);
    if (!points.has(key)) points.set(key, { latitude, longitude });
  }
  cityPoints = points;
  return points;
}

function getCityNames(): CityNameEntry[] {
  if (cityNames) return cityNames;

  const unique = new Map<string, string>();
  for (const city of City.getAllCities()) {
    const key = normalize(city.name);
    if (!key) continue;
    const existing = unique.get(key);
    const plainName = city.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "") === city.name;
    const existingIsPlain = existing
      ? existing.normalize("NFD").replace(/[\u0300-\u036f]/g, "") === existing
      : false;
    if (!existing || (plainName && !existingIsPlain)) unique.set(key, city.name);
  }
  cityNames = [...unique].map(([normalized, name]) => ({ normalized, name }));
  return cityNames;
}

export function resolvePreferredDiscoveryArea({
  travelMode,
  travelCity,
  requestedCountry,
  requestedState,
  requestedCity,
  preference,
  homeCountry,
  homeState,
  homeCity,
}: {
  travelMode: boolean;
  travelCity: string | null;
  requestedCountry?: string;
  requestedState?: string;
  requestedCity?: string;
  preference?: DiscoveryLocationPreference | null;
  homeCountry: string | null;
  homeState: string | null;
  homeCity: string;
}): ResolvedDiscoveryArea {
  if (travelMode) {
    return {
      scope: "city",
      country: null,
      state: null,
      city: travelCity?.trim() || homeCity.trim() || null,
      radiusKm: null,
    };
  }

  const countryOverride = requestedCountry?.trim();
  const stateOverride = requestedState?.trim();
  const cityOverride = requestedCity?.trim();
  if (countryOverride || stateOverride || cityOverride) {
    const country = countryOverride || homeCountry?.trim() || null;
    return {
      scope: cityOverride ? "city" : stateOverride ? "state" : "country",
      country,
      state: stateOverride || null,
      city: cityOverride || null,
      radiusKm: null,
    };
  }

  if (preference) {
    const usesHomeFallback = preference.scope === "city" || preference.scope === "radius";
    return {
      scope: preference.scope,
      country: preference.country?.trim() || homeCountry?.trim() || null,
      state: preference.state?.trim() || (usesHomeFallback ? homeState?.trim() || null : null),
      city: preference.city?.trim() || (usesHomeFallback ? homeCity.trim() || null : null),
      radiusKm: preference.radiusKm ?? null,
    };
  }

  return {
    scope: "city",
    country: homeCountry?.trim() || null,
    state: homeState?.trim() || null,
    city: homeCity.trim() || null,
    radiusKm: null,
  };
}

export function distanceBetweenCities(
  from: { country: string; state: string | null; city: string },
  to: { country: string; state: string | null; city: string },
): number | null {
  const points = getCityPoints();
  const origin = points.get(locationKey(from.country, from.state, from.city));
  const destination = points.get(locationKey(to.country, to.state, to.city));
  if (!origin || !destination) return null;

  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latitudeDelta = radians(destination.latitude - origin.latitude);
  const longitudeDelta = radians(destination.longitude - origin.longitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(origin.latitude)) *
      Math.cos(radians(destination.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function findRealTravelCity(value: string): string | null {
  const normalized = normalize(value);
  if (!normalized) return null;
  return getCityNames().find((city) => city.normalized === normalized)?.name ?? null;
}

export function searchRealTravelCities(value: string, limit = 50): { name: string }[] {
  const normalized = normalize(value);
  if (normalized.length < 2) return [];

  const startsWith: CityNameEntry[] = [];
  const contains: CityNameEntry[] = [];
  for (const city of getCityNames()) {
    if (city.normalized.startsWith(normalized)) startsWith.push(city);
    else if (city.normalized.includes(normalized)) contains.push(city);
  }
  const compare = (a: CityNameEntry, b: CityNameEntry) => a.name.localeCompare(b.name);
  return [...startsWith.sort(compare), ...contains.sort(compare)]
    .slice(0, limit)
    .map(({ name }) => ({ name }));
}

export function resolveDiscoveryLocation({
  travelMode,
  travelCity,
  requestedCountry,
  requestedCity,
  homeCity,
}: {
  travelMode: boolean;
  travelCity: string | null;
  requestedCountry?: string;
  requestedCity?: string;
  homeCity: string;
}): { country: string | null; city: string | null } {
  if (travelMode) return { country: null, city: travelCity?.trim() || homeCity };
  const country = requestedCountry?.trim() || null;
  return {
    country,
    city: requestedCity?.trim() || (country ? null : homeCity),
  };
}
