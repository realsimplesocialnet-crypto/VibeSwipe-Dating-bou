import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { keepPreviousData, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  getAdminChatExport, getGetAdminDashboardQueryKey, useAdminModerationAction, useGetAdminDashboard,
  type AdminModerationInputAction, type GetAdminChatExportFormat, type GetAdminDashboardParams,
} from '@workspace/api-client-react';
import { Check, AlertTriangle } from 'lucide-react';
import { adminError } from './admin-ui';

/** Strip empty values so query keys stay stable and the URL stays clean. */
export function cleanParams(p: GetAdminDashboardParams): GetAdminDashboardParams {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== '' && v !== null) out[k] = v;
  return out as GetAdminDashboardParams;
}

export function useAdminData(params: GetAdminDashboardParams, opts: { poll?: number; enabled?: boolean } = {}) {
  const clean = cleanParams(params);
  return useGetAdminDashboard(clean, {
    query: {
      queryKey: getGetAdminDashboardQueryKey(clean),
      refetchInterval: opts.poll,
      refetchIntervalInBackground: false,
      placeholderData: keepPreviousData,
      enabled: opts.enabled ?? true,
      retry: 1,
    },
  });
}

export const isAdminQuery = (key: readonly unknown[]) => typeof key[0] === 'string' && key[0].startsWith('/api/vibeswipe/admin');
export function invalidateAdmin(qc: QueryClient) { return qc.invalidateQueries({ predicate: q => isAdminQuery(q.queryKey) }); }
export function clearAdmin(qc: QueryClient) { qc.removeQueries({ predicate: q => isAdminQuery(q.queryKey) }); }

/** Debounced value via ref-based timer. */
export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  const t = useRef<number | undefined>(undefined);
  useEffect(() => { window.clearTimeout(t.current); t.current = window.setTimeout(() => setV(value), ms); return () => window.clearTimeout(t.current); }, [value, ms]);
  return v;
}

/* ---------- toasts ---------- */
type Toast = { id: number; tone: 'ok' | 'err'; text: string };
const ToastCtx = createContext<(tone: Toast['tone'], text: string) => void>(() => {});
export function AdminToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((tone: Toast['tone'], text: string) => {
    const id = Date.now() + Math.random();
    setItems(s => [...s.slice(-2), { id, tone, text }]);
    window.setTimeout(() => setItems(s => s.filter(t => t.id !== id)), 4600);
  }, []);
  return <ToastCtx.Provider value={push}>{children}
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6" aria-live="polite">
      {items.map(t => <div key={t.id} role="status" data-testid="status-admin-toast" className={`a-fade pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-semibold shadow-2xl ${t.tone === 'ok' ? 'border-[#7fd6b0]/30 bg-[#1b2622] text-[#c9f1de]' : 'border-[#f06b76]/35 bg-[#2a1a1e] text-[#ffd0d5]'}`}>
        {t.tone === 'ok' ? <Check size={15} /> : <AlertTriangle size={15} />}{t.text}
      </div>)}
    </div>
  </ToastCtx.Provider>;
}
export const useAdminToast = () => useContext(ToastCtx);

/* ---------- moderation ---------- */
export const CONFIRM_WORD: Partial<Record<AdminModerationInputAction, 'DELETE' | 'REMOVE'>> = {
  delete_user: 'DELETE', delete_chat: 'DELETE', delete_message: 'DELETE', remove_connection: 'REMOVE',
};

export function useModeration() {
  const qc = useQueryClient();
  const toast = useAdminToast();
  const m = useAdminModerationAction();
  const mutateRef = useRef(m.mutateAsync);
  mutateRef.current = m.mutateAsync;
  const run = useCallback(async (action: AdminModerationInputAction, targetId: string, confirmation?: string) => {
    try {
      const res = await mutateRef.current({ data: { action, targetId, ...(confirmation ? { confirmation } : {}) } });
      toast('ok', res.message || 'Done.');
      await invalidateAdmin(qc);
      return true;
    } catch (e) {
      toast('err', adminError(e, 'That action did not go through. Nothing was changed.'));
      return false;
    }
  }, [qc, toast]);
  return { run, pending: m.isPending };
}

export async function downloadChatExport(chatId: string, format: GetAdminChatExportFormat, from?: string, to?: string) {
  const res = await getAdminChatExport({ chatId, format, ...(from ? { from } : {}), ...(to ? { to } : {}) });
  const blob = new Blob([res.content], { type: res.mimeType || (format === 'json' ? 'application/json' : 'text/plain') });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = res.filename || `chat-${chatId}.${format}`;
  document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  return res.filename;
}
