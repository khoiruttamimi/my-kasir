import { NextRequest } from 'next/server';
import assert from 'node:assert/strict';
import { expect, test } from '@jest/globals';
import { loadSource } from './helpers/load-source';
import { ApiError, setup, id, otherId, input } from './helpers/product-fixture';

test('existing collection routes preserve create/list envelopes and validation statuses without live auth/database', async () => {
  const { service } = setup();
  let session: { user: { id: string; role: string } } | null = { user: { id, role: 'admin' } };
  const { withAuth } = loadSource<typeof import('@/server/auth/with-auth')>('src/server/auth/with-auth.ts', {
    '@/auth': { auth: async () => session },
  });
  const responses = loadSource<typeof import('@/server/utils/api')>('src/server/utils/api.ts', {
    '@/utils/api': { ApiError },
  });
  const route = loadSource<typeof import('@/app/api/products/route')>('src/app/api/products/route.ts', {
    '@/server/services/product.service': service,
    '@/server/auth/with-auth': { withAuth },
    '@/server/utils/api': responses,
  });
  const request = (body: unknown) =>
    new NextRequest('http://localhost/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  const created = await route.POST(request(input()), undefined);
  expect(created.status).toBe(201);
  expect((await created.json()).code).toBe('AbC001');
  const duplicate = await route.POST(request(input('abc001')), undefined);
  expect(duplicate.status).toBe(409);
  expect(await duplicate.json()).toStrictEqual({ message: 'Product code is already in use' });
  const invalid = await route.POST(request({ ...input(), code: '' }), undefined);
  expect(invalid.status).toBe(400);
  const list = await route.GET(new NextRequest('http://localhost/api/products'), undefined);
  const result = await list.json();
  expect(list.status).toBe(200);
  expect(result.data[0].code).toBe('AbC001');
  assert.ok('pagination' in result);
  session = null;
  const unauthorized = await route.POST(request(input('other')), undefined);
  expect(unauthorized.status).toBe(401);
  expect(await unauthorized.json()).toStrictEqual({ message: 'Unauthorized' });
});

test('cashier catalog validates opted-in requests while preserving list envelopes and legacy limits', async () => {
  const product = { ...input(), id };
  const { service, calls } = setup({ records: [product] });
  let session: { user: { id: string; role: string } } | null = { user: { id, role: 'cashier' } };
  const { withAuth } = loadSource<typeof import('@/server/auth/with-auth')>('src/server/auth/with-auth.ts', {
    '@/auth': { auth: async () => session },
  });
  const responses = loadSource<typeof import('@/server/utils/api')>('src/server/utils/api.ts', {
    '@/utils/api': { ApiError },
  });
  const route = loadSource<typeof import('@/app/api/products/route')>('src/app/api/products/route.ts', {
    '@/server/services/product.service': service,
    '@/server/auth/with-auth': { withAuth },
    '@/server/utils/api': responses,
  });
  const list = (params: string) => route.GET(new NextRequest(`http://localhost/api/products?${params}`), undefined);

  for (const limit of [1, 24, 100]) {
    const response = await list(`searchMode=name-or-code&search=AbC&limit=${limit}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [product],
      pagination: { page: 1, limit, total: 1, totalPages: 1 },
    });
    expect(calls.lists.at(-1)).toEqual({ searchMode: 'name-or-code', search: 'AbC', page: 1, limit });
  }
  const legacy = await list('limit=101');
  expect(legacy.status).toBe(200);
  expect((await legacy.json()).pagination.limit).toBe(101);
  expect(calls.lists.at(-1)).toEqual({ search: '', page: 1, limit: 101 });

  for (const limit of ['0', '1.5', 'abc', '101']) {
    const invalid = await list(`searchMode=name-or-code&limit=${limit}`);
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ message: 'limit must be an integer between 1 and 100' });
  }
  expect((await list('searchMode=unknown')).status).toBe(400);
  expect((await list('searchMode=name-or-code&page=0')).status).toBe(400);
  session = null;
  expect((await list('searchMode=name-or-code')).status).toBe(401);
  expect(calls.lists).toHaveLength(4);
});

test('generation route preserves authentication, returns no-store on 200/401/503, and accepts existing cashier policy', async () => {
  const { service, calls } = setup();
  let session: { user: { id: string; role: string } } | null = { user: { id, role: 'cashier' } };
  const { withAuth } = loadSource<typeof import('@/server/auth/with-auth')>('src/server/auth/with-auth.ts', {
    '@/auth': { auth: async () => session },
  });
  const responses = loadSource<typeof import('@/server/utils/api')>('src/server/utils/api.ts', {
    '@/utils/api': { ApiError },
  });
  const route = loadSource<typeof import('@/app/api/products/generate-code/route')>(
    'src/app/api/products/generate-code/route.ts',
    {
      '@/server/services/product.service': service,
      '@/server/auth/with-auth': { withAuth },
      '@/server/utils/api': responses,
    },
  );
  const request = new NextRequest('http://localhost/api/products/generate-code', { method: 'POST' });
  const generated = await route.POST(request);
  expect(generated.status).toBe(200);
  expect(generated.headers.get('Cache-Control')).toBe('no-store');
  expect(await generated.json()).toStrictEqual({ code: '2000000000008' });
  session = null;
  const unauthorized = await route.POST(request);
  expect(unauthorized.status).toBe(401);
  expect(unauthorized.headers.get('Cache-Control')).toBe('no-store');
  expect(calls.generated).toBe(1);
  session = { user: { id, role: 'admin' } };
  const exhausted = loadSource<typeof import('@/app/api/products/generate-code/route')>(
    'src/app/api/products/generate-code/route.ts',
    {
      '@/server/services/product.service': setup({ sequence: [] }).service,
      '@/server/auth/with-auth': { withAuth },
      '@/server/utils/api': responses,
    },
  );
  const unavailable = await exhausted.POST(request);
  expect(unavailable.status).toBe(503);
  expect(unavailable.headers.get('Cache-Control')).toBe('no-store');
  expect(await unavailable.json()).toStrictEqual({
    message: 'Internal product code generation range is exhausted. Enter a code manually.',
  });
});

test('item routes retain PUT data envelope and distinguish assignment conflict from duplicate ownership', async () => {
  const row = { ...input(), id };
  const { service } = setup({ records: [row] });
  const { withAuth } = loadSource<typeof import('@/server/auth/with-auth')>('src/server/auth/with-auth.ts', {
    '@/auth': { auth: async () => ({ user: { id, role: 'admin' } }) },
  });
  const responses = loadSource<typeof import('@/server/utils/api')>('src/server/utils/api.ts', {
    '@/utils/api': { ApiError },
  });
  const dependencies = {
    '@/server/services/product.service': service,
    '@/server/auth/with-auth': { withAuth },
    '@/server/utils/api': responses,
  };
  const route = loadSource<typeof import('@/app/api/products/[id]/route')>(
    'src/app/api/products/[id]/route.ts',
    dependencies,
  );
  const request = (body: unknown) =>
    new NextRequest('http://localhost/api/products/' + id, {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  const context = { params: Promise.resolve({ id }) };
  const result = await route.PUT(request({ code: 'Edited001' }), context);
  expect(result.status).toBe(200);
  expect((await result.json()).data.code).toBe('Edited001');
  const race = setup({
    records: [{ ...input(), id, code: null }],
    guardedMiss: true,
    afterMiss: (records) => {
      records[0].code = 'Assigned001';
    },
  });
  const conflicted = loadSource<typeof import('@/app/api/products/[id]/route')>('src/app/api/products/[id]/route.ts', {
    ...dependencies,
    '@/server/services/product.service': race.service,
  });
  const conflict = await conflicted.PUT(request({ name: 'Wrong' }), context);
  expect(conflict.status).toBe(409);
  expect(await conflict.json()).toStrictEqual({
    message: 'Product Code was assigned by another request. Refresh and retry manually.',
  });
  expect(race.calls.updates).toBe(1);
  const missing = await route.GET(new NextRequest('http://localhost/'), { params: Promise.resolve({ id: otherId }) });
  expect(missing.status).toBe(404);
});

test('exact cashier reads keep Product envelopes and distinguish blank input from absent active matches', async () => {
  const product = { ...input('00AbC'), id };
  const { service } = setup({
    records: [product, { ...input('00123'), id: otherId, deletedAt: '2026-01-01' }],
  });
  let session: { user: { id: string; role: string } } | null = { user: { id, role: 'cashier' } };
  const { withAuth } = loadSource<typeof import('@/server/auth/with-auth')>('src/server/auth/with-auth.ts', {
    '@/auth': { auth: async () => session },
  });
  const responses = loadSource<typeof import('@/server/utils/api')>('src/server/utils/api.ts', {
    '@/utils/api': { ApiError },
  });
  const route = loadSource<typeof import('@/app/api/products/route')>('src/app/api/products/route.ts', {
    '@/server/services/product.service': service,
    '@/server/auth/with-auth': { withAuth },
    '@/server/utils/api': responses,
  });
  const lookup = (search: string) =>
    route.GET(
      new NextRequest(
        `http://localhost/api/products?searchMode=exact-code&page=2&limit=24&search=${encodeURIComponent(search)}`,
      ),
      undefined,
    );

  const hit = await lookup(' 00aBc ');
  expect(hit.status).toBe(200);
  expect(hit.headers.get('cache-control')).toBe('no-store');
  expect(await hit.json()).toEqual({
    data: [product],
    pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
  });
  for (const code of ['00Ab', '00123', '999']) {
    const miss = await lookup(code);
    expect(miss.status).toBe(200);
    expect(await miss.json()).toEqual({
      data: [],
      pagination: { page: 1, limit: 1, total: 0, totalPages: 0 },
    });
  }
  expect((await lookup('  ')).status).toBe(400);
  session = null;
  expect((await lookup('00abc')).status).toBe(401);
});
