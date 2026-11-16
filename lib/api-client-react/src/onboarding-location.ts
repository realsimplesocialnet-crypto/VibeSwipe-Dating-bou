import { customFetch } from "./custom-fetch";

export type OnboardingCountry = {
  country: string;
  countryCode: string;
  source: "gps" | "manual";
};

export type OnboardingCountryInput =
  | { latitude: number; longitude: number }
  | { countryCode: string };

export function resolveOnboardingCountry(
  input: OnboardingCountryInput,
): Promise<OnboardingCountry> {
  return customFetch<OnboardingCountry>(
    "/api/vibeswipe/onboarding/location-country",
    {
      method: "POST",
      body: JSON.stringify(input),
      responseType: "json",
    },
  );
}
