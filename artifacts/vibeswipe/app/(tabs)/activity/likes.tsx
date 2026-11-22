import { Redirect } from "expo-router";

// Dating likes were retired in the social conversion; keep the route so old links land safely.
export default function LikesScreen() {
  return <Redirect href="/(tabs)/activity" />;
}
