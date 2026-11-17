import { useMutation } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export type UnlikeProfileVariables = { profileId: string };

export function useUnlikeProfile() {
  return useMutation({
    mutationKey: ["unlikeProfile"],
    mutationFn: ({ profileId }: UnlikeProfileVariables) =>
      customFetch<void>(`/api/vibeswipe/profiles/${encodeURIComponent(profileId)}/reaction`, {
        method: "DELETE",
      }),
  });
}
