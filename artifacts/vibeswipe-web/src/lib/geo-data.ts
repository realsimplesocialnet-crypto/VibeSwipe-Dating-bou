import { Country, State } from 'country-state-city';

// Keep the small country/state datasets in the main bundle. Installed mobile
// browsers can retain an older shell while a lazy chunk is being replaced.
// Cities remain lazy because their dataset is substantially larger.
export type GeoOption = { code: string; name: string };
type CityApi = {
  getCitiesOfState: (countryCode: string, stateCode: string) => { name: string }[];
  getCitiesOfCountry: (countryCode: string) => { name: string }[];
};

function unwrapModule<T>(module: unknown): T {
  let value = module;
  while (
    value &&
    typeof value === 'object' &&
    'default' in value &&
    (value as { default?: unknown }).default
  ) {
    value = (value as { default: unknown }).default;
  }
  return value as T;
}

export async function listCountries(): Promise<GeoOption[]> {
  return Country.getAllCountries().map(c => ({ code: c.isoCode, name: c.name }));
}

export async function listStates(countryCode: string): Promise<GeoOption[]> {
  return State.getStatesOfCountry(countryCode).map(s => ({ code: s.isoCode, name: s.name }));
}

export async function listCities(countryCode: string, stateCode: string): Promise<GeoOption[]> {
  const City = unwrapModule<CityApi>(await import('country-state-city/lib/cjs/city.js'));
  const list = stateCode ? City.getCitiesOfState(countryCode, stateCode) : City.getCitiesOfCountry(countryCode) ?? [];
  const seen = new Set<string>();
  const out: GeoOption[] = [];
  for (const c of list) { if (!seen.has(c.name)) { seen.add(c.name); out.push({ code: c.name, name: c.name }); } }
  return out;
}
