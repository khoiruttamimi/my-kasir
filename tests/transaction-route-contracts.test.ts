import { expect, test } from '@jest/globals';
import { NextRequest } from 'next/server';
import type { PreparedTransaction } from '@/server/repositories/transaction.repository';
import { loadSource } from './helpers/load-source';
import { ApiError, jsonRequest, routeFixture } from './helpers/route-fixture';

const id = '11111111-1111-4111-8111-111111111111';
const productId = '22222222-2222-4222-8222-222222222222';
const url = 'http://localhost/api/transactions';
const products = [{ id: productId, name: 'Tea', price: 10000 }];
const payload = {
  items: [{ productId, quantity: 2, price: 1, productName: 'Forged' }],
  paymentMethod: 'cash',
  paidAmount: 25000,
  total: 2,
  userId: 'forged',
  userName: 'Forged',
};

function setup() {
  const auth = routeFixture();
  let stored: PreparedTransaction | null = null;
  let calls = 0;
  const detail = () =>
    stored
      ? {
          id,
          invoiceNumber: 'INV-DB-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          ...stored.transaction,
          items: stored.items,
        }
      : null;
  const service = loadSource<typeof import('@/server/services/transaction.service')>(
    'src/server/services/transaction.service.ts',
    {
      'server-only': {},
      '@/utils/api': { ApiError },
      '@/server/repositories/transaction.repository': {
        findTransactions: async (params: { page: number; limit: number; search: string }) => {
          calls++;
          return { data: stored ? [detail()] : [], pagination: params };
        },
        findTransactionById: async (requestedId: string) => {
          calls++;
          return requestedId === id ? detail() : null;
        },
        // eslint-disable-next-line no-unused-vars -- Parameter names document the preparation callback type.
        insertTransactionWithItems: async (ids: string[], prepare: (rows: typeof products) => PreparedTransaction) => {
          expect(ids).toStrictEqual([productId]);
          const prepared = prepare(products);
          calls++;
          stored = prepared;
          return detail();
        },
      },
    },
  );
  const dependencies = { ...auth.dependencies, '@/server/services/transaction.service': service };
  return {
    auth,
    collection: loadSource<typeof import('@/app/api/transactions/route')>(
      'src/app/api/transactions/route.ts',
      dependencies,
    ),
    item: loadSource<typeof import('@/app/api/transactions/[id]/route')>(
      'src/app/api/transactions/[id]/route.ts',
      dependencies,
    ),
    get calls() {
      return calls;
    },
  };
}

test('Transaction endpoints reject anonymous sessions before repository access', async () => {
  const h = setup();
  h.auth.signOut();
  for (const response of [
    await h.collection.GET(new NextRequest(url), undefined),
    await h.collection.POST(jsonRequest(url, 'POST', payload), undefined),
    await h.item.GET(new NextRequest(url), { params: Promise.resolve({ id }) }),
  ]) {
    expect(response.status).toBe(401);
    expect(await response.json()).toStrictEqual({ message: 'Unauthorized' });
  }
  expect(h.calls).toBe(0);
});

test('Transaction routes allow cashier/admin sessions and preserve snapshots, server totals and session identity', async () => {
  for (const role of ['cashier', 'admin'] as const) {
    const h = setup();
    h.auth.setRole(role);
    const created = await h.collection.POST(jsonRequest(url, 'POST', payload), undefined);
    expect(created.status).toBe(201);
    const expected = {
      id,
      invoiceNumber: 'INV-DB-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      subtotal: 20000,
      total: 20000,
      paymentMethod: 'cash',
      paidAmount: 25000,
      changeAmount: 5000,
      userId: 'cashier-1',
      userName: 'Cashier',
      items: [{ productId, productName: 'Tea', price: 10000, quantity: 2, subtotal: 20000 }],
    };
    expect(await created.json()).toStrictEqual(expected);
    const list = await h.collection.GET(new NextRequest(url + '?page=2&limit=5&search=INV'), undefined);
    expect(list.status).toBe(200);
    expect(await list.json()).toStrictEqual({ data: [expected], pagination: { page: 2, limit: 5, search: 'INV' } });
    const detail = await h.item.GET(new NextRequest(url), { params: Promise.resolve({ id }) });
    expect(detail.status).toBe(200);
    expect(await detail.json()).toStrictEqual(expected);
  }
});

test('Transaction routes return validation errors without inserts and distinguish missing details', async () => {
  const h = setup();
  const malformed = await h.collection.POST(new NextRequest(url, { method: 'POST', body: '{' }), undefined);
  expect(malformed.status).toBe(400);
  expect(await malformed.json()).toStrictEqual({ message: 'Request body must be valid JSON' });
  for (const body of [
    { ...payload, items: [] },
    { ...payload, paidAmount: 1 },
    { ...payload, paymentMethod: 'qris' },
  ]) {
    const invalid = await h.collection.POST(jsonRequest(url, 'POST', body), undefined);
    expect(invalid.status).toBe(400);
    expect(typeof (await invalid.json()).message).toBe('string');
  }
  const pagination = await h.collection.GET(new NextRequest(url + '?limit=0'), undefined);
  expect(pagination.status).toBe(400);
  expect(h.calls).toBe(0);
  for (const missingId of ['invalid-id', id]) {
    const missing = await h.item.GET(new NextRequest(url), { params: Promise.resolve({ id: missingId }) });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toStrictEqual({ message: 'Transaction not found' });
  }
  expect(h.calls).toBe(1);
  const qris = await h.collection.POST(
    jsonRequest(url, 'POST', { ...payload, paymentMethod: 'qris', paidAmount: 20000 }),
    undefined,
  );
  expect(qris.status).toBe(201);
  expect((await qris.json()).changeAmount).toBe(0);
});
