import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module, { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';

const loadDependency = createRequire(import.meta.url);
const modulePaths = new Module(import.meta.filename);
modulePaths.paths = Module._nodeModulePaths(path.resolve('tests'));

// Exercise the real service without connecting to Neon or requiring a Next runtime.
const apiModule = new Module('api');
apiModule._compile(
  ts.transpileModule(fs.readFileSync('src/utils/api.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  'api.js',
);
const productId = '11111111-1111-4111-8111-111111111111';
let products = [{ id: productId, name: 'Historical name', price: 10000 }];
let prepared;
let query;
const repository = {
  findTransactions: async (params) => {
    query = params;
    return { data: [], pagination: params };
  },
  findTransactionById: async () => null,
  insertTransactionWithItems: async (_ids, prepare) => {
    prepared = prepare(products);
    return { ...prepared.transaction, items: prepared.items };
  },
};
const serviceModule = new Module('transaction-service');
serviceModule.paths = modulePaths.paths;
serviceModule.require = (id) => {
  if (id === 'server-only') return {};
  if (id === '@/utils/api') return apiModule.exports;
  if (id === '@/server/repositories/transaction.repository') return repository;
  return loadDependency(id);
};
serviceModule._compile(
  ts.transpileModule(fs.readFileSync('src/server/services/transaction.service.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  path.resolve('src/server/services/transaction.service.ts'),
);
const service = serviceModule.exports;
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
  assert.deepEqual(result.items, [
    { productId, productName: 'Historical name', price: 10000, quantity: 2, subtotal: 20000 },
  ]);
  assert.equal(result.total, 20000);
  assert.equal(result.subtotal, 20000);
  assert.equal(result.changeAmount, 5000);
  assert.equal(result.userId, '1');
  products[0].price = 12000;
  assert.equal(result.items[0].price, 10000);
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
  assert.equal(result.changeAmount, 0);
});

test('validates pagination and forwards existing search parameters', async () => {
  for (const params of [{ page: 0 }, { limit: -1 }, { page: 1.5 }, { page: Number.MAX_SAFE_INTEGER, limit: 10 }]) {
    await assert.rejects(service.getTransactions(params), /positive integers/);
  }
  await service.getTransactions({ page: 2, limit: 5, search: ' Invoice_% ' });
  assert.deepEqual(query, { page: 2, limit: 5, search: ' Invoice_% ' });
  assert.equal(await service.getTransactionById('legacy-invalid-id'), null);
});
