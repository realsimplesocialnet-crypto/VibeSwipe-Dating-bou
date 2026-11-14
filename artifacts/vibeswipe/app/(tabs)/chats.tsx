import { Redirect } from "expo-router";

// Legacy route: conversations now live on the Views tab.
export default function LegacyChatsRedirect() {
  return <Redirect href="/(tabs)/views" />;
}
