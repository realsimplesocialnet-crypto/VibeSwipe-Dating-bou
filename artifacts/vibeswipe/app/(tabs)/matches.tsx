import { Redirect } from "expo-router";

// Historical match chats live in the Chats inbox.
export default function MatchesScreen() {
  return <Redirect href="/(tabs)/views" />;
}
