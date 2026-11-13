import type { SaveMyProfileBody } from "@workspace/api-zod";

type ProfileInput = ReturnType<typeof SaveMyProfileBody.parse>;

export function buildProfileValues(
  userId: string,
  body: ProfileInput,
  updatedAt = new Date(),
) {
  return {
    id: userId,
    name: body.name.trim(),
    age: body.age,
    gender: body.gender,
    lookingFor: body.lookingFor,
    bio: body.bio.trim(),
    city: body.city.trim(),
    country: body.country,
    state: body.state,
    interests: body.interests,
    photos: body.photos,
    videoUrl: body.videoUrl ?? null,
    preferences: body.preferences,
    updatedAt,
  };
}
