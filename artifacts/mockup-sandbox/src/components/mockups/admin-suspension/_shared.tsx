import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, BadgeCheck, Ban, Loader2, ShieldOff, Trash2, Undo2 } from 'lucide-react';
import './_group.css';

export type ConfirmRequest = {
  title: string;
  detail: string;
  confirmLabel: string;
  word?: 'DELETE' | 'REMOVE';
  tone?: 'danger' | 'neutral';
  onConfirm: (confirmation?: string) => Promise<boolean | void>;
};

export function Pill({ tone = 'mute', children }: { tone?: 'mute' | 'rose' | 'mint' | 'amber' | 'red'; children: ReactNode }) {
  const map = {
    mute: 'border-white/10 text-[#b9adb6]',
    rose: 'border-[#f34e9a]/35 bg-[#f34e9a]/10 text-[#ff8cc0]',
    mint: 'border-[#7fd6b0]/30 bg-[#7fd6b0]/10 text-[#9fe6c6]',
    amber: 'border-[#f2b766]/30 bg-[#f2b766]/10 text-[#f6c987]',
    red: 'border-[#f06b76]/35 bg-[#f06b76]/10 text-[#ff9aa3]',
  };
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[.08em] ${map[tone]}`}>{children}</span>;
}

export function ConfirmDialog({ req, onClose }: { req: ConfirmRequest | null; onClose: () => void }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { setTyped(''); setBusy(false); if (req?.word) window.setTimeout(() => input.current?.focus(), 40); }, [req]);
  useEffect(() => {
    if (!req) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [req, busy, onClose]);
  if (!req) return null;
  const danger = req.tone !== 'neutral';
  const ready = !req.word || typed === req.word;
  async function go() {
    if (!ready || busy || !req) return;
    setBusy(true);
    const ok = await req.onConfirm(req.word ? typed : undefined);
    setBusy(false);
    if (ok !== false) onClose();
  }
  return <div className="fixed inset-0 z-[60] grid place-items-end p-3 sm:place-items-center" role="alertdialog" aria-modal="true" aria-labelledby="admin-confirm-title" data-testid="dialog-admin-confirm">
    <button type="button" aria-label="Cancel" onClick={() => !busy && onClose()} className="absolute inset-0 bg-[#0b090d]/75 backdrop-blur-sm" />
    <form onSubmit={e => { e.preventDefault(); void go(); }} className="a-fade relative w-full max-w-[440px] overflow-hidden rounded-2xl border border-[var(--a-line)] bg-[var(--a-panel)] shadow-2xl">
      <div className={`h-1 ${danger ? 'bg-[var(--a-red)]' : 'bg-[var(--a-rose)]'}`} />
      <div className="p-6">
        <div className="flex gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${danger ? 'bg-[#f06b76]/12 text-[#ff9aa3]' : 'bg-[#f34e9a]/12 text-[#ff8cc0]'}`}><AlertTriangle size={18} /></span>
          <div><h2 id="admin-confirm-title" className="text-lg font-extrabold tracking-[-.02em]">{req.title}</h2><p className="mt-1.5 text-sm leading-6 text-[var(--a-mute)]">{req.detail}</p></div>
        </div>
        {req.word && <label className="mt-5 block">
          <span className="text-xs font-semibold text-[var(--a-mute)]">Type <span className="mono rounded bg-white/5 px-1.5 py-0.5 font-bold text-[var(--a-ink)]">{req.word}</span> to confirm</span>
          <input ref={input} value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" spellCheck={false} data-testid="input-admin-confirm" className="mono mt-2 h-11 w-full rounded-xl border border-[var(--a-line)] bg-[var(--a-bg)] px-3 text-sm tracking-[.15em] outline-none focus:border-[#f06b76]/60" />
        </label>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" disabled={busy} onClick={onClose} data-testid="button-admin-confirm-cancel" className="h-11 rounded-xl border border-white/10 px-4 text-sm font-bold hover:bg-white/5">Cancel</button>
          <button type="submit" disabled={!ready || busy} data-testid="button-admin-confirm" className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-extrabold transition-opacity disabled:opacity-35 ${danger ? 'bg-[var(--a-red)] text-[#2a0c10]' : 'bg-[var(--a-rose)] text-[#24111b]'}`}>
            {busy && <Loader2 size={15} className="animate-spin" />}{req.confirmLabel}
          </button>
        </div>
      </div>
    </form>
  </div>;
}

function UserActions({
  suspended,
  verified,
  onSuspendedChange,
  onVerifiedChange,
  initialConfirm = false,
}: {
  suspended: boolean;
  verified: boolean;
  onSuspendedChange: (suspended: boolean) => void;
  onVerifiedChange: (verified: boolean) => void;
  initialConfirm?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [req, setReq] = useState<ConfirmRequest | null>(() => initialConfirm ? {
    title: 'Block Sample Member?',
    detail: 'They will be signed out of discovery and cannot message matches until you unblock them. Their data stays intact.',
    confirmLabel: 'Block member',
    tone: 'neutral',
    onConfirm: async () => {
      setPending(true);
      onSuspendedChange(true);
      setPending(false);
      return true;
    },
  } : null);
  const base = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-colors disabled:opacity-40';
  return <>
    <div className="flex flex-wrap gap-2">
      {verified
        ? <button type="button" disabled={pending} onClick={() => onVerifiedChange(false)} className={`${base} border-[var(--a-line)] hover:bg-white/5`}><ShieldOff size={13} />Unverify</button>
        : <button type="button" disabled={pending} className={`${base} border-[var(--a-line)]`}><BadgeCheck size={13} className="text-[#ff8cc0]" />Review queue</button>}
      {suspended
        ? <button type="button" disabled={pending} onClick={() => onSuspendedChange(false)} className={`${base} border-[#7fd6b0]/30 text-[#9fe6c6] hover:bg-[#7fd6b0]/10`}><Undo2 size={13} />Unblock</button>
        : <button type="button" disabled={pending} onClick={() => setReq({ title: 'Block Sample Member?', detail: 'They will be signed out of discovery and cannot message matches until you unblock them. Their data stays intact.', confirmLabel: 'Block member', tone: 'neutral', onConfirm: async () => { setPending(true); onSuspendedChange(true); setPending(false); return true; } })} className={`${base} border-[#f2b766]/30 text-[#f6c987] hover:bg-[#f2b766]/10`}><Ban size={13} />Block</button>}
      <button type="button" disabled={pending} className={`${base} border-[#f06b76]/30 text-[#ff9aa3]`}><Trash2 size={13} />Delete</button>
    </div>
    <ConfirmDialog req={req} onClose={() => setReq(null)} />
  </>;
}

export function AdminPreviewShell({ children }: { children: ReactNode }) {
  return <main className="vs-admin min-h-screen px-5 py-6 sm:px-8 sm:py-8">
    <div className="mx-auto max-w-[1040px]">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-[#ff8cc0]">Admin console · Members</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-[-.04em]">Account moderation</h1>
        </div>
        <span className="rounded-full border border-[#f34e9a]/30 bg-[#f34e9a]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-[#ff8cc0]">Preview only</span>
      </header>
      {children}
    </div>
  </main>;
}

export function MemberCard({ suspended, initialConfirm = false }: { suspended: boolean; initialConfirm?: boolean }) {
  const [blocked, setBlocked] = useState(suspended);
  const [verified, setVerified] = useState(true);
  return <section className="a-panel overflow-hidden" aria-label="Sample member">
    <div className="a-row grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-3 px-4 py-4 sm:grid-cols-[auto_minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="relative grid h-12 w-12 place-items-center rounded-full border border-[#f34e9a]/30 bg-[#f34e9a]/10 text-sm font-extrabold text-[#ff8cc0]">
        SM
        {!blocked && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[var(--a-panel)] bg-[var(--a-mint)]" />}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-bold">Sample Member</span>
          <span className="mono text-xs text-[var(--a-mute)]">30</span>
          {blocked && <Pill tone="red">Suspended</Pill>}
          <Pill tone={verified ? 'rose' : 'mute'}>{verified ? 'Verified' : 'Unverified'}</Pill>
        </div>
        <div className="mt-1 truncate text-xs text-[var(--a-mute)]">sample member · Lagos, Nigeria</div>
      </div>
      <div className="col-span-2 flex gap-4 text-xs text-[var(--a-mute)] sm:col-span-1 sm:block">
        <div><span className="mono text-[var(--a-ink)]">3</span> matches</div>
        <div className="sm:mt-0.5">joined <span className="mono">2026-11-16</span></div>
      </div>
    </div>
    <div className="border-t border-[var(--a-line)] px-4 py-3">
      <UserActions suspended={blocked} verified={verified} onSuspendedChange={setBlocked} onVerifiedChange={setVerified} initialConfirm={initialConfirm} />
    </div>
  </section>;
}

export function PreviewNote({ children }: { children: ReactNode }) {
  return <p className="mt-4 rounded-xl border border-white/10 bg-white/[.025] px-4 py-3 text-xs leading-5 text-[var(--a-mute)]">{children}</p>;
}
