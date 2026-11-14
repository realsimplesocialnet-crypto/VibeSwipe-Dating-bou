import { Redirect } from "expo-router";

// Preserve old conversation links while Views shows profile visitors.
export default function LegacyChatsRedirect() {
  return <Redirect href="/messages" />;
}
