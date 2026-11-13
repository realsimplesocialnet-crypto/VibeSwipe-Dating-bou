import assert from 'node:assert/strict';
import test from 'node:test';
import { queryClientSingletonGuard } from '../build/query-client-singleton.mjs';

const provider = (peer) =>
  `/workspace/node_modules/.pnpm/react-query_${peer}/node_modules/@tanstack/react-query/build/modern/QueryClientProvider.js`;

function check(ids) {
  queryClientSingletonGuard().generateBundle.call({
    getModuleIds: () => ids.values(),
    error: (message) => { throw new Error(message); },
  });
}

test('production build accepts a single shared query provider', () => {
  assert.doesNotThrow(() => check([provider('react19.1'), '/src/App.tsx']));
});

test('production build rejects providers from different React peer copies', () => {
  assert.throws(
    () => check([provider('react19.1'), provider('react19.3')]),
    /Multiple React Query providers were bundled/,
  );
});

test('unrelated query utilities do not count as provider modules', () => {
  assert.doesNotThrow(() => check([
    provider('react19.1'),
    '/node_modules/@tanstack/query-core/build/modern/queryClient.js',
  ]));
});
