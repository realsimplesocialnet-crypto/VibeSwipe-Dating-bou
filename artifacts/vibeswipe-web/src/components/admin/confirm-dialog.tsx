import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

export type ConfirmRequest = {
  title: string;
  detail: string;
  confirmLabel: string;
  /** When set, the admin must type this exact word. It is sent to the API as `confirmation`. */
  word?: 'DELETE' | 'REMOVE';
  tone?: 'danger' | 'neutral';
  onConfirm: (confirmation?: string) => Promise<boolean | void>;
};

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
