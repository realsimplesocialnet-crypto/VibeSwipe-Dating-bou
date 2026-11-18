type SearchableMatch = { profile: { name: string } };

export function searchChatsByPersonName<T extends SearchableMatch>(
  matches: readonly T[],
  search: string,
): T[] {
  const query = search.trim().toLocaleLowerCase();
  if (!query) return [...matches];

  const exactMatches = matches.filter(
    (match) => match.profile.name.trim().toLocaleLowerCase() === query,
  );
  if (exactMatches.length) return exactMatches;

  return matches.filter((match) => match.profile.name.toLocaleLowerCase().includes(query));
}
