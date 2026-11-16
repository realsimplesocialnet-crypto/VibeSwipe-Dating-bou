import { useEffect, useRef, useState } from "react";
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
  const [status, setStatus] = useState<"detecting" | "failed" | "saving" | "ready">(
    countrySource ? "ready" : "detecting",
  );
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const attempt = useRef(0);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (countrySource) {
      setStatus("ready");
      return;
    }
    let active = true;
    const currentAttempt = ++attempt.current;
    setStatus("detecting");
    setError("");
    if (!navigator.geolocation) {
      setStatus("failed");
      setError("We couldn't detect your location. Please enable location access or select your country.");
      return () => {
        active = false;
      };
    }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const result = await resolveOnboardingCountry({
            latitude: coords.latitude,
            longitude: coords.longitude,
          });
          if (!active || attempt.current !== currentAttempt) return;
          onSelectRef.current(result);
          setStatus("ready");
        } catch {
          if (!active || attempt.current !== currentAttempt) return;
          setError("We couldn't detect your location. Please enable location access or select your country.");
          setStatus("failed");
        }
      },
      () => {
        if (!active || attempt.current !== currentAttempt) return;
        setError("We couldn't detect your location. Please enable location access or select your country.");
        setStatus("failed");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
    return () => {
      active = false;
    };
  }, [countrySource, retry]);

  async function chooseCountry(code: string) {
    setStatus("saving");
    setError("");
    try {
      const result = await resolveOnboardingCountry({ countryCode: code });
      onSelectRef.current(result);
      setStatus("ready");
    } catch {
      setError("That country could not be saved. Please try again.");
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

  if (status === "detecting" || status === "saving") {
    return (
      <p role="status" className="rounded-2xl border border-white/10 bg-white/[.03] px-4 py-4 text-sm text-muted-foreground">
        {status === "saving" ? "Saving your country…" : "Detecting your country…"}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p role="alert" className="text-sm text-muted-foreground">
        {error || "We couldn't detect your location. Please enable location access or select your country."}
      </p>
      <LocationChoice
        level="country"
        countryCode={countryCode}
        stateCode=""
        value=""
        onSelect={(option) => void chooseCountry(option.code)}
      />
      <button
        type="button"
        onClick={() => setRetry((value) => value + 1)}
        className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-primary"
      >
        Try again
      </button>
    </div>
  );
}
