import { useEffect, useState } from 'react';
import type { AdminConnection } from '@workspace/api-client-react';
import { Info, Unlink } from 'lucide-react';
import { useAdminData, useDebounced, useModeration } from '../admin-hooks';
import { ConfirmDialog, type ConfirmRequest } from '../confirm-dialog';
import { EmptyState, ErrorBox, Pager, Pill, Skeleton, utc } from '../admin-ui';
import { LiveDot, SearchField, SectionHeader, useDrawers } from '../section-kit';

const STATUS = {
  mutual: { label: 'Mutual match', tone: 'rose' as const, arrow: 'and' },
  pending_like: { label: 'Pending like', tone: 'mute' as const, arrow: 'liked' },
  pending_super_like: { label: 'Pending super like', tone: 'amber' as const, arrow: 'super liked' },
};

export function ConnectionRow({ c }: { c: AdminConnection }) {
  const { openUser } = useDrawers();
  const { run, pending } = useModeration();
  const [req, setReq] = useState<ConfirmRequest | null>(null);
  const s = STATUS[c.status];
  const nameBtn = (id: string, name: string) => <button type="button" onClick={() => openUser(id)} data-testid={`button-open-user-${c.id}-${id}`} className="font-bold hover:text-[#ff8cc0]">{name}</button>;
  return <li className="a-row flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3" data-testid={`row-connection-${c.id}`}>
    <div className="min-w-0 flex-1">
      <div className="text-sm">{nameBtn(c.userAId, c.userAName)} <span className="text-[var(--a-mute)]">{s.arrow}</span> {nameBtn(c.userBId, c.userBName)}</div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--a-mute)]"><Pill tone={s.tone}>{s.label}</Pill><span className="mono">{utc(c.createdAt)}</span>{c.mutualCount > 0 && <span><span className="mono text-[var(--a-ink)]">{c.mutualCount}</span> shared matches</span>}</div>
    </div>
    <button type="button" disabled={pending} onClick={() => setReq({
      title: c.status === 'mutual' ? 'Remove this match?' : 'Remove this like?',
      detail: c.status === 'mutual' ? `${c.userAName} and ${c.userBName} will be unmatched and their conversation will close for both.` : `The like from ${c.userAName} to ${c.userBName} will be withdrawn.`,
      confirmLabel: 'Remove', word: 'REMOVE', onConfirm: conf => run('remove_connection', c.id, conf),
    })} data-testid={`button-remove-connection-${c.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#f06b76]/30 px-2.5 text-[11px] font-bold text-[#ff9aa3] hover:bg-[#f06b76]/10 disabled:opacity-40"><Unlink size={12} />Remove</button>
    <ConfirmDialog req={req} onClose={() => setReq(null)} />
  </li>;
}

export function ConnectionsSection() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounced(q.trim());
  useEffect(() => setPage(1), [dq]);
  const r = useAdminData({ section: 'connections', q: dq, page }, { poll: 30_000 });
  const d = r.data;
  return <div>
    <SectionHeader eyebrow="Friends / Connections" title="Matches and likes" right={<LiveDot fetching={r.isFetching} />} />
    <div className="mb-4 flex gap-3 rounded-xl border border-[var(--a-line)] bg-[var(--a-panel)] p-4 text-sm leading-6 text-[var(--a-mute)]" data-testid="text-connections-explainer">
      <Info size={16} className="mt-1 shrink-0 text-[var(--a-rose)]" />
      <p>VibeSwipe has no friend-request system. A <span className="font-bold text-[var(--a-ink)]">mutual match</span> is two members liking each other, which opens a chat. A <span className="font-bold text-[var(--a-ink)]">pending like</span> is one-way and has not been returned yet.</p>
    </div>
    <div className="a-panel overflow-hidden">
      <div className="flex items-center gap-3 border-b border-[var(--a-line)] p-3">
        <SearchField value={q} onChange={setQ} placeholder="Search by member name" testId="input-search-connections" />
        {d && <span className="mono text-xs text-[var(--a-mute)]">{d.total.toLocaleString()}</span>}
      </div>
      {r.isError && !d ? <ErrorBox error={r.error} onRetry={() => void r.refetch()} text="Connections could not load." /> :
        !d ? <Skeleton rows={8} /> :
        d.connections.length === 0 ? <EmptyState title="No matches or likes" detail={dq ? `Nothing found for "${dq}".` : 'Likes and matches show up as members start swiping.'} /> :
        <ul className={`divide-y divide-[var(--a-line)] transition-opacity ${r.isPlaceholderData ? 'opacity-50' : ''}`}>{d.connections.map(c => <ConnectionRow key={c.id} c={c} />)}</ul>}
      {d && <Pager page={page} total={d.total} pageSize={d.pageSize} onPage={setPage} testId="pager-connections" />}
    </div>
  </div>;
}
