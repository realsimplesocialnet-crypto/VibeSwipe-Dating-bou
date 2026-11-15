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

/** Start another round only after the previous stack is exhausted. */
export function continueDiscoveryDeck<T extends Member>(previous: T[], incoming: T[], index: number) {
  if (index >= previous.length && incoming.length) {
    return { profiles: [...new Map(incoming.map(member => [member.id, member])).values()], index: 0 };
  }
  return { profiles: reconcileDiscoveryDeck(previous, incoming, index), index };
}

// Bind the consumer's React instance: Expo and web have separate React runtimes.
export function createUseDiscoveryDeck(useState: StateHook) {
  return function useDiscoveryDeck<T extends Member>(data: T[] | undefined, key: string) {
    type Deck = { source: T[] | undefined; key: string; profiles: T[]; index: number };
    const [saved, setSaved] = useState<Deck>({ source: data, key, profiles: data ?? [], index: 0 });
    let deck = saved;
    if (saved.key !== key || saved.source !== data) {
      deck = {
        key, source: data,
        profiles: saved.key !== key ? data ?? [] : reconcileDiscoveryDeck(saved.profiles, data ?? [], saved.index),
        index: saved.key !== key ? 0 : saved.index,
      };
      setSaved(deck);
    }
    const setIndex: SetState<number> = next => setSaved(current => ({
      ...current, index: typeof next === "function" ? next(current.index) : next,
    }));
    const refill = (incoming: T[] | undefined) => {
      if (!incoming) return;
      setSaved(current => {
        // Ignore a response for filters/account that changed while fetching.
        if (current.key !== key) return current;
        return { ...current, source: incoming, ...continueDiscoveryDeck(current.profiles, incoming, current.index) };
      });
    };
    return { profiles: deck.profiles, index: deck.index, setIndex, refill };
  };
}
