import { City } from "country-state-city";

type CityNameEntry = { normalized: string; name: string };

let cityNames: CityNameEntry[] | undefined;

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase();
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
