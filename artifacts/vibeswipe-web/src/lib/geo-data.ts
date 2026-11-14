// Lazy wrapper around country-state-city so the dataset stays out of the main bundle.
export type GeoOption = { code: string; name: string };
type CountryApi = { getAllCountries: () => { isoCode: string; name: string }[] };
type CityApi = {
  getCitiesOfState: (countryCode: string, stateCode: string) => { name: string }[];
  getCitiesOfCountry: (countryCode: string) => { name: string }[];
};

export async function listCountries(): Promise<GeoOption[]> {
  const module = await import('country-state-city/lib/cjs/country.js') as unknown as { default: { default: CountryApi } };
  const Country = module.default.default;
  return Country.getAllCountries().map(c => ({ code: c.isoCode, name: c.name }));
}

export async function listStates(countryCode: string): Promise<GeoOption[]> {
  const { getStatesOfCountry } = await import('country-state-city/lib/cjs/state.js');
  return getStatesOfCountry(countryCode).map(s => ({ code: s.isoCode, name: s.name }));
}

export async function listCities(countryCode: string, stateCode: string): Promise<GeoOption[]> {
  const module = await import('country-state-city/lib/cjs/city.js') as unknown as { default: { default: CityApi } };
  const City = module.default.default;
  const list = stateCode ? City.getCitiesOfState(countryCode, stateCode) : City.getCitiesOfCountry(countryCode) ?? [];
  const seen = new Set<string>();
  const out: GeoOption[] = [];
  for (const c of list) { if (!seen.has(c.name)) { seen.add(c.name); out.push({ code: c.name, name: c.name }); } }
  return out;
}
