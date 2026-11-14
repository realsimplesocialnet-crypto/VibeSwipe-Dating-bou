import { useEffect, useState } from 'react';

export function ConnectionNotice() {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  if (!offline) return null;
  return <div role="alert" data-testid="notice-offline" className="sticky top-0 z-[100] border-b border-amber-200/15 bg-[#30251b] px-5 py-3 text-center text-xs leading-5 text-amber-100">
    You’re offline. Reconnect to save changes, upload photos, and send messages.
  </div>;
}
