const HOBBY_OPTIONS = [
  "Travel", "Music", "Cooking", "Sports", "Gym / Fitness", "Reading", "Gaming", "Movies",
  "Photography", "Dancing", "Hiking", "Fashion", "Art", "Business", "Technology", "Shopping",
  "Nightlife", "Food", "Coffee", "Writing", "Yoga", "Nature", "Volunteering", "Design",
  "Camping", "Beach", "Pets", "Live music", "Gardening", "Outdoors",
] as const;
const MAX_PROFILE_HOBBIES = 12;
const OCCUPATION_OPTIONS = [
  "Student", "Entrepreneur/Business Owner", "Freelancer", "Software Developer", "Designer",
  "Content Creator", "Influencer", "Sales", "Marketing", "Teacher", "Nurse/Doctor", "Driver",
  "Trader", "Civil Servant", "Banker", "Fashion Designer", "Photographer", "Chef", "Unemployed",
  "Prefer not to say", "Other",
] as const;

function slug(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function HobbyMultiSelect({
  value,
  onChange,
  testIdPrefix = "profile",
}: {
  value: string[];
  onChange: (value: string[]) => void;
  testIdPrefix?: string;
}) {
  const selected = Array.isArray(value) ? value : [];
  const knownHobbies = new Set<string>(HOBBY_OPTIONS);

  function toggle(hobby: string) {
    if (selected.includes(hobby)) {
      onChange(selected.filter((item) => item !== hobby));
    } else if (selected.length < MAX_PROFILE_HOBBIES) {
      onChange([...selected, hobby]);
    }
  }

  return (
    <div className="space-y-3" data-testid={`${testIdPrefix}-hobby-selector`}>
      <p className="text-xs text-muted-foreground">
        Choose up to {MAX_PROFILE_HOBBIES}. Tap a selected item in the list or its chip to remove it.
      </p>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Selected hobbies">
          {selected.map((hobby) => (
            <button
              key={`selected-${hobby}`}
              type="button"
              aria-label={`Remove ${hobby}`}
              onClick={() => onChange(selected.filter((item) => item !== hobby))}
              className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-[#ffafd1]"
            >
              {hobby} <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}
      <div
        role="group"
        aria-label="Choose hobbies"
        className="grid max-h-60 grid-cols-2 gap-2 overflow-y-auto rounded-xl border border-white/10 bg-black/10 p-2 sm:grid-cols-3"
      >
        {HOBBY_OPTIONS.map((hobby) => {
          const active = selected.includes(hobby);
          const limitReached = !active && selected.length >= MAX_PROFILE_HOBBIES;
          return (
            <button
              key={hobby}
              type="button"
              data-testid={`${testIdPrefix}-hobby-${slug(hobby)}`}
              aria-pressed={active}
              disabled={limitReached}
              onClick={() => toggle(hobby)}
              className={`min-h-11 rounded-xl border px-3 py-2 text-left text-sm font-medium transition ${
                active
                  ? "border-primary/50 bg-accent text-[#ffafd1]"
                  : "border-white/10 bg-white/[.02] text-foreground hover:bg-white/[.06]"
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {active ? "✓ " : ""}
              {hobby}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {selected.length} selected
        {selected.some((hobby) => !knownHobbies.has(hobby))
          ? " · saved hobbies from your profile are preserved"
          : ""}
      </p>
    </div>
  );
}

export function OccupationSelect({
  value,
  otherValue,
  onChange,
  onOtherChange,
  testIdPrefix = "profile",
}: {
  value: string;
  otherValue: string;
  onChange: (value: string) => void;
  onOtherChange: (value: string) => void;
  testIdPrefix?: string;
}) {
  return (
    <div className="space-y-3" data-testid={`${testIdPrefix}-occupation-selector`}>
      <label className="grid gap-2 text-xs font-semibold text-muted-foreground">
        Work / occupation
        <select
          data-testid={`${testIdPrefix}-occupation`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="field"
        >
          {OCCUPATION_OPTIONS.map((occupation) => (
            <option key={occupation} value={occupation}>
              {occupation}
            </option>
          ))}
        </select>
      </label>
      {value === "Other" && (
        <label className="grid gap-2 text-xs font-semibold text-muted-foreground">
          Add a work type (optional)
          <input
            data-testid={`${testIdPrefix}-occupation-other`}
            value={otherValue}
            onChange={(event) => onOtherChange(event.target.value)}
            maxLength={80}
            placeholder="Your work or occupation"
            className="field"
          />
        </label>
      )}
    </div>
  );
}
