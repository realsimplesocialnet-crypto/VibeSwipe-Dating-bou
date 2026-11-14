import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MessagesScreen } from "./(tabs)/views";
import { useColors } from "@/hooks/useColors";

export default function MessagesPage() {
  const colors = useColors();
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to Matches" testID="messages-back" onPress={() => router.replace("/(tabs)/matches")} style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 }}>
        <Feather name="arrow-left" size={22} color={colors.foreground} /><Text style={{ color: colors.foreground, fontWeight: "600" }}>Back to Matches</Text>
      </Pressable>
    </View>
    <MessagesScreen />
  </SafeAreaView>;
}
