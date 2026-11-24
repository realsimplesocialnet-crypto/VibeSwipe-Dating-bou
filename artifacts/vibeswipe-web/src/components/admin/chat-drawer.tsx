import { useEffect, useState } from 'react';
import type { AdminMessage, GetAdminChatExportFormat } from '@workspace/api-client-react';
import { Download, ImageIcon, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { downloadChatExport, useAdminData, useAdminToast, useModeration } from './admin-hooks';
import { adminError, DrawerShell, EmptyState, ErrorBox, mediaIdOf, Pager, Skeleton, useAdminObjectUrl, utc } from './admin-ui';
import { ConfirmDialog, type ConfirmRequest } from './confirm-dialog';
import { DateRange, useDrawers } from './section-kit';

function MessageMedia({ m }: { m: AdminMessage }) {
  const [show, setShow] = useState(false);
  const id = mediaIdOf(m.mediaReference);
  const media = useAdminObjectUrl(id, show && !!id);
  if (!id) return null;
  if (!show) return <button type="button" onClick={() => setShow(true)} data-testid={`button-load-media-${m.id}`} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-bold hover:bg-white/5"><ImageIcon size={12} />Load {m.mediaType || 'media'}</button>;
  if (media.loading || (!media.url && !media.error)) return <div className="a-skel mt-2 h-32 w-48" aria-label="Loading media" />;
  if (media.error || !media.url) return <div className="mt-2 flex items-center gap-2 text-xs text-[#ff9aa3]"><span>{adminError(media.error, 'Media unavailable.')}</span><button type="button" onClick={() => setShow(false)} className="rounded border border-white/10 px-2 py-1 font-bold hover:bg-white/5">Retry</button></div>;
  const t = media.type || m.mediaType || '';
  if (t.startsWith('video')) return <video src={media.url} controls className="mt-2 max-h-64 rounded-lg" />;
  if (t.startsWith('audio')) return <audio src={media.url} controls className="mt-2 w-full" />;
  return <img src={media.url} alt="Chat attachment" className="mt-2 max-h-64 rounded-lg" />;
}

export function ChatDrawer({ chatId, onClose }: { chatId: string; onClose: () => void }) {
  const { openUser } = useDrawers();
  const toast = useAdminToast();
  const { run, pending } = useModeration();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [openedChatId, setOpenedChatId] = useState('');
  const opened = openedChatId === chatId;
  const [format, setFormat] = useState<GetAdminChatExportFormat>('txt');
  const [exporting, setExporting] = useState(false);
  const [req, setReq] = useState<ConfirmRequest | null>(null);
  useEffect(() => setPage(1), [from, to]);
  const r = useAdminData({ section: 'chat', chatId, from, to, page }, { poll: 15_000, enabled: opened });
  const c = r.data?.selectedChat;
  async function exportRange() {
    if (!opened) return;
    setExporting(true);
    try { const name = await downloadChatExport(chatId, format, from || undefined, to || undefined); toast('ok', `Downloaded ${name}`); }
    catch (e) { toast('err', adminError(e, 'Export failed. Try again.')); }
    finally { setExporting(false); }
  }
  return <DrawerShell eyebrow="Conversation" title={!opened ? 'Restricted access' : c ? `${c.userAName} and ${c.userBName}` : r.isError ? 'Unavailable' : 'Loading'} onClose={onClose} testId="drawer-chat">
    {!opened ? <section className="m-5 rounded-2xl border border-[#f2b766]/25 bg-[#f2b766]/[.06] p-5" data-testid="chat-access-notice">
      <h2 className="font-bold">Restricted admin access</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--a-mute)]">Conversation contents and attachments are private. Opening this conversation will access its contents, and admin access is logged.</p>
      <button type="button" onClick={() => setOpenedChatId(chatId)} data-testid="button-acknowledge-chat-access" className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--a-rose)] px-4 py-2 text-sm font-extrabold text-black">I understand, open conversation</button>
    </section> :
      r.isError && !r.data ? <ErrorBox error={r.error} onRetry={() => void r.refetch()} text="This conversation could not load." /> :
      !r.data ? <><p className="px-5 pt-4 text-xs text-[var(--a-mute)]" role="status" aria-live="polite">Loading conversation contents…</p><Skeleton rows={8} /></> :
      !c ? <EmptyState title="Conversation not found" detail="It may have been deleted." /> :
      <div className="a-fade">
        {r.isError && <ErrorBox error={r.error} onRetry={() => void r.refetch()} text="Conversation refresh failed." />}
        <div className="space-y-3 border-b border-[var(--a-line)] p-5">
          <div className="flex items-center justify-between gap-3 text-xs text-[var(--a-mute)]" role="status" aria-live="polite">
            <span>{r.isFetching ? 'Refreshing conversation…' : 'Conversation loaded'}</span>
            <button type="button" disabled={r.isFetching} onClick={() => void r.refetch()} data-testid="button-refresh-chat" className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 font-bold hover:bg-white/5 disabled:opacity-50"><RefreshCw size={12} className={r.isFetching ? 'animate-spin' : ''} />Refresh</button>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button type="button" onClick={() => openUser(c.userAId)} data-testid="button-chat-open-user-a" className="rounded-lg border border-white/10 px-2.5 py-1 font-bold hover:bg-white/5">{c.userAName}</button>
            <button type="button" onClick={() => openUser(c.userBId)} data-testid="button-chat-open-user-b" className="rounded-lg border border-white/10 px-2.5 py-1 font-bold hover:bg-white/5">{c.userBName}</button>
            <span className="mono self-center text-[var(--a-mute)]">matched {utc(c.createdAt, false)} · {c.messageCount} messages</span>
          </div>
          <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} testId="filter-chat-range" />
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-10 overflow-hidden rounded-xl border border-[var(--a-line)]" role="radiogroup" aria-label="Export format">
              {(['txt', 'json'] as const).map(f => <button key={f} type="button" role="radio" aria-checked={format === f} onClick={() => setFormat(f)} data-testid={`button-export-format-${f}`} className={`mono px-3 text-xs font-bold uppercase ${format === f ? 'bg-white/[.08] text-white' : 'text-[var(--a-mute)]'}`}>{f}</button>)}
            </div>
            <button type="button" disabled={exporting} onClick={() => void exportRange()} data-testid="button-export-chat" className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--a-rose)] px-4 text-xs font-extrabold text-black disabled:opacity-50">{exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}Export {from || to ? 'range' : 'all'}</button>
            <button type="button" disabled={pending} onClick={() => setReq({ title: 'Delete this entire conversation?', detail: `All messages between ${c.userAName} and ${c.userBName} will be permanently removed for both members.`, confirmLabel: 'Delete chat', word: 'DELETE', onConfirm: async conf => { const ok = await run('delete_chat', c.id, conf); if (ok) onClose(); return ok; } })} data-testid="button-delete-chat" className="ml-auto inline-flex h-10 items-center gap-2 rounded-xl border border-[#f06b76]/30 px-3 text-xs font-bold text-[#ff9aa3] hover:bg-[#f06b76]/10 disabled:opacity-40"><Trash2 size={14} />Delete chat</button>
          </div>
        </div>
        {r.data.messages.length === 0 ? <EmptyState title="No messages" detail={from || to ? 'Nothing was sent in this date range.' : 'They matched but have not written yet.'} /> :
          <ol className={`space-y-1 p-4 transition-opacity ${r.isPlaceholderData ? 'opacity-50' : ''}`}>{r.data.messages.map(m => {
            const mine = m.senderId === c.userAId;
            return <li key={m.id} className={`group flex ${mine ? 'justify-start' : 'justify-end'}`} data-testid={`row-message-${m.id}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${m.deleted ? 'border border-dashed border-white/10 bg-transparent' : 'bg-[var(--a-raise)]'}`}>
                <div className="flex items-center gap-2 text-[11px] text-[var(--a-mute)]"><span className="font-bold text-[var(--a-ink)]">{m.senderName}</span><time className="mono">{utc(m.createdAt)}</time>
                  {!m.deleted && <button type="button" disabled={pending} aria-label="Delete message" onClick={() => setReq({ title: 'Delete this message?', detail: `"${(m.content || 'Attachment').slice(0, 120)}" will be removed for both members.`, confirmLabel: 'Delete message', word: 'DELETE', onConfirm: conf => run('delete_message', m.id, conf) })} data-testid={`button-delete-message-${m.id}`} className="ml-1 grid h-6 w-6 place-items-center rounded-md text-[#ff9aa3] opacity-60 hover:bg-[#f06b76]/10 hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"><Trash2 size={12} /></button>}
                </div>
                {m.deleted ? <p className="mt-1 text-sm italic text-[var(--a-mute)]">Message deleted</p> : <>
                  {m.content && <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{m.content}</p>}
                  <MessageMedia m={m} />
                </>}
              </div>
            </li>;
          })}</ol>}
        <Pager page={page} total={r.data.total} pageSize={r.data.pageSize} onPage={setPage} testId="pager-messages" />
      </div>}
    <ConfirmDialog req={req} onClose={() => setReq(null)} />
  </DrawerShell>;
}
