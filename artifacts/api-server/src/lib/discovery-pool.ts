import { Country } from "country-state-city";

// ISO country groups use geographic continents, not language or nationality.
const groups = {
  Africa: "DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW IO KE LS LR LY MG MW ML MR MU YT MA MZ NA NE NG RE RW SH ST SN SC SL SO ZA SS SD TZ TG TN UG EH ZM ZW",
  Europe: "AL AD AT AX BY BE BA BG HR CZ DK EE FO FI FR DE GI GR GG VA HU IS IE IM IT JE XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SJ SE CH UA GB",
  Asia: "AF AM AZ BH BD BT BN KH CN CX CC CY GE HK IN ID IR IQ IL JP JO KZ KP KR KW KG LA LB MO MY MV MN MM NP OM PK PS PH QA SA SG LK SY TW TJ TH TL TR TM AE UZ VN YE",
  NorthAmerica: "AI AG AW BS BB BZ BM BQ CA KY CR CU CW DM DO SV GL GD GP GT HT HN JM MQ MX MS NI PA PR BL KN LC MF PM VC SX TT TC US VG VI",
  SouthAmerica: "AR BO BR CL CO EC FK GF GY PY PE SR UY VE",
  Oceania: "AS AU CK FJ PF GU KI MH FM NR NC NZ NU NF MP PW PG PN WS SB TK TO TV UM VU WF",
  Antarctica: "AQ BV TF HM GS",
};
const continents = new Map(Object.entries(groups).flatMap(([region, codes]) => codes.split(" ").map(code => [code, region] as const)));
const aliases: Record<string, string[]> = {
  US: ["USA", "United States of America"], GB: ["UK", "Great Britain", "United Kingdom"],
  CI: ["Ivory Coast", "Cote d'Ivoire", "Côte d’Ivoire"], KR: ["South Korea", "Republic of Korea"],
  KP: ["North Korea"], RU: ["Russian Federation"], TR: ["Türkiye"],
  CZ: ["Czechia"], CD: ["DR Congo", "Democratic Republic of the Congo"],
  CG: ["Republic of the Congo"], TW: ["Taiwan"], VN: ["Viet Nam"],
};
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const countries = Country.getAllCountries();
const values = new Map(countries.map(c => [c.isoCode, [c.isoCode, c.name, ...(aliases[c.isoCode] ?? [])].map(s => s.trim().toLowerCase())]));
const lookup = new Map([...values].flatMap(([code, names]) => names.map(name => [normalize(name), code] as const)));

export function countryCode(country: string | null | undefined): string | null {
  return country?.trim() ? lookup.get(normalize(country)) ?? null : null;
}
export function continent(country: string | null | undefined): string | null {
  return continents.get(countryCode(country) ?? "") ?? null;
}
export function countryValues(country: string): string[] {
  return values.get(countryCode(country) ?? "") ?? [country.trim().toLowerCase()];
}
export function regionalCountryValues(country: string): string[] {
  const region = continent(country);
  if (!region) return [];
  return [...values].filter(([code]) => continents.get(code) === region).flatMap(([, names]) => names);
}
export function discoveryTier(home: string | null | undefined, candidate: string | null | undefined): number {
  if (!home?.trim() || !candidate?.trim()) return 2;
  if ((countryCode(home) && countryCode(home) === countryCode(candidate)) || normalize(home) === normalize(candidate)) return 0;
  return continent(home) && continent(home) === continent(candidate) ? 1 : 2;
}
export function minimumDiscoveryPool(value: string | undefined): number {
  const threshold = Number(value ?? 20);
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 100) {
    throw new Error("VIBESWIPE_DISCOVERY_MIN_POOL_SIZE must be an integer between 1 and 100.");
  }
  return threshold;
}
export function automaticDiscovery(input: {
  travelMode: boolean; requestedCountry?: string; requestedState?: string; requestedCity?: string; preference?: unknown;
}): boolean {
  return !input.travelMode && !input.requestedCountry?.trim() && !input.requestedState?.trim() && !input.requestedCity?.trim() && !input.preference;
}

/** Bounded fill, with local members always before regional and worldwide ones. */
export async function smartDiscoveryPool<T extends { id: string }>(
  threshold: number,
  query: (tier: 0 | 1 | 2, limit: number, excluded: string[]) => Promise<T[]>,
) {
  const local = await query(0, 100, []);
  const members = [...local];
  for (const tier of [1, 2] as const) {
    if (members.length >= threshold) break;
    const incoming = await query(tier, threshold - members.length, members.map(p => p.id));
    for (const member of incoming) if (!members.some(p => p.id === member.id)) members.push(member);
  }
  return members;
}
