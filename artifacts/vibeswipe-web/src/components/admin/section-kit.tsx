import { createContext, type ReactNode, useContext } from 'react';
import { CalendarRange, Search, X } from 'lucide-react';

/** Lets any section or drawer open the user/chat detail drawers. */
export type DrawerApi = { openUser: (id: string) => void; openChat: (id: string) => void; closeAll: () => void };
export const DrawerCtx = createContext<DrawerApi>({ openUser: () => {}, openChat: () => {}, closeAll: () => {} });
export const useDrawers = () => useContext(DrawerCtx);

export function SectionHeader({ eyebrow, title, detail, right }: { eyebrow: string; title: string; detail?: ReactNode; right?: ReactNode }) {
  return <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[.24em] text-[var(--a-rose)]">{eyebrow}</div>
      <h1 className="brand mt-1.5 text-[28px] font-extrabold leading-tight md:text-[34px]">{title}</h1>
      {detail && <p className="mt-1 max-w-2xl text-sm text-[var(--a-mute)]">{detail}</p>}
    </div>
    {right}
  </div>;
}

export function SearchField({ value, onChange, placeholder, testId }: { value: string; onChange: (v: string) => void; placeholder: string; testId: string }) {
  return <label className="relative flex min-w-0 flex-1 items-center">
    <Search size={15} className="pointer-events-none absolute left-3 text-[var(--a-mute)]" />
    <input value={value} onChange={e => onChange(e.target.value)} maxLength={150} placeholder={placeholder} data-testid={testId} className="h-10 w-full rounded-xl border border-[var(--a-line)] bg-[var(--a-bg)] pl-9 pr-9 text-sm outline-none placeholder:text-[var(--a-mute)] focus:border-white/55" />
    {value && <button type="button" aria-label="Clear search" onClick={() => onChange('')} data-testid={`${testId}-clear`} className="absolute right-2 grid h-6 w-6 place-items-center rounded-md text-[var(--a-mute)] hover:bg-white/5"><X size={13} /></button>}
  </label>;
}

const today = () => new Date().toISOString().slice(0, 10);
export function DateRange({ from, to, onChange, testId }: { from: string; to: string; onChange: (from: string, to: string) => void; testId: string }) {
  const t = today();
  const btn = 'h-10 rounded-xl border px-3 text-xs font-bold transition-colors';
  const isToday = from === t && to === t;
  return <div className="flex flex-wrap items-center gap-2">
    <button type="button" onClick={() => onChange(t, t)} data-testid={`${testId}-today`} className={`${btn} ${isToday ? 'border-white/45 bg-white/[.08] text-white' : 'border-[var(--a-line)] hover:bg-white/5'}`}>Today (UTC)</button>
    <div className="flex h-10 items-center gap-1.5 rounded-xl border border-[var(--a-line)] bg-[var(--a-bg)] px-2.5">
      <CalendarRange size={14} className="text-[var(--a-mute)]" />
      <input type="date" value={from} max={to || undefined} onChange={e => onChange(e.target.value, to)} aria-label="From date" data-testid={`${testId}-from`} className="mono w-[118px] bg-transparent text-xs outline-none" />
      <span className="text-[var(--a-mute)]">to</span>
      <input type="date" value={to} min={from || undefined} onChange={e => onChange(from, e.target.value)} aria-label="To date" data-testid={`${testId}-to`} className="mono w-[118px] bg-transparent text-xs outline-none" />
    </div>
    {(from || to) && <button type="button" onClick={() => onChange('', '')} data-testid={`${testId}-clear`} className="h-10 px-2 text-xs font-bold text-[var(--a-mute)] hover:text-[var(--a-ink)]">Clear dates</button>}
  </div>;
}

export function Stat({ label, value, hint, tone = 'ink', testId }: { label: string; value: ReactNode; hint?: string; tone?: 'ink' | 'rose' | 'mint' | 'amber'; testId: string }) {
  const c = { ink: 'text-[var(--a-ink)]', rose: 'text-white', mint: 'text-[#9fe6c6]', amber: 'text-[#f6c987]' }[tone];
  return <div className="a-panel a-fade p-4 md:p-5" data-testid={testId}>
    <div className="text-[11px] font-bold uppercase tracking-[.14em] text-[var(--a-mute)]">{label}</div>
    <div className={`mono mt-2 text-[28px] font-bold leading-none tabular-nums md:text-[34px] ${c}`}>{value}</div>
    {hint && <div className="mt-2 text-xs text-[var(--a-mute)]">{hint}</div>}
  </div>;
}

/** Thin refetch indicator so polling never feels like a reload. */
export function LiveDot({ fetching, label = 'Live' }: { fetching: boolean; label?: string }) {
  return <span className="inline-flex items-center gap-2 rounded-full border border-[var(--a-line)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.12em] text-[var(--a-mute)]" data-testid="status-live">
    <span className={`h-2 w-2 rounded-full ${fetching ? 'bg-[var(--a-amber)]' : 'a-pulse bg-[var(--a-mint)]'}`} />{fetching ? 'Syncing' : label}
  </span>;
}
