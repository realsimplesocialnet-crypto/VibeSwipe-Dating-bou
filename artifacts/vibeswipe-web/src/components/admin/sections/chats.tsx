import { useEffect, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import type { AdminChat } from '@workspace/api-client-react';
import { MessageCircle, X } from 'lucide-react';
import { useAdminData, useDebounced } from '../admin-hooks';
import { ago, EmptyState, ErrorBox, Pager, Skeleton, UserMark, utc } from '../admin-ui';
import { DateRange, LiveDot, SearchField, SectionHeader, useDrawers } from '../section-kit';

export function ChatRow({ c }: { c: AdminChat }) {
  const { openChat } = useDrawers();
  return <li data-testid={`row-chat-${c.id}`}>
    <button type="button" onClick={() => openChat(c.id)} data-testid={`button-open-chat-${c.id}`} className="a-row grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 text-left">
      <span className="flex -space-x-2"><UserMark name={c.userAName} /><UserMark name={c.userBName} /></span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold">{c.userAName} <span className="font-normal text-[var(--a-mute)]">and</span> {c.userBName}</span>
        <span className="block truncate text-xs text-[var(--a-mute)]">Conversation details are available after explicit access</span>
      </span>
      <span className="text-right">
        <span className="mono block text-xs" title={utc(c.lastMessageAt)}>{c.lastMessageAt ? ago(c.lastMessageAt) : 'quiet'}</span>
        <span className="mono mt-0.5 inline-flex items-center gap-1 text-[11px] text-[var(--a-mute)]"><MessageCircle size={11} />{c.messageCount}</span>
      </span>
    </button>
  </li>;
}

export function ChatsSection() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const userId = new URLSearchParams(search).get('userId') ?? '';
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounced(q.trim());
  useEffect(() => setPage(1), [dq, from, to, userId]);
  const r = useAdminData({ section: 'chats', q: dq, from, to, userId, page }, { poll: 15_000 });
  const d = r.data;
  return <div>
    <SectionHeader eyebrow="Chats" title="Conversations" detail="Every mutual-match conversation. This list shows participants, message count, and latest activity only. Open a conversation to inspect its contents; admin access is restricted and logged." right={<LiveDot fetching={r.isFetching} />} />
    <div className="a-panel overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[var(--a-line)] p-3 lg:flex-row lg:items-center">
        <SearchField value={q} onChange={setQ} placeholder="Search by participant name" testId="input-search-chats" />
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} testId="filter-chats-date" />
      </div>
      {userId && <div className="flex items-center gap-2 border-b border-[var(--a-line)] bg-[#f34e9a]/[.06] px-4 py-2 text-xs">
        <span className="text-[var(--a-mute)]">Showing chats for one member</span>
        <button type="button" onClick={() => setLocation('/admin/chats')} data-testid="button-clear-chat-user-filter" className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-0.5 font-bold hover:bg-white/5"><X size={11} />Show all</button>
      </div>}
      {r.isError && !d ? <ErrorBox error={r.error} onRetry={() => void r.refetch()} text="Conversations could not load." /> :
        !d ? <Skeleton rows={8} /> :
        d.chats.length === 0 ? <EmptyState title="No conversations here" detail={dq || from || to ? 'Nothing matches these filters. Widen the date range or clear the search.' : 'Chats appear once two members match and say hello.'} /> :
        <ul className={`divide-y divide-[var(--a-line)] transition-opacity ${r.isPlaceholderData ? 'opacity-50' : ''}`}>{d.chats.map(c => <ChatRow key={c.id} c={c} />)}</ul>}
      {d && <Pager page={page} total={d.total} pageSize={d.pageSize} onPage={setPage} testId="pager-chats" />}
    </div>
  </div>;
}
