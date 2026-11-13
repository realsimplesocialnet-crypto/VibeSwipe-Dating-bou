import { Component, useEffect, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGetMyProfile } from '@workspace/api-client-react';

// A production-bundled integration probe. No Clerk session or API data is used.
// This is deliberately the same provider/import boundary as the signed-in app.
class ProbeBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }

  render() {
    return this.state.error
      ? <p data-testid="query-context-result" data-status="failed">{this.state.error}</p>
      : this.props.children;
  }
}

function GeneratedProfileHook() {
  const profile = useGetMyProfile({ query: { enabled: false } });
  useEffect(() => {
    document.documentElement.dataset.queryContext = 'ready';
  }, []);
  return <p data-testid="query-context-result" data-status="ready">
    Shared query context ready: {profile.fetchStatus}
  </p>;
}

const client = new QueryClient();
createRoot(document.getElementById('root')!).render(
  <ProbeBoundary>
    <QueryClientProvider client={client}>
      <GeneratedProfileHook/>
    </QueryClientProvider>
  </ProbeBoundary>,
);
