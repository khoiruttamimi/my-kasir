import 'server-only';

import { and, desc, eq, ilike, isNull, sql } from 'drizzle-orm';

import { db } from '@/server/db';
import { products } from '@/server/db/schema';

export interface FindProductsParams {
  page?: number;
  limit?: number;
  search?: string;
}

export async function findProducts({ page = 1, limit = 10, search = '' }: FindProductsParams = {}) {
  const safePage = Math.max(page, 1);
  const safeLimit = Math.max(limit, 1);

  const offset = (safePage - 1) * safeLimit;
  const normalizedSearch = search.trim();

  const where = normalizedSearch
    ? and(isNull(products.deletedAt), ilike(products.name, `%${normalizedSearch}%`))
    : isNull(products.deletedAt);

  const [data, [{ total }]] = await Promise.all([
    db.select().from(products).where(where).orderBy(desc(products.createdAt)).limit(safeLimit).offset(offset),

    db
      .select({
        total: sql<number>`count(*)::int`,
      })
      .from(products)
      .where(where),
  ]);

  return {
    data,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}

export async function findProductById(id: string) {
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), isNull(products.deletedAt)))
    .limit(1);

  return product ?? null;
}

export type CreateProductInput = {
  name: string;
  category: string;
  price: number;
  stock: number;
};

export async function insertProduct(data: CreateProductInput) {
  const [product] = await db.insert(products).values(data).returning();

  return product;
}

export type UpdateProductInput = Partial<CreateProductInput>;

export async function updateProductById(id: string, data: UpdateProductInput) {
  const [product] = await db
    .update(products)
    .set({
      ...data,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(products.id, id), isNull(products.deletedAt)))
    .returning();

  return product ?? null;
}

export async function deleteProductById(id: string) {
  const [product] = await db
    .update(products)
    .set({
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(products.id, id), isNull(products.deletedAt)))
    .returning();

  return product ?? null;
}
