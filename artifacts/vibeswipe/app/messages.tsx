import { Redirect } from "expo-router";

// All old Messages links resolve to the single bottom-tab conversation list.
export default function MessagesRedirect() {
  return <Redirect href="/(tabs)/views" />;
}
