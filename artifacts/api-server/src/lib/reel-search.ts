const STOP_WORDS = new Set(["a", "an", "and", "are", "at", "for", "how", "in", "is", "my", "of", "on", "the", "to", "what", "where"]);

export function reelSearchTerms(query: string): string[] {
  const words = query.normalize("NFKC").toLocaleLowerCase("en").match(/[\p{L}\p{N}]+/gu) ?? [];
  const meaningful = [...new Set(words.filter((word) => word.length > 1 && !STOP_WORDS.has(word)))].slice(0, 8);
  return meaningful.length ? meaningful : [...new Set(words)].slice(0, 8);
}
