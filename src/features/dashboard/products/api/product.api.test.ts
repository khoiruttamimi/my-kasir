import { expect, test } from '@jest/globals';
import { loadSource } from '../../../../../tests/helpers/load-source';
import { id } from '../../../../../tests/helpers/product-fixture';

test('list requests encode cashier search mode only when the caller opts in', async () => {
  const urls: string[] = [];
  const api = loadSource<typeof import('@/features/dashboard/products/api/product.api')>(
    'src/features/dashboard/products/api/product.api.ts',
    {
      '@/utils/api': {
        fetcher: async (url: string) => {
          urls.push(url);
          return { data: [] };
        },
      },
    },
  );
  const params = { page: 2, limit: 24, search: '001%_' };
  await api.getProducts(params);
  await api.getProducts({ ...params, searchMode: 'name-or-code' });
  const legacy = new URL(urls[0], 'https://example.test');
  const cashier = new URL(urls[1], 'https://example.test');
  expect(legacy.pathname).toBe('/api/products');
  expect(cashier.pathname).toBe(legacy.pathname);
  expect(Object.fromEntries(legacy.searchParams)).toEqual({ page: '2', limit: '24', search: '001%_' });
  expect(Object.fromEntries(cashier.searchParams)).toEqual({
    page: '2',
    limit: '24',
    search: '001%_',
    searchMode: 'name-or-code',
  });
});

test('client partial edits omit unspecified code/timestamps and generation has no save cache side effects', async () => {
  const requests: { url: string; init: RequestInit }[] = [],
    invalidations: unknown[][] = [];
  const api = loadSource<typeof import('@/features/dashboard/products/api/product.api')>(
    'src/features/dashboard/products/api/product.api.ts',
    {
      '@/utils/api': {
        fetcher: async (url: string, init: RequestInit) => {
          requests.push({ url, init });
          return {};
        },
      },
    },
  );
  await api.updateProduct({ id, name: 'Changed' });
  expect(requests[0].url).toBe('/api/products/' + id);
  expect(JSON.parse(String(requests[0].init.body))).toStrictEqual({ name: 'Changed' });
  await api.generateProductCode();
  expect(requests[1].url).toBe('/api/products/generate-code');
  expect(requests[1].init.method).toBe('POST');
  expect(requests[1].init.cache).toBe('no-store');
  const hooks = loadSource<{
    useUpdateProduct: () => { retry: boolean; onSuccess: (data: unknown, variables: { id: string }) => void };
    useGenerateProductCode: () => { retry: boolean; onSuccess?: unknown };
  }>('src/features/dashboard/products/hooks/use-products.ts', {
    '../api/product.api': api,
    '@tanstack/react-query': {
      useMutation: (configuration: unknown) => configuration,
      useQueryClient: () => ({
        invalidateQueries: (query: { queryKey: unknown[] }) => invalidations.push(query.queryKey),
      }),
    },
  });
  const edit = hooks.useUpdateProduct();
  expect(edit.retry).toBe(false);
  edit.onSuccess({}, { id });
  expect(invalidations).toStrictEqual([['products'], ['products', 'detail', id]]);
  const generation = hooks.useGenerateProductCode();
  expect(generation.retry).toBe(false);
  expect(generation.onSuccess).toBe(undefined);
});
