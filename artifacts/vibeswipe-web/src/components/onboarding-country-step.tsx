import { useState } from "react";
import { resolveOnboardingCountry, type OnboardingCountry } from "@workspace/api-client-react";
import { LocationChoice } from "@/components/location-choice";

type Props = {
  country: string;
  countryCode: string;
  countrySource: string;
  onSelect: (country: OnboardingCountry) => void;
};

export function OnboardingCountryStep({
  country,
  countryCode,
  countrySource,
  onSelect,
}: Props) {
  const [status, setStatus] = useState<"failed" | "saving" | "ready">("ready");
  const [error, setError] = useState("");

  async function chooseCountry(code: string) {
    setStatus("saving");
    setError("");
    try {
      const result = await resolveOnboardingCountry({ countryCode: code });
      onSelect(result);
      setStatus("ready");
    } catch {
      setError("That country could not be saved. Check your connection and choose it again.");
      setStatus("failed");
    }
  }

  if (countrySource && country) {
    return (
      <div className="space-y-2" data-testid="onboarding-country-confirmed">
        <p className="rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm font-semibold text-foreground">
          {countrySource === "gps"
            ? `You're signing up from ${country}. Your profile will show ${country}.`
            : `Your profile will show ${country}.`}
        </p>
        <p className="text-xs text-muted-foreground">Only the country is saved.</p>
      </div>
    );
  }

  if (status === "saving") {
    return (
      <p role="status" className="rounded-2xl border border-white/10 bg-white/[.03] px-4 py-4 text-sm text-muted-foreground">
        Saving your country…
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="text-sm text-muted-foreground">{error}</p>}
      <LocationChoice
        level="country"
        countryCode={countryCode}
        stateCode=""
        value=""
        onSelect={(option) => void chooseCountry(option.code)}
      />
    </div>
  );
}
