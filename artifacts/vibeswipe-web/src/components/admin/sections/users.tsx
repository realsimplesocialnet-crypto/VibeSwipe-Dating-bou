import { useEffect, useState } from 'react';
import { useSearch } from 'wouter';
import type { AdminUser } from '@workspace/api-client-react';
import { RotateCw } from 'lucide-react';
import { useAdminData, useDebounced } from '../admin-hooks';
import { AdminPhoto, ago, EmptyState, ErrorBox, Pager, Pill, Skeleton, UserMark, utc } from '../admin-ui';
import { LiveDot, SearchField, SectionHeader, useDrawers } from '../section-kit';
import { UserActions } from '../user-actions';

function UserLabels({ u }: { u: AdminUser }) {
  return <span className="flex flex-wrap gap-1">
    {u.online && <Pill tone="mint">Online</Pill>}
    {u.suspended && <Pill tone="red">Suspended</Pill>}
    {u.deactivated && <Pill tone="amber">Deactivated</Pill>}
    {u.verified ? <Pill tone="rose">Verified</Pill> : <Pill>Unverified</Pill>}
  </span>;
}

export function UserRow({ u }: { u: AdminUser }) {
  const { openUser } = useDrawers();
  const place = [u.city, u.state, u.country].filter(Boolean).join(', ');
  return <li className="a-row grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 px-4 py-3 md:grid-cols-[auto_minmax(0,1.6fr)_minmax(0,1fr)_110px_auto]" data-testid={`row-user-${u.id}`}>
    <button type="button" onClick={() => openUser(u.id)} className="relative" aria-label={`Open ${u.name}`} data-testid={`button-open-user-photo-${u.id}`}>
      {u.photos[0] ? <AdminPhoto reference={u.photos[0]} alt="" className="h-11 w-11 rounded-full" /> : <UserMark name={u.name} size={44} />}
      {u.online && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[var(--a-panel)] bg-[var(--a-mint)]" />}
    </button>
    <button type="button" onClick={() => openUser(u.id)} className="min-w-0 text-left" data-testid={`button-open-user-${u.id}`}>
      <div className="flex flex-wrap items-center gap-2"><span className="truncate font-bold">{u.name}</span><span className="mono text-xs text-[var(--a-mute)]">{u.age}</span><UserLabels u={u} /></div>
      <div className="mt-0.5 truncate text-xs text-[var(--a-mute)]">{u.email || u.username || u.phone || 'No contact on file'}{place ? ` · ${place}` : ''}</div>
    </button>
    <div className="col-span-2 flex gap-4 text-xs text-[var(--a-mute)] md:col-span-1 md:block">
      <div><span className="mono text-[var(--a-ink)]">{u.connectionCount}</span> matches</div>
      <div className="md:mt-0.5">joined <span className="mono">{utc(u.joinedAt, false)}</span></div>
    </div>
    <div className="mono hidden text-xs text-[var(--a-mute)] md:block" title={utc(u.lastSeenAt)}>{u.online ? <span className="text-[#9fe6c6]">now</span> : ago(u.lastSeenAt)}</div>
    <div className="col-span-2 md:col-span-1"><UserActions u={u} compact /></div>
  </li>;
}

export function UsersSection() {
  const search = useSearch();
  const urlQ = new URLSearchParams(search).get('q') ?? '';
  const [q, setQ] = useState(urlQ);
  const [page, setPage] = useState(1);
  useEffect(() => { setQ(urlQ); }, [urlQ]);
  const dq = useDebounced(q.trim());
  useEffect(() => setPage(1), [dq]);
  const r = useAdminData({ section: 'users', q: dq, page }, { poll: 20_000 });
  const d = r.data;
  return <div>
    <SectionHeader eyebrow="Users" title="Members" detail="Search by name, email, username, phone or city. Open a member for photos, chats and matches." right={<div className="flex flex-wrap items-center gap-2">
      <LiveDot fetching={r.isFetching} label={r.isError ? 'Stale' : 'Current'} />
      {d && <span className="text-xs text-[var(--a-mute)]" data-testid="text-users-updated">Updated {new Date(r.dataUpdatedAt).toLocaleTimeString()}</span>}
      <button type="button" onClick={() => void r.refetch()} disabled={r.isFetching} data-testid="button-refresh-users" className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--a-line)] px-3 text-xs font-bold disabled:opacity-50"><RotateCw size={13} className={r.isFetching ? 'animate-spin' : ''} />Refresh</button>
    </div>} />
    {r.isError && d && <div className="a-panel mb-3"><ErrorBox error={r.error} onRetry={() => void r.refetch()} text="Member data may be out of date." /></div>}
    <div className="a-panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--a-line)] p-3">
        <SearchField value={q} onChange={setQ} placeholder="Search members" testId="input-search-users" />
        {d && <span className="mono text-xs text-[var(--a-mute)]" data-testid="text-users-total">{d.total.toLocaleString()} found</span>}
      </div>
      <div className="hidden grid-cols-[44px_minmax(0,1.6fr)_minmax(0,1fr)_110px_auto] gap-3 border-b border-[var(--a-line)] px-4 py-2 text-[10px] font-bold uppercase tracking-[.14em] text-[var(--a-mute)] md:grid"><span /><span>Member</span><span>Activity</span><span>Last seen</span><span className="w-[220px]">Actions</span></div>
      {r.isError && !d ? <ErrorBox error={r.error} onRetry={() => void r.refetch()} text="Members could not load." /> :
        !d ? <Skeleton rows={8} /> :
        d.users.length === 0 ? <EmptyState title={dq ? 'No members match' : 'No members yet'} detail={dq ? `Nothing found for "${dq}". Try part of a name or email.` : 'Members appear here as soon as they sign up.'} /> :
        <ul className={`divide-y divide-[var(--a-line)] transition-opacity ${r.isPlaceholderData ? 'opacity-50' : ''}`}>{d.users.map(u => <UserRow key={u.id} u={u} />)}</ul>}
      {d && <Pager page={page} total={d.total} pageSize={d.pageSize} onPage={setPage} testId="pager-users" />}
    </div>
  </div>;
}
