import { expect, test } from '@jest/globals';
import { loadSource } from '../../../../../tests/helpers/load-source';
import { id } from '../../../../../tests/helpers/product-fixture';

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
    useUpdateProduct: () => { retry: boolean; onSuccess: (data: unknown, variables: { id: string }) => void }; // eslint-disable-line no-unused-vars -- Parameter names document test callback types.
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
