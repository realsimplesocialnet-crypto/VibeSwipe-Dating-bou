const fillerWords = new Set([
  "a", "about", "after", "all", "am", "an", "and", "are", "as", "at", "be",
  "been", "but", "by", "can", "could", "did", "do", "does", "doing", "for",
  "from", "get", "go", "good", "had", "has", "have", "he", "her", "here",
  "how", "i", "if", "in", "into", "is", "it", "its", "just", "left", "like",
  "me", "my", "now", "of", "on", "only", "or", "our", "out", "she", "so",
  "some", "than", "that", "the", "their", "them", "there", "these", "they",
  "this", "to", "up", "us", "video", "videos", "we", "what", "when", "where",
  "who", "will", "with", "would", "you", "your", "vibes", "want", "guest",
  "bless", "blessed", "blessings", "bring", "camera", "day", "family", "girl",
  "god", "happy", "here", "life", "love", "man", "may", "me", "month", "myself",
  "nice", "photo", "picture", "rest", "smile", "smiling", "unforgettable",
  "woman", "year", "yesterday", "tomorrow",
]);
const topicWords = new Set([
  "apartment", "apartments", "bedroom", "beauty", "birthday", "business", "car", "cars",
  "celebration", "dance", "duplex", "election", "event", "events", "fashion", "fitness",
  "football", "government", "graduation", "health", "home", "hotel", "hotels",
  "housing", "job", "jobs", "makeup", "minister", "music", "news", "party",
  "politics", "president", "property", "recipe", "rent", "rental", "restaurant",
  "restaurants", "sale", "school", "song", "songs", "sport", "sports", "travel",
  "vacation", "vacancies", "wedding", "workout",
]);

function searchWords(value: string): string[] {
  return (value.normalize("NFKC").match(/[\p{L}\p{N}]+/gu) ?? [])
    .map((word) => word.toLocaleLowerCase())
    .filter((word) => (word.length > 1 || /^\d+$/.test(word)) && !fillerWords.has(word));
}

export function reelSearchSuggestion(reel: {
  caption: string;
  creatorLocation: string;
}): string | null {
  const captionWords = [...new Set(searchWords(reel.caption))];
  const hasKnownTopic = captionWords.some((word) => topicWords.has(word));
  if (!captionWords.length || (!hasKnownTopic && captionWords.length < 3)) return null;

  const city = reel.creatorLocation.split(",")[0]?.trim() ?? "";
  const cityWords = [...new Set(searchWords(city))]
    .filter((word) => !captionWords.includes(word));
  const captionLimit = Math.max(1, 6 - cityWords.length - (cityWords.length ? 1 : 0));
  const queryWords = captionWords.slice(0, captionLimit);
  if (cityWords.length) queryWords.push("in", ...cityWords);
  return queryWords.slice(0, 6).join(" ");
}
