import { PgDialect } from 'drizzle-orm/pg-core';
import assert from 'node:assert/strict';
import { expect, test } from '@jest/globals';
import { loadSource } from '../../../tests/helpers/load-source';
import { id } from '../../../tests/helpers/product-fixture';

test('repository guard and all-owner lookup use parameterized Drizzle SQL without live execution', async () => {
  const dialect = new PgDialect();
  const schema = loadSource<typeof import('@/server/db/schema')>('src/server/db/schema.ts');
  const queries: { sql: string; params: unknown[] }[] = [];
  let values: Partial<import('@/models/product').CreateProductPayload> = {};
  const builder = {
    set(value: Partial<import('@/models/product').CreateProductPayload>) {
      values = value;
      return this;
    },
    from() {
      return this;
    },
    where(sql: import('drizzle-orm').SQL) {
      queries.push(dialect.sqlToQuery(sql));
      return this;
    },
    returning: async () => [],
    limit: async () => [],
  };
  const repository = loadSource<typeof import('@/server/repositories/product.repository')>(
    'src/server/repositories/product.repository.ts',
    {
      'server-only': {},
      '@/server/db/schema': schema,
      '@/server/db': { db: { update: () => builder, select: () => builder } },
    },
  );
  await repository.updateProductById(id, { name: 'New name' });
  assert.ok(!('code' in values));
  expect(queries.at(-1)!.sql).toMatch(/"products"\."code" is not null/);
  expect(queries.at(-1)!.sql).toMatch(/"products"\."deleted_at" is null/);
  await repository.updateProductById(id, { code: 'Assigned001' });
  expect(values.code).toBe('Assigned001');
  expect(queries.at(-1)!.sql).not.toMatch(/"code" is not null/);
  await repository.findProductByCode("Injected'Value", id);
  expect(queries.at(-1)!.sql).not.toMatch(/deleted_at|Injected/);
  assert.ok(queries.at(-1)!.params.includes("injected'value"));
  assert.ok(queries.at(-1)!.params.includes(id));
});

test('dedicated sequence repository returns text and maps only generator limit failures without live access', async () => {
  const schema = loadSource<typeof import('@/server/db/schema')>('src/server/db/schema.ts');
  let failure: unknown,
    calls = 0;
  const repository = loadSource<typeof import('@/server/repositories/product.repository')>(
    'src/server/repositories/product.repository.ts',
    {
      'server-only': {},
      '@/server/db/schema': schema,
      '@/server/db': {
        db: {
          execute: async () => {
            calls++;
            if (failure) throw failure;
            return { rows: [{ value: '9999999999' }] };
          },
        },
      },
    },
  );
  expect(await repository.nextProductCodeValue()).toBe('9999999999');
  failure = new Error('query failed', { cause: { code: '2200H' } });
  expect(await repository.nextProductCodeValue()).toBe(null);
  failure = new Error('permission denied', { cause: { code: '42501' } });
  await assert.rejects(repository.nextProductCodeValue(), (error) => error === failure);
  expect(calls).toBe(3);
});
