import { createRequire } from "node:module";
import { Country } from "country-state-city";

type Point = [number, number];
type CountryGeometry = {
  type: "Polygon" | "MultiPolygon";
  arcs: number[][] | number[][][];
  properties?: { name?: string };
};
type CountryTopology = {
  arcs: number[][][];
  transform: { scale: [number, number]; translate: [number, number] };
  objects: { countries: { geometries: CountryGeometry[] } };
};

const require = createRequire(import.meta.url);
const topology = require("world-atlas/countries-50m.json") as CountryTopology;
const countryByCode = new Map(
  Country.getAllCountries().map((country) => [country.isoCode, country]),
);

function normalizedName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const specialCodes = new Map(
  Object.entries({
    Fiji: "FJ",
    "W. Sahara": "EH",
    "United States of America": "US",
    "Dem. Rep. Congo": "CD",
    "Dominican Rep.": "DO",
    Bahamas: "BS",
    "Falkland Is.": "FK",
    "Fr. S. Antarctic Lands": "TF",
    "Timor-Leste": "TL",
    "Côte d'Ivoire": "CI",
    "Central African Rep.": "CF",
    "Eq. Guinea": "GQ",
    eSwatini: "SZ",
    Palestine: "PS",
    Gambia: "GM",
    "Solomon Is.": "SB",
    Czechia: "CZ",
    "N. Cyprus": "CY",
    Somaliland: "SO",
    "Bosnia and Herz.": "BA",
    "S. Sudan": "SS",
  }).map(([name, code]) => [normalizedName(name), code]),
);

const codeByName = new Map(
  Country.getAllCountries().map((country) => [
    normalizedName(country.name),
    country.isoCode,
  ]),
);

const arcCache = new Map<number, Point[]>();

function decodeArc(reference: number): Point[] {
  const reversed = reference < 0;
  const index = reversed ? ~reference : reference;
  let points = arcCache.get(index);
  if (!points) {
    let x = 0;
    let y = 0;
    const [scaleX, scaleY] = topology.transform.scale;
    const [translateX, translateY] = topology.transform.translate;
    points = topology.arcs[index].map(([deltaX, deltaY]) => {
      x += deltaX;
      y += deltaY;
      return [x * scaleX + translateX, y * scaleY + translateY];
    });
    arcCache.set(index, points);
  }
  return reversed ? points.slice().reverse() : points;
}

function ringFromArcs(references: number[]): Point[] {
  const ring: Point[] = [];
  for (const reference of references) {
    const points = decodeArc(reference);
    ring.push(...(ring.length ? points.slice(1) : points));
  }
  return ring;
}

function pointInRing(longitude: number, latitude: number, ring: Point[]): boolean {
  if (ring.length < 3) return false;
  const unwrapped: Point[] = [];
  let previousLongitude =
    ring[0][0] + 360 * Math.round((longitude - ring[0][0]) / 360);
  unwrapped.push([previousLongitude, ring[0][1]]);
  for (let index = 1; index < ring.length; index++) {
    const [rawLongitude, rawLatitude] = ring[index];
    previousLongitude =
      rawLongitude + 360 * Math.round((previousLongitude - rawLongitude) / 360);
    unwrapped.push([previousLongitude, rawLatitude]);
  }

  let inside = false;
  for (
    let current = 0, previous = unwrapped.length - 1;
    current < unwrapped.length;
    previous = current++
  ) {
    const [currentLongitude, currentLatitude] = unwrapped[current];
    const [previousX, previousLatitude] = unwrapped[previous];
    const crossesLatitude =
      (currentLatitude > latitude) !== (previousLatitude > latitude);
    if (!crossesLatitude) continue;
    const crossingLongitude =
      ((previousX - currentLongitude) * (latitude - currentLatitude)) /
        (previousLatitude - currentLatitude) +
      currentLongitude;
    if (longitude < crossingLongitude) inside = !inside;
  }
  return inside;
}

function pointInPolygon(longitude: number, latitude: number, rings: Point[][]): boolean {
  if (!rings.length || !pointInRing(longitude, latitude, rings[0])) return false;
  return !rings.slice(1).some((hole) => pointInRing(longitude, latitude, hole));
}

const countries = topology.objects.countries.geometries.flatMap((geometry) => {
  const name = geometry.properties?.name;
  if (!name) return [];
  const code =
    specialCodes.get(normalizedName(name)) ?? codeByName.get(normalizedName(name));
  if (!code || !countryByCode.has(code)) return [];
  const polygons =
    geometry.type === "Polygon"
      ? [geometry.arcs as number[][]]
      : (geometry.arcs as number[][][]);
  return [
    {
      code,
      polygons: polygons.map((polygon) =>
        polygon.map((references) => ringFromArcs(references)),
      ),
    },
  ];
});

/**
 * Map a one-time GPS fix to a country using bundled country boundaries.
 * Coordinates are only processed in memory and are never persisted.
 */
export function countryCodeFromCoordinates(
  latitude: number,
  longitude: number,
): string | null {
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
  for (const country of countries) {
    if (
      country.polygons.some((polygon) =>
        pointInPolygon(longitude, latitude, polygon),
      )
    ) {
      return country.code;
    }
  }
  return null;
}
