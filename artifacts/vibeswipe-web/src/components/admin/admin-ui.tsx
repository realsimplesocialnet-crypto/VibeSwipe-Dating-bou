import { type ReactNode, useEffect, useState } from 'react';
import { getAdminMedia } from '@workspace/api-client-react';
import { AlertTriangle, ChevronLeft, ChevronRight, ImageIcon, RotateCw, X } from 'lucide-react';
import { userErrorMessage } from '@/lib/user-errors';

export const PAGE_SIZE = 25;
export const PRESENCE_SECONDS = 45;

export function errorStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error && typeof (error as { status: unknown }).status === 'number') return (error as { status: number }).status;
  return undefined;
}
export function adminError(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'data' in error) {
    const d = (error as { data: unknown }).data;
    if (d && typeof d === 'object' && 'error' in d && typeof (d as { error: unknown }).error === 'string') return (d as { error: string }).error;
    if (d && typeof d === 'object' && 'message' in d && typeof (d as { message: unknown }).message === 'string') return (d as { message: string }).message;
  }
  return userErrorMessage(error, fallback);
}

const pad = (n: number) => String(n).padStart(2, '0');
export function utc(iso?: string | null, withTime = true) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const day = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return withTime ? `${day} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC` : day;
}
export function ago(iso?: string | null) {
  if (!iso) return 'never';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
export const initials = (name?: string) => (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?';

export function Pill({ tone = 'mute', children }: { tone?: 'mute' | 'rose' | 'mint' | 'amber' | 'red'; children: ReactNode }) {
  const map = {
    mute: 'border-white/10 text-[#b9adb6]', rose: 'border-[#f34e9a]/35 bg-[#f34e9a]/10 text-[#ff8cc0]',
    mint: 'border-[#7fd6b0]/30 bg-[#7fd6b0]/10 text-[#9fe6c6]', amber: 'border-[#f2b766]/30 bg-[#f2b766]/10 text-[#f6c987]', red: 'border-[#f06b76]/35 bg-[#f06b76]/10 text-[#ff9aa3]',
  };
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[.08em] ${map[tone]}`}>{children}</span>;
}

export function Skeleton({ rows = 6 }: { rows?: number }) {
  return <div className="space-y-2 p-4" aria-label="Loading">{Array.from({ length: rows }, (_, i) => <div key={i} className="a-skel h-12" style={{ opacity: 1 - i * .1 }} />)}</div>;
}

export function ErrorBox({ error, onRetry, text }: { error: unknown; onRetry: () => void; text: string }) {
  return <div role="alert" className="m-4 flex flex-col items-start gap-3 rounded-2xl border border-[#f06b76]/25 bg-[#f06b76]/[.06] p-5 sm:flex-row sm:items-center">
    <AlertTriangle size={18} className="shrink-0 text-[#ff9aa3]" />
    <p className="flex-1 text-sm text-[#f3d6da]">{adminError(error, text)}</p>
    <button type="button" onClick={onRetry} data-testid="button-admin-retry" className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/5"><RotateCw size={13} />Retry</button>
  </div>;
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="px-6 py-16 text-center">
    <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-dashed border-[#f34e9a]/35 text-[#f34e9a] mono text-xs">0</div>
    <div className="font-bold">{title}</div>
    <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--a-mute)]">{detail}</p>
  </div>;
}

export function Pager({ page, total, pageSize = PAGE_SIZE, onPage, testId = 'pager' }: { page: number; total: number; pageSize?: number; onPage: (p: number) => void; testId?: string }) {
  const pages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  return <div className="flex items-center justify-between gap-3 border-t border-[var(--a-line)] px-4 py-3 text-xs text-[var(--a-mute)]" data-testid={testId}>
    <span className="mono">{start}–{end} of {total.toLocaleString()}</span>
    <div className="flex items-center gap-1">
      <button type="button" aria-label="Previous page" data-testid={`${testId}-prev`} disabled={page <= 1} onClick={() => onPage(page - 1)} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 disabled:opacity-30 hover:bg-white/5"><ChevronLeft size={15} /></button>
      <span className="mono px-2">{page}/{pages}</span>
      <button type="button" aria-label="Next page" data-testid={`${testId}-next`} disabled={page >= pages} onClick={() => onPage(page + 1)} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 disabled:opacity-30 hover:bg-white/5"><ChevronRight size={15} /></button>
    </div>
  </div>;
}

export function mediaIdOf(ref?: string | null) {
  if (!ref) return '';
  if (ref.startsWith('media:')) return ref.slice(6);
  if (ref.startsWith('http') || ref.startsWith('demo:') || ref.startsWith('/')) return '';
  return ref;
}

/** Fetches media through the admin-only endpoint and revokes the object URL on change/unmount. */
export function useAdminObjectUrl(mediaId: string, enabled: boolean) {
  const [state, setState] = useState<{ url: string; type: string; error: unknown; loading: boolean }>({ url: '', type: '', error: null, loading: false });
  useEffect(() => {
    if (!enabled || !mediaId) return;
    let url = ''; let alive = true;
    setState({ url: '', type: '', error: null, loading: true });
    getAdminMedia(mediaId).then(blob => {
      if (!alive) return;
      url = URL.createObjectURL(blob);
      setState({ url, type: blob.type, error: null, loading: false });
    }).catch(error => { if (alive) setState({ url: '', type: '', error, loading: false }); });
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [mediaId, enabled]);
  return state;
}

export function AdminPhoto({ reference, alt, className }: { reference: string; alt: string; className: string }) {
  const id = mediaIdOf(reference);
  const external = reference.startsWith('http') ? reference : '';
  const media = useAdminObjectUrl(id, !!id);
  const src = id ? media.url : external;
  if (media.loading) return <div className={`a-skel ${className}`} />;
  if (!src) return <div className={`grid place-items-center bg-[var(--a-raise)] text-[var(--a-mute)] ${className}`}><ImageIcon size={18} /></div>;
  return <img src={src} alt={alt} className={`object-cover ${className}`} />;
}

export function UserMark({ name, online, size = 36 }: { name: string; online?: boolean; size?: number }) {
  return <span className="relative inline-grid shrink-0 place-items-center rounded-full bg-[linear-gradient(145deg,#6d3253,#2c2131)] text-[11px] font-bold text-[#ffd3e6] ring-1 ring-white/10" style={{ width: size, height: size }}>
    {initials(name)}
    {online && <span className="a-pulse absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--a-panel)] bg-[#7fd6b0]" />}
  </span>;
}

export function DrawerShell({ title, eyebrow, onClose, children, testId }: { title: ReactNode; eyebrow: string; onClose: () => void; children: ReactNode; testId: string }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRefSafe(onClose); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  return <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" data-testid={testId}>
    <button type="button" aria-label="Close panel" onClick={onClose} className="absolute inset-0 bg-[#0b090d]/70 backdrop-blur-[2px]" data-testid={`${testId}-backdrop`} />
    <aside className="a-drawer relative flex h-full w-full max-w-[640px] flex-col border-l border-[var(--a-line)] bg-[var(--a-bg)]">
      <header className="flex items-start justify-between gap-3 border-b border-[var(--a-line)] px-5 py-4">
        <div className="min-w-0"><div className="text-[10px] font-bold uppercase tracking-[.22em] text-[var(--a-rose)]">{eyebrow}</div><div className="mt-1 truncate text-xl font-extrabold tracking-[-.03em]">{title}</div></div>
        <button type="button" onClick={onClose} aria-label="Close" data-testid={`${testId}-close`} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 hover:bg-white/5"><X size={16} /></button>
      </header>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </aside>
  </div>;
}
function onCloseRefSafe(fn: () => void) { fn(); }
