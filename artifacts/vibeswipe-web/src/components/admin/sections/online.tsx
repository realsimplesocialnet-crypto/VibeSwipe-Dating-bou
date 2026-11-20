import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import type { AdminUser } from '@workspace/api-client-react';
import { Ban, MessageCircle, RotateCw, Undo2, UserRound } from 'lucide-react';
import { useAdminData, useDebounced, useModeration } from '../admin-hooks';
import { ConfirmDialog, type ConfirmRequest } from '../confirm-dialog';
import { AdminPhoto, ago, EmptyState, ErrorBox, Pager, Pill, Skeleton, UserMark } from '../admin-ui';
import { LiveDot, SearchField, SectionHeader, useDrawers } from '../section-kit';

function OnlineCard({ u }: { u: AdminUser }) {
  const { openUser } = useDrawers();
  const [, setLocation] = useLocation();
  const { run, pending } = useModeration();
  const [req, setReq] = useState<ConfirmRequest | null>(null);
  const btn = 'inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border text-[11px] font-bold disabled:opacity-40';
  return <li className="a-panel a-fade flex flex-col p-4" data-testid={`card-online-${u.id}`}>
    <div className="flex items-center gap-3">
      <span className="relative">{u.photos[0] ? <AdminPhoto reference={u.photos[0]} alt="" className="h-12 w-12 rounded-full" /> : <UserMark name={u.name} size={48} />}<span className="a-pulse absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[var(--a-panel)] bg-[var(--a-mint)]" /></span>
      <div className="min-w-0 flex-1"><div className="truncate font-bold">{u.name} <span className="mono text-xs font-normal text-[var(--a-mute)]">{u.age}</span></div><div className="truncate text-xs text-[var(--a-mute)]">{u.city || 'No city'} · seen {ago(u.lastSeenAt)}</div></div>
      {u.suspended && <Pill tone="red">Suspended</Pill>}
      {u.deactivated && <Pill tone="amber">Deactivated</Pill>}
    </div>
    <div className="mt-4 flex gap-2">
      <button type="button" onClick={() => openUser(u.id)} data-testid={`button-online-profile-${u.id}`} className={`${btn} border-[var(--a-line)] hover:bg-white/5`}><UserRound size={12} />Profile</button>
      <button type="button" onClick={() => setLocation(`/admin/chats?userId=${encodeURIComponent(u.id)}`)} data-testid={`button-online-chats-${u.id}`} className={`${btn} border-[var(--a-line)] hover:bg-white/5`}><MessageCircle size={12} />Chats</button>
      {u.suspended
        ? <button type="button" disabled={pending} onClick={() => void run('unblock', u.id)} data-testid={`button-online-unblock-${u.id}`} className={`${btn} border-[#7fd6b0]/30 text-[#9fe6c6]`}><Undo2 size={12} />Unblock</button>
        : <button type="button" disabled={pending} onClick={() => setReq({ title: `Block ${u.name}?`, detail: 'They lose access to discovery and messaging until unblocked.', confirmLabel: 'Block member', tone: 'neutral', onConfirm: () => run('block', u.id) })} data-testid={`button-online-block-${u.id}`} className={`${btn} border-[#f2b766]/30 text-[#f6c987]`}><Ban size={12} />Block</button>}
    </div>
    <ConfirmDialog req={req} onClose={() => setReq(null)} />
  </li>;
}

export function OnlineSection() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounced(q.trim());
  useEffect(() => setPage(1), [dq]);
  const r = useAdminData({ section: 'online', q: dq, page }, { poll: 10_000 });
  const d = r.data;
  return <div>
    <SectionHeader eyebrow="Online" title="Online right now" detail="Members with an active app heartbeat. Refreshes every 10 seconds." right={<div className="flex flex-wrap items-center gap-2">
      <LiveDot fetching={r.isFetching} label={r.isError ? 'Stale' : d ? `${d.total} online` : 'Live'} />
      {d && <span className="text-xs text-[var(--a-mute)]" data-testid="text-online-updated">Updated {new Date(r.dataUpdatedAt).toLocaleTimeString()}</span>}
      <button type="button" onClick={() => void r.refetch()} disabled={r.isFetching} data-testid="button-refresh-online" className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--a-line)] px-3 text-xs font-bold disabled:opacity-50"><RotateCw size={13} className={r.isFetching ? 'animate-spin' : ''} />Refresh</button>
    </div>} />
    <div className="mb-4 flex"><SearchField value={q} onChange={setQ} placeholder="Filter online members" testId="input-search-online" /></div>
    {r.isError && d && <div className="a-panel mb-3"><ErrorBox error={r.error} onRetry={() => void r.refetch()} text="Presence data may be out of date." /></div>}
    {r.isError && !d ? <div className="a-panel"><ErrorBox error={r.error} onRetry={() => void r.refetch()} text="Presence could not load." /></div> :
      !d ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <div key={i} className="a-skel h-[124px]" />)}</div> :
      d.users.length === 0 ? <div className="a-panel"><EmptyState title="Nobody online" detail={dq ? 'No online member matches that name.' : 'When members open VibeSwipes they appear here within seconds.'} /></div> :
      <>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{d.users.map(u => <OnlineCard key={u.id} u={u} />)}</ul>
        {d.total > d.pageSize && <div className="a-panel mt-3 overflow-hidden"><Pager page={page} total={d.total} pageSize={d.pageSize} onPage={setPage} testId="pager-online" /></div>}
      </>}
  </div>;
}
