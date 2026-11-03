import assert from 'node:assert/strict';
import { expect, test } from '@jest/globals';
import { setup, status, id, otherId, input } from '../../../tests/helpers/product-fixture';

test('manual code strings preserve case and zeros, trim outside whitespace, accept 1 and 100 characters', async () => {
  for (const [source, expected] of [
    [' AbC001 ', 'AbC001'],
    ['0012345678905', '0012345678905'],
    ['123', '123'],
    ['A', 'A'],
    ['Z'.repeat(100), 'Z'.repeat(100)],
  ]) {
    const { service } = setup();
    expect((await service.createProduct(input(source))).code).toBe(expected);
  }
});

test('new products require a string code with ASCII characters and length limits before insertion', async () => {
  for (const code of [undefined, null, 123, '', '  ', 'A B', 'A-1', 'é', 'A'.repeat(101)]) {
    const { service, calls } = setup();
    const body = { ...input(), code };
    if (code === undefined) delete body.code;
    await assert.rejects(service.createProduct(body), status(400));
    expect(calls.inserts).toBe(0);
  }
});

test('case-insensitive and soft-deleted code owners prevent new products', async () => {
  for (const deletedAt of [null, '2026-01-01']) {
    const { service, calls } = setup({ records: [{ ...input('abc001'), id: otherId, deletedAt }] });
    await assert.rejects(service.createProduct(input()), status(409, 'Product code is already in use'));
    expect(calls.inserts).toBe(0);
  }
});

test('maps only the named unique-index race through nested/cyclic causes and preserves unexpected errors', async () => {
  const conflict = new Error('query failed', {
    cause: { cause: { code: '23505', constraint: 'products_code_unique' } },
  });
  await assert.rejects(
    setup({ failure: conflict }).service.createProduct(input()),
    status(409, 'Product code is already in use'),
  );
  for (const failure of [
    new Error('offline'),
    { code: '23505', constraint: 'unrelated_index' },
    { code: '08006', constraint: 'products_code_unique' },
  ]) {
    await assert.rejects(setup({ failure }).service.createProduct(input()), (error) => error === failure);
  }
  const cyclic: { message: string; cause?: unknown } = { message: 'cycle' };
  cyclic.cause = cyclic;
  await assert.rejects(setup({ failure: cyclic }).service.createProduct(input()), (error) => error === cyclic);
});

test('coded edits preserve omitted codes, allow self-code and release replaced codes', async () => {
  const row = { ...input(), id };
  const { service, calls } = setup({ records: [row] });
  expect((await service.updateProduct(id, { name: 'New name' }))!.code).toBe('AbC001');
  expect((await service.updateProduct(id, { code: ' AbC001 ' }))!.code).toBe('AbC001');
  expect((await service.updateProduct(id, { code: 'New001' }))!.id).toBe(id);
  expect(row.stock).toBe(5);
  expect((await service.createProduct(input('AbC001'))).code).toBe('AbC001');
  expect(calls.lookup[0].excludeId).toBe(id);
});

test('edit duplicates and invalid clearing fail without changing other product fields', async () => {
  for (const deletedAt of [null, '2026-01-01']) {
    const row = { ...input('Own001'), id };
    const before = { ...row };
    const { service, calls } = setup({ records: [row, { ...input('Taken001'), id: otherId, deletedAt }] });
    await assert.rejects(
      service.updateProduct(id, { code: ' taken001 ', name: 'Wrong' }),
      status(409, 'Product code is already in use'),
    );
    for (const code of ['', '  ', null, 123, 'A B', 'A'.repeat(101)]) {
      await assert.rejects(service.updateProduct(id, { code, name: 'Wrong' }), status(400));
    }
    expect(row).toStrictEqual(before);
    expect(calls.updates).toBe(0);
  }
});

test('edit translates only the named index conflict, preserving original data', async () => {
  const row = { ...input(), id };
  const before = { ...row };
  const conflict = new Error('query failed', { cause: { code: '23505', constraint: 'products_code_unique' } });
  await assert.rejects(
    setup({ records: [row], failure: conflict }).service.updateProduct(id, { code: 'New001' }),
    status(409, 'Product code is already in use'),
  );
  expect(row).toStrictEqual(before);
  const failure = new Error('offline');
  await assert.rejects(
    setup({ records: [row], failure }).service.updateProduct(id, { name: 'New' }),
    (error) => error === failure,
  );
});

test('guarded omitted-code miss distinguishes uncoded 400, missing/deleted 404, and assigned 409 without retry', async () => {
  const row = { ...input(), id, code: null };
  const first = setup({ records: [row] });
  await assert.rejects(first.service.updateProduct(id, { name: 'Wrong' }), status(400, 'Product Code is required'));
  expect(row.name).toBe('Tea');
  expect(first.calls.updates).toBe(1);
  for (const records of [[], [{ ...input(), id, deletedAt: '2026-01-01' }]]) {
    const missing = setup({ records });
    expect(await missing.service.updateProduct(id, { name: 'Wrong' })).toBe(null);
    expect(missing.calls.updates).toBe(1);
  }
  const race = setup({
    records: [row],
    guardedMiss: true,
    afterMiss: (records) => {
      records[0].code = 'Concurrent001';
      records[0].name = 'Committed name';
    },
  });
  await assert.rejects(
    race.service.updateProduct(id, { name: 'Wrong' }),
    status(409, 'Product Code was assigned by another request. Refresh and retry manually.'),
  );
  expect(race.calls.updates).toBe(1);
  expect(row.code).toBe('Concurrent001');
  expect(row.name).toBe('Committed name');
});

test('legacy reads remain usable, assignment is required on edits, and deletion does not require a code', async () => {
  const row = { ...input(), id, code: null, createdAt: '2025-01-01', stock: 5 };
  const { service } = setup({ records: [row] });
  expect((await service.getProductById(id))!.code).toBe(null);
  expect((await service.getProducts()).data[0].code).toBe(null);
  await assert.rejects(service.updateProduct(id, { name: 'Tea changed' }), status(400));
  expect(row.name).toBe('Tea');
  const updated = await service.updateProduct(id, { code: 'Legacy001' });
  assert.ok(updated);
  expect(updated.id).toBe(id);
  expect(updated.stock).toBe(5);
  expect(updated.createdAt).toBe('2025-01-01');
  expect((await service.updateProduct(id, { name: 'Tea changed' }))!.code).toBe('Legacy001');
  await assert.rejects(service.updateProduct(id, { code: '' }), status(400));
  const uncoded = setup({ records: [{ ...input(), id: otherId, code: null }] });
  expect((await uncoded.service.deleteProduct(otherId)).code).toBe(null);
});

test('legacy duplicate assignment rejects the whole edit without losing saved business fields', async () => {
  const row = { ...input(), id, code: null };
  const before = { ...row };
  const { service, calls } = setup({ records: [row, { ...input('Taken001'), id: otherId }] });
  await assert.rejects(service.updateProduct(id, { code: 'TAKEN001', name: 'Wrong', stock: 10 }), status(409));
  expect(row).toStrictEqual(before);
  expect(calls.updates).toBe(0);
});

test('generation returns an unreserved unused candidate, skips deleted owners, and writes no product', async () => {
  const { service, calls } = setup({ records: [{ ...input('2000000000008'), id, deletedAt: '2026-01-01' }] });
  const code = await service.generateProductCode();
  expect(code).toBe('2000000000015');
  expect(calls.generated).toBe(2);
  expect(calls.inserts).toBe(0);
  expect(calls.updates).toBe(0);
});

test('generation distinguishes 32 occupied attempts, sequence exhaustion, and unexpected errors', async () => {
  const repeated = setup({ records: [{ ...input('2000000000008'), id }], sequence: Array(32).fill('0') });
  await assert.rejects(
    repeated.service.generateProductCode(),
    status(503, 'Unable to generate an unused product code. Try again or enter a code manually.'),
  );
  expect(repeated.calls.generated).toBe(32);
  const exhausted = setup({ sequence: [] });
  await assert.rejects(
    exhausted.service.generateProductCode(),
    status(503, 'Internal product code generation range is exhausted. Enter a code manually.'),
  );
  expect(exhausted.calls.generated).toBe(1);
  const failure = new Error('connection failed');
  await assert.rejects(setup({ sequenceFailure: failure }).service.generateProductCode(), (error) => error === failure);
});
