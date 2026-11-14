// Lazy wrapper around country-state-city so the dataset stays out of the main bundle.
export type GeoOption = { code: string; name: string };

let mod: Promise<typeof import('country-state-city')> | null = null;
const load = () => (mod ??= import('country-state-city'));

export async function listCountries(): Promise<GeoOption[]> {
  const { Country } = await load();
  return Country.getAllCountries().map(c => ({ code: c.isoCode, name: c.name }));
}

export async function listStates(countryCode: string): Promise<GeoOption[]> {
  const { State } = await load();
  return State.getStatesOfCountry(countryCode).map(s => ({ code: s.isoCode, name: s.name }));
}

export async function listCities(countryCode: string, stateCode: string): Promise<GeoOption[]> {
  const { City } = await load();
  const list = stateCode ? City.getCitiesOfState(countryCode, stateCode) : City.getCitiesOfCountry(countryCode) ?? [];
  const seen = new Set<string>();
  const out: GeoOption[] = [];
  for (const c of list) { if (!seen.has(c.name)) { seen.add(c.name); out.push({ code: c.name, name: c.name }); } }
  return out;
}
