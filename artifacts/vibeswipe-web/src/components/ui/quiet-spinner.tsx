import { useEffect, useRef } from 'react';

type QuietSpinnerProps = {
  onRetry?: () => unknown;
  className?: string;
  size?: number;
};

export function QuietSpinner({ onRetry, className = '', size = 24 }: QuietSpinnerProps) {
  const retryRef = useRef(onRetry);
  useEffect(() => {
    retryRef.current = onRetry;
  }, [onRetry]);

  useEffect(() => {
    if (!onRetry) return;
    let active = true;
    let timer = 0;
    let retryAttempt = 0;
    const retryNow = () => {
      if (!active || !navigator.onLine) return;
      try {
        const result = retryRef.current?.();
        if (result && typeof result === 'object' && 'catch' in result) {
          void (result as Promise<unknown>).catch(() => undefined);
        }
      } catch {
        // Keep the loading indicator quiet; the next retry can recover.
      }
    };
    const schedule = () => {
      const delay = Math.min(2000 * 2 ** retryAttempt, 30_000);
      retryAttempt = Math.min(retryAttempt + 1, 4);
      timer = window.setTimeout(() => {
        retryNow();
        schedule();
      }, delay);
    };
    const retry = () => {
      if (!active) return;
      retryNow();
      schedule();
    };
    timer = window.setTimeout(retry, 1000);
    const onOnline = () => {
      window.clearTimeout(timer);
      retryAttempt = 0;
      retryNow();
      schedule();
    };
    window.addEventListener('online', onOnline);
    return () => {
      active = false;
      window.clearTimeout(timer);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  return (
    <span
      role="status"
      aria-label="Loading"
      className={`quiet-spinner ${className}`}
      style={{ width: size, height: size }}
    >
      <span className="quiet-spinner-dot quiet-spinner-dot-first" />
      <span className="quiet-spinner-dot quiet-spinner-dot-second" />
    </span>
  );
}
