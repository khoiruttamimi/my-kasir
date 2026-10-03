import 'server-only';

import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { Transaction, TransactionItem } from '@/models/transaction';
import { db } from '@/server/db';
import { withTransactionDatabase } from '@/server/db/transaction';
import { products, transactions, transactionItems } from '@/server/db/schema';

type TransactionRow = typeof transactions.$inferSelect;
type ItemRow = typeof transactionItems.$inferSelect;
type ProductRow = typeof products.$inferSelect;
export type TransactionInsert = Omit<typeof transactions.$inferInsert, 'id' | 'createdAt' | 'deletedAt'>;
export type PreparedTransaction = { transaction: TransactionInsert; items: TransactionItem[] };

function toTransaction(row: TransactionRow, items: ItemRow[]): Transaction {
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    subtotal: row.subtotal,
    total: row.total,
    paymentMethod: row.paymentMethod,
    paidAmount: row.paidAmount,
    changeAmount: row.changeAmount,
    userId: row.userId,
    userName: row.userName,
    createdAt: new Date(row.createdAt).toISOString(),
    items: items.map(({ productId, productName, price, quantity, subtotal }) => ({
      productId,
      productName,
      price,
      quantity,
      subtotal,
    })),
  };
}

async function loadItems(rows: TransactionRow[]) {
  if (!rows.length) return [];
  const items = await db
    .select()
    .from(transactionItems)
    .where(
      inArray(
        transactionItems.transactionId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(asc(transactionItems.position));
  const grouped = new Map<string, ItemRow[]>();
  for (const item of items) {
    const group = grouped.get(item.transactionId) ?? [];
    group.push(item);
    grouped.set(item.transactionId, group);
  }
  return rows.map((row) => toTransaction(row, grouped.get(row.id) ?? []));
}

export async function findTransactions({ page, limit, search }: { page: number; limit: number; search: string }) {
  // strpos preserves literal substring matching, including client '%' and '_' characters.
  const term = search.trim().toLowerCase();
  const where = and(
    isNull(transactions.deletedAt),
    term
      ? or(
          sql`strpos(lower(${transactions.invoiceNumber}), ${term}) > 0`,
          sql`strpos(lower(${transactions.userName}), ${term}) > 0`,
        )
      : undefined,
  );
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(where)
      .orderBy(desc(transactions.createdAt), asc(transactions.id))
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(transactions)
      .where(where),
  ]);
  return { data: await loadItems(rows), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function findTransactionById(id: string) {
  const rows = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), isNull(transactions.deletedAt)))
    .limit(1);
  return (await loadItems(rows))[0] ?? null;
}

export async function insertTransactionWithItems(
  productIds: string[],
  // eslint-disable-next-line no-unused-vars -- Parameter name documents the callback type.
  prepare: (currentProducts: ProductRow[]) => PreparedTransaction,
) {
  return withTransactionDatabase((database) =>
    database.transaction(async (tx) => {
      // SHARE blocks concurrent price/name updates and soft deletes until snapshots commit.
      const currentProducts = await tx
        .select()
        .from(products)
        .where(and(inArray(products.id, productIds), isNull(products.deletedAt)))
        .orderBy(asc(products.id))
        .for('share');
      const prepared = prepare(currentProducts);
      const [transaction] = await tx.insert(transactions).values(prepared.transaction).returning();
      const items = await tx
        .insert(transactionItems)
        .values(
          prepared.items.map((item, position) => ({
            ...item,
            transactionId: transaction.id,
            position,
          })),
        )
        .returning();
      return toTransaction(transaction, items);
    }),
  );
}
