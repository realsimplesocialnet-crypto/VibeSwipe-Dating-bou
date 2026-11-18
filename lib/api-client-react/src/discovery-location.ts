export type GpsResolvedDiscoveryLocation = {
  country: { code: string; name: string };
  state: { code: string; name: string } | null;
  city: { code: string; name: string };
};

export function formatDiscoveryLocationStatus(
  location: GpsResolvedDiscoveryLocation,
): string {
  const place = [location.city.name, location.state?.name, location.country.name]
    .filter(Boolean)
    .join(", ");
  return `Using nearest supported city: ${place}. GPS coordinates are not saved.`;
}

export function geolocationFailureMessage(code?: number): string {
  if (code === 1) {
    return "Location access was denied. Choose a location manually or allow it in Settings.";
  }
  if (code === 2) {
    return "Your location could not be determined. Try again or choose a location manually.";
  }
  if (code === 3) {
    return "Finding your location took too long. Try again or choose a location manually.";
  }
  return "A supported nearby city could not be selected. Choose a country and city manually.";
}

export function locationPermissionFailureMessage(canAskAgain: boolean): string {
  return canAskAgain
    ? "Location access was not granted. Choose a location manually or try again."
    : "Location access is off. Open Settings to allow it, or choose a location manually.";
}
