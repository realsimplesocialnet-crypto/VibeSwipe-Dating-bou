import { getDiscoverProfiles, useGetDiscoverProfiles, type Profile } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useColors } from "@/hooks/useColors";
import { router, useLocalSearchParams } from "expo-router";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useEffect, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SEARCH_PAGE_SIZE = 50;

export default function MemberSearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(typeof params.q === "string" ? params.q : "");
  const [debouncedQuery, setDebouncedQuery] = useState(query.trim().replace(/\s+/g, " "));
  const isSearching = debouncedQuery.length >= 1;
  const suggestions = useGetDiscoverProfiles<Profile[]>({}, {
    query: {
      enabled: !isSearching,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  });
  const searchResults = useInfiniteQuery({
    queryKey: ["/api/vibeswipe/discover", "member-search", debouncedQuery],
    queryFn: ({ pageParam, signal }) =>
      getDiscoverProfiles({ q: debouncedQuery, offset: pageParam }, { signal }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === SEARCH_PAGE_SIZE ? pages.length * SEARCH_PAGE_SIZE : undefined,
    enabled: isSearching,
    staleTime: 30_000,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim().replace(/\s+/g, " "));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const profiles = isSearching
    ? searchResults.data?.pages.flat() ?? []
    : suggestions.data ?? [];
  const isLoading = isSearching ? searchResults.isLoading : suggestions.isLoading;
  const isError = isSearching ? searchResults.isError : suggestions.isError;
  const updateQuery = (value: string) => setQuery(value);

  const openProfile = (profile: Profile) => {
    router.push({ pathname: "/profile/[profileId]", params: { profileId: profile.id } });
  };

  const locationLabel = (profile: Profile) =>
    [profile.city?.trim(), profile.country?.trim()].filter(Boolean).join(", ");

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView style={styles.keyboard} behavior="padding">
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={21} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground }]}>Search</Text>
        </View>

        <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            value={query}
            onChangeText={updateQuery}
            placeholder="Search members"
            placeholderTextColor={colors.mutedForeground}
            accessibilityLabel="Search members"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            maxLength={100}
            selectionColor={colors.primary}
            textAlignVertical="center"
            style={[styles.input, { color: colors.foreground }]}
          />
          {query.length > 0 && (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => updateQuery("")} hitSlop={10}>
              <Feather name="x-circle" size={18} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>

        {isError && !profiles.length ? (
          <ActivityIndicator color={colors.primary} accessibilityLabel="Loading" style={styles.empty} />
        ) : (
          <FlatList
            data={profiles}
            keyExtractor={(profile) => profile.id}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={profiles.length > 0}
            contentContainerStyle={styles.results}
            onEndReached={() => {
              if (isSearching && searchResults.hasNextPage && !searchResults.isFetchingNextPage) {
                void searchResults.fetchNextPage();
              }
            }}
            onEndReachedThreshold={0.45}
            renderItem={({ item }) => {
              const place = locationLabel(item);
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`View ${item.name}'s profile`}
                  onPress={() => openProfile(item)}
                  style={({ pressed }) => [styles.resultRow, { backgroundColor: colors.card, opacity: pressed ? 0.78 : 1 }]}
                >
                  <ProfileAvatar profile={item} size={54} />
                  <View style={styles.resultCopy}>
                    <Text numberOfLines={1} style={[styles.name, { color: colors.foreground }]}>
                      {item.name}
                    </Text>
                    {place ? <Text numberOfLines={1} style={[styles.location, { color: colors.mutedForeground }]}>{place}</Text> : null}
                  </View>
                  <Feather name="chevron-right" size={19} color={colors.mutedForeground} />
                </Pressable>
              );
            }}
            ListEmptyComponent={
              isLoading
                ? <ActivityIndicator color={colors.primary} style={styles.loader} />
                : <Text style={[styles.empty, { color: colors.mutedForeground }]}>
                    {isSearching ? "No members found" : "No people to show right now"}
                  </Text>
            }
            ListFooterComponent={
              isSearching && searchResults.hasNextPage ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Load more people"
                  onPress={() => void searchResults.fetchNextPage()}
                  disabled={searchResults.isFetchingNextPage}
                  style={styles.loadMore}
                >
                  {searchResults.isFetchingNextPage
                    ? <ActivityIndicator color={colors.primary} />
                    : <Text style={{ color: colors.primary, fontWeight: "700" }}>Load more people</Text>}
                </Pressable>
              ) : undefined
            }
          />
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  keyboard: { flex: 1 },
  header: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16 },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "700", letterSpacing: -0.6 },
  searchBox: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginTop: 0, paddingHorizontal: 14, borderWidth: 1, borderRadius: 16 },
  input: { flex: 1, minWidth: 0, paddingHorizontal: 8, paddingVertical: Platform.OS === "ios" ? 13 : 10, fontSize: 15 },
  results: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 24, gap: 8 },
  loadMore: { minHeight: 46, alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  resultRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 10 },
  resultCopy: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: "700" },
  location: { marginTop: 4, fontSize: 13 },
  empty: { paddingHorizontal: 24, paddingTop: 28, textAlign: "center", fontSize: 14 },
  loader: { paddingTop: 24 },
});
