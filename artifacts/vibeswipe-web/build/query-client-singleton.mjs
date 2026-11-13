/**
 * Workspace packages can resolve different peer-specific copies of React Query.
 * Separate QueryClientContexts crash generated hooks despite a root provider.
 */
export function queryClientSingletonGuard() {
  return {
    name: 'query-client-singleton',
    generateBundle() {
      const providers = [...this.getModuleIds()].filter((id) =>
        /\/@tanstack\/react-query\/build\/[^/]+\/QueryClientProvider\.[cm]?js$/.test(id),
      );
      if (providers.length > 1) {
        this.error(
          'Multiple React Query providers were bundled. Keep @tanstack/react-query in resolve.dedupe so app and workspace hooks share one context.',
        );
      }
    },
  };
}
