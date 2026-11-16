export type SetupData = {
  firstName: string;
  lastName: string;
  age: string;
  gender: string;
  lookingFor: string;
  photos: string[];
  bio: string;
  country: string;
  countryCode: string;
  countrySource: string;
  state: string;
  stateCode: string;
  city: string;
  interests: string[];
  occupation: string;
  occupationOther: string;
  ageMin: string;
  ageMax: string;
  distanceKm: number;
};

export const EMPTY_SETUP: SetupData = {
  firstName: "",
  lastName: "",
  age: "",
  gender: "",
  lookingFor: "",
  photos: [],
  bio: "",
  country: "",
  countryCode: "",
  countrySource: "",
  state: "",
  stateCode: "",
  city: "",
  interests: [],
  occupation: "Prefer not to say",
  occupationOther: "",
  ageMin: "22",
  ageMax: "35",
  distanceKm: 50,
};

export function asSetupData(value: Record<string, unknown>): SetupData {
  const interests = Array.isArray(value.interests)
    ? value.interests.filter((item): item is string => typeof item === "string")
    : typeof value.interests === "string"
      ? value.interests.split(",").map((item) => item.trim()).filter(Boolean)
      : [];
  return {
    ...EMPTY_SETUP,
    ...value,
    firstName: typeof value.firstName === "string" ? value.firstName : "",
    lastName: typeof value.lastName === "string" ? value.lastName : "",
    age: typeof value.age === "string" ? value.age : "",
    gender: typeof value.gender === "string" ? value.gender : "",
    lookingFor: typeof value.lookingFor === "string" ? value.lookingFor : "",
    photos: Array.isArray(value.photos)
      ? value.photos.filter((photo): photo is string => typeof photo === "string")
      : [],
    bio: typeof value.bio === "string" ? value.bio : "",
    country: typeof value.country === "string" ? value.country : "",
    countryCode: typeof value.countryCode === "string" ? value.countryCode : "",
    countrySource:
      value.countrySource === "gps" || value.countrySource === "manual"
        ? value.countrySource
        : "",
    state: typeof value.state === "string" ? value.state : "",
    stateCode: typeof value.stateCode === "string" ? value.stateCode : "",
    city: typeof value.city === "string" ? value.city : "",
    interests,
    occupation: typeof value.occupation === "string" ? value.occupation : EMPTY_SETUP.occupation,
    occupationOther: typeof value.occupationOther === "string" ? value.occupationOther : "",
    ageMin: typeof value.ageMin === "string" ? value.ageMin : "22",
    ageMax: typeof value.ageMax === "string" ? value.ageMax : "35",
    distanceKm:
      typeof value.distanceKm === "number" ? value.distanceKm : 50,
  };
}

export function getOnboardingStepError(
  step: number,
  values: SetupData,
): string | null {
  if (step === 0 && !values.firstName.trim()) {
    return "Enter your first name to continue.";
  }
  if (step === 1 && !values.lastName.trim()) {
    return "Enter your last name to continue.";
  }
  if (step === 2) {
    const age = Number(values.age);
    if (!Number.isInteger(age) || age < 18 || age > 120) {
      return "You must be between 18 and 120 years old.";
    }
  }
  if (step === 3 && !values.gender) {
    return "Choose a gender to continue.";
  }
  if (step === 4 && !values.lookingFor) {
    return "Choose who you would like to meet.";
  }
  if (step === 5 && values.photos.length !== 1) {
    return "Add one profile picture to continue.";
  }
  if (step === 0 && (!values.countryCode || !values.countrySource)) {
    return "Select a country to continue.";
  }
  if (step === 9) {
    const min = Number(values.ageMin);
    const max = Number(values.ageMax);
    if (!Number.isInteger(min) || min < 18 || min > 120) {
      return "Set the minimum age between 18 and 120.";
    }
    if (!Number.isInteger(max) || max < min || max > 120) {
      return "The maximum age must be at least the minimum and no more than 120.";
    }
    if (values.distanceKm < 1 || values.distanceKm > 500) {
      return "Choose a distance from 1 to 500 km.";
    }
  }
  return null;
}

export function buildProfileInput(values: SetupData) {
  return {
    name: `${values.firstName.trim()} ${values.lastName.trim()}`.trim(),
    age: Number(values.age),
    gender: values.gender,
    lookingFor: values.lookingFor,
    bio: values.bio.trim(),
    country: values.country || null,
    state: null,
    city: "",
    interests: values.interests.slice(0, 12),
    occupation: values.occupation,
    occupationOther: values.occupation === "Other" ? values.occupationOther.trim() : "",
    photos: values.photos,
    videoUrl: null,
    preferences: {
      ageMin: Number(values.ageMin),
      ageMax: Number(values.ageMax),
      gender: values.lookingFor,
      distanceKm: values.distanceKm,
    },
  };
}

export async function runProfileCompletionOnce(
  guard: { current: boolean },
  action: () => Promise<void>,
): Promise<boolean> {
  if (guard.current) return false;
  guard.current = true;
  try {
    await action();
    return true;
  } catch (error) {
    guard.current = false;
    throw error;
  }
}
