import assert from 'node:assert/strict';
import { expect, test } from '@jest/globals';
import { loadSource } from '../../../tests/helpers/load-source';
import type { PreparedTransaction } from '@/server/repositories/transaction.repository';
const productId = '11111111-1111-4111-8111-111111111111';
let products = [{ id: productId, name: 'Historical name', price: 10000 }];
let prepared: PreparedTransaction;
let query: unknown;
const repository = {
  findTransactions: async (params: { page: number; limit: number; search: string }) => {
    query = params;
    return { data: [], pagination: params };
  },
  findTransactionById: async () => null,
  insertTransactionWithItems: async (
    _ids: string[],
    prepare: (currentProducts: { id: string; name: string; price: number }[]) => PreparedTransaction, // eslint-disable-line no-unused-vars -- Parameter names document test callback types.
  ) => {
    prepared = prepare(products);
    return { ...prepared.transaction, items: prepared.items };
  },
};
const service = loadSource<typeof import('@/server/services/transaction.service')>(
  'src/server/services/transaction.service.ts',
  {
    'server-only': {},
    '@/utils/api': loadSource<typeof import('@/utils/api')>('src/utils/api.ts'),
    '@/server/repositories/transaction.repository': repository,
  },
);
const cashier = { id: '1', name: 'Cashier' };
const payload = () => ({
  items: [{ productId, quantity: 2, price: 1, productName: 'Forged', subtotal: 2 }],
  total: 2,
  paymentMethod: 'cash',
  paidAmount: 25000,
  userId: 'forged',
});

test('uses database snapshots and server totals, with authenticated cashier identity', async () => {
  const result = await service.createTransaction(payload(), cashier);
  expect(result.items).toStrictEqual([
    { productId, productName: 'Historical name', price: 10000, quantity: 2, subtotal: 20000 },
  ]);
  expect(result.total).toBe(20000);
  expect(result.subtotal).toBe(20000);
  expect(result.changeAmount).toBe(5000);
  expect(result.userId).toBe('1');
  products[0].price = 12000;
  expect(result.items[0].price).toBe(10000);
  products[0].price = 10000;
});

test('rejects missing or soft-deleted products before preparing an insert', async () => {
  const saved = products;
  products = [];
  try {
    await assert.rejects(service.createTransaction(payload(), cashier), /inactive/);
  } finally {
    products = saved;
  }
});

test('rejects invalid quantities, duplicates, underpayment, and overflow', async () => {
  for (const quantity of [0, -1, 1.5, '2', Infinity, 2147483647]) {
    await assert.rejects(service.createTransaction({ ...payload(), items: [{ productId, quantity }] }, cashier));
  }
  await assert.rejects(
    service.createTransaction(
      {
        ...payload(),
        items: [
          { productId, quantity: 1 },
          { productId, quantity: 1 },
        ],
      },
      cashier,
    ),
    /only once/,
  );
  await assert.rejects(service.createTransaction({ ...payload(), paidAmount: 1 }, cashier), /cover/);
});

test('QRIS requires exact payment and returns zero change', async () => {
  await assert.rejects(service.createTransaction({ ...payload(), paymentMethod: 'qris' }, cashier), /equal/);
  const result = await service.createTransaction({ ...payload(), paymentMethod: 'qris', paidAmount: 20000 }, cashier);
  expect(result.changeAmount).toBe(0);
});

test('validates pagination and forwards existing search parameters', async () => {
  for (const params of [{ page: 0 }, { limit: -1 }, { page: 1.5 }, { page: Number.MAX_SAFE_INTEGER, limit: 10 }]) {
    await assert.rejects(service.getTransactions(params), /positive integers/);
  }
  await service.getTransactions({ page: 2, limit: 5, search: ' Invoice_% ' });
  expect(query).toStrictEqual({ page: 2, limit: 5, search: ' Invoice_% ' });
  expect(await service.getTransactionById('legacy-invalid-id')).toBe(null);
});
