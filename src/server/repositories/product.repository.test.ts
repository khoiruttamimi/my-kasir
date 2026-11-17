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

test('cashier browse and search keep active rows, bind literal patterns, and page in stable order', async () => {
  const dialect = new PgDialect();
  const schema = loadSource<typeof import('@/server/db/schema')>('src/server/db/schema.ts');
  const filters: ReturnType<typeof dialect.sqlToQuery>[] = [];
  const orders: string[][] = [];
  const pages: { limit: number; offset: number }[] = [];
  const repository = loadSource<typeof import('@/server/repositories/product.repository')>(
    'src/server/repositories/product.repository.ts',
    {
      'server-only': {},
      '@/server/db/schema': schema,
      '@/server/db': {
        db: {
          select(fields?: unknown) {
            return {
              from: () => ({
                where(predicate: import('drizzle-orm').SQL) {
                  filters.push(dialect.sqlToQuery(predicate));
                  if (fields) return Promise.resolve([{ total: 101 }]);
                  return {
                    orderBy(...columns: import('drizzle-orm').SQL[]) {
                      orders.push(columns.map((column) => dialect.sqlToQuery(column).sql));
                      return {
                        limit: (limit: number) => ({
                          offset: async (offset: number) => {
                            pages.push({ limit, offset });
                            return [];
                          },
                        }),
                      };
                    },
                  };
                },
              }),
            };
          },
        },
      },
    },
  );
  const search = String.raw` Mix%_\001 `;
  const literalPattern = String.raw`%Mix\%\_\\001%`;
  const result = await repository.findProducts({ searchMode: 'name-or-code', search, page: 2, limit: 24 });
  expect(result.pagination).toEqual({ page: 2, limit: 24, total: 101, totalPages: 5 });
  expect(pages[0]).toEqual({ limit: 24, offset: 24 });
  expect(filters).toHaveLength(2);
  for (const filter of filters) {
    expect(filter.sql).toMatch(
      /"deleted_at" is null.*\("products"\."name" ilike \$1 or "products"\."code" ilike \$2\)/,
    );
    expect(filter.params).toEqual([literalPattern, literalPattern]);
  }
  expect(orders[0]).toEqual(['"products"."created_at" desc', '"products"."id" desc']);

  await repository.findProducts({ searchMode: 'name-or-code', search: '  ' });
  expect(filters[2]).toMatchObject({ sql: '"products"."deleted_at" is null', params: [] });
  expect(orders[1]).toEqual(orders[0]);

  await repository.findProducts({ search });
  expect(filters[4].sql).toContain('"products"."name" ilike');
  expect(filters[4].sql).not.toContain('"products"."code"');
  expect(filters[4].params).toEqual([`%${search.trim()}%`]);
  expect(orders[2]).toEqual(['"products"."created_at" desc']);
});
