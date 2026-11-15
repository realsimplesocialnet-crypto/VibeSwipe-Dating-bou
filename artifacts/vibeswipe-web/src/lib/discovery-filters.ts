import type { GetDiscoverProfilesParams } from "@workspace/api-client-react";
import type { GeoOption } from "./geo-data";

export type DiscoveryFilters = {
  ageMin: number;
  ageMax: number;
  gender: string | undefined;
  country: GeoOption | null;
  state: GeoOption | null;
  city: string;
  includePassed: boolean;
};

export function validDiscoveryAges(min: number, max: number): boolean {
  return Number.isInteger(min) && Number.isInteger(max) && min >= 18 && max <= 120 && min <= max;
}

export function discoveryFilterParams(filters: DiscoveryFilters | null): GetDiscoverProfilesParams {
  // An untouched feed uses the member's saved preferences on the server.
  if (!filters) return {};
  return {
    ageMin: filters.ageMin,
    ageMax: filters.ageMax,
    ...(filters.gender ? { gender: filters.gender } : {}),
    ...(filters.country ? {
      country: filters.country.name,
      ...(filters.state ? { state: filters.state.name } : {}),
      ...(filters.city.trim() ? { city: filters.city.trim() } : {}),
      ...(filters.includePassed ? { includePassed: "true" as const } : {}),
    } : {}),
  };
}
