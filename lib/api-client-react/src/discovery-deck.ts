type Member = { id: string };
type SetState<S> = (action: S | ((previous: S) => S)) => void;
type StateHook = <S>(initial: S | (() => S)) => [S, SetState<S>];

/** Preserve the visible card and swipe history, refresh the remaining ranking. */
export function reconcileDiscoveryDeck<T extends Member>(previous: T[], incoming: T[], index: number): T[] {
  const history = previous.slice(0, index);
  const current = previous[index];
  const freshCurrent = incoming.find(p => p.id === current?.id) ?? (incoming.length ? current : undefined);
  const pinned = [...history, ...(freshCurrent ? [freshCurrent] : [])];
  const ids = new Set(pinned.map(p => p.id));
  return [...pinned, ...incoming.filter(p => {
    if (ids.has(p.id)) return false;
    ids.add(p.id);
    return true;
  })];
}

/**
 * Put a failed swipe back in front of the cards still waiting.
 * Cards swiped after it stay behind the index, so they are not offered again.
 */
export function restoreFailedDiscoveryCard<T extends Member>(profiles: T[], index: number, card: T, failedIndex: number) {
  if (index <= failedIndex) return null;
  const nextProfiles = profiles.slice();
  let nextIndex = index;
  if (nextProfiles[failedIndex]?.id === card.id) {
    nextProfiles.splice(failedIndex, 1);
    nextIndex -= 1;
  }
  if (nextProfiles.slice(nextIndex).some(profile => profile.id === card.id)) return null;
  nextProfiles.splice(nextIndex, 0, card);
  return { profiles: nextProfiles, index: nextIndex };
}

/** Start another round only after the previous stack is exhausted. */
export function continueDiscoveryDeck<T extends Member>(previous: T[], incoming: T[], index: number) {
  if (index >= previous.length && incoming.length) {
    return { profiles: [...new Map(incoming.map(member => [member.id, member])).values()], index: 0 };
  }
  return { profiles: reconcileDiscoveryDeck(previous, incoming, index), index };
}

// Bind the consumer's React instance: Expo and web have separate React runtimes.
export function createUseDiscoveryDeck(useState: StateHook) {
  type Deck<T extends Member> = { source: T[] | undefined; key: string; profiles: T[]; index: number };
  const cachedDecks = new Map<string, { deck: Deck<Member>; expiresAt: number }>();
  const cacheLimit = 4;
  const cacheDuration = 10 * 60_000;

  const remember = <T extends Member>(deck: Deck<T>) => {
    cachedDecks.delete(deck.key);
    cachedDecks.set(deck.key, { deck: deck as Deck<Member>, expiresAt: Date.now() + cacheDuration });
    while (cachedDecks.size > cacheLimit) {
      const oldestKey = cachedDecks.keys().next().value;
      if (oldestKey === undefined) break;
      cachedDecks.delete(oldestKey);
    }
  };

  const restore = <T extends Member>(key: string, data: T[] | undefined) => {
    const entry = cachedDecks.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      cachedDecks.delete(key);
      return undefined;
    }
    const cached = entry.deck as Deck<T>;
    const deck = cached.source === data ? cached : {
      ...cached,
      source: data,
      // A route can remount before React Query has restored its cached response.
      // Keep the visible card until fresh data arrives instead of reconciling it
      // against a temporary empty result.
      profiles: data ? reconcileDiscoveryDeck(cached.profiles, data, cached.index) : cached.profiles,
    };
    remember(deck);
    return deck;
  };

  return function useDiscoveryDeck<T extends Member>(data: T[] | undefined, key: string) {
    const [saved, setSaved] = useState<Deck<T>>(() => {
      const restored = restore<T>(key, data);
      const initial = restored ?? { source: data, key, profiles: data ?? [], index: 0 };
      remember(initial);
      return initial;
    });
    let deck = saved;
    if (saved.key !== key || saved.source !== data) {
      const previous = saved.key === key ? saved : restore<T>(key, data);
      deck = previous
        ? {
            key, source: data,
            profiles: previous.source === data ? previous.profiles : reconcileDiscoveryDeck(previous.profiles, data ?? [], previous.index),
            index: previous.index,
          }
        : { key, source: data, profiles: data ?? [], index: 0 };
      remember(deck);
      setSaved(deck);
    }
    const setIndex: SetState<number> = next => setSaved(current => {
      const updated = {
        ...current,
        index: typeof next === "function" ? next(current.index) : next,
      };
      remember(updated);
      return updated;
    });
    const refill = (incoming: T[] | undefined) => {
      if (!incoming) return;
      setSaved(current => {
        // Ignore a response for filters/account that changed while fetching.
        if (current.key !== key) return current;
        const updated = { ...current, source: incoming, ...continueDiscoveryDeck(current.profiles, incoming, current.index) };
        remember(updated);
        return updated;
      });
    };
    const restoreCard = (card: T, failedIndex: number) => {
      setSaved(current => {
        if (current.key !== key) return current;
        const restored = restoreFailedDiscoveryCard(current.profiles, current.index, card, failedIndex);
        if (!restored) return current;
        const updated = { ...current, profiles: restored.profiles, index: restored.index };
        remember(updated);
        return updated;
      });
    };
    return { profiles: deck.profiles, index: deck.index, setIndex, refill, restoreCard };
  };
}
