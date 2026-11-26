export function FetchError({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div role="alert" data-testid="fetch-error" className="mx-auto max-w-sm rounded-[26px] border border-white/10 bg-card px-6 py-10 text-center">
      <p className="text-sm leading-6 text-muted-foreground">{text}</p>
      <button type="button" onClick={onRetry} className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Retry</button>
    </div>
  );
}

export function FetchErrorBanner({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div role="alert" data-testid="fetch-error-banner" className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-card px-4 py-3 text-sm">
      <p className="min-w-0 text-muted-foreground">{text}</p>
      <button type="button" onClick={onRetry} className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Retry</button>
    </div>
  );
}
