import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  index,
  check,
  unique,
  uniqueIndex,
  pgSequence,
} from 'drizzle-orm/pg-core';
import type { UserRole } from '@/models/user';

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    password: varchar('password', { length: 60 }).notNull(),
    role: varchar('role', { length: 10 }).$type<UserRole>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    uniqueIndex('users_active_email_unique')
      .on(sql`lower(${table.email})`)
      .where(sql`${table.deletedAt} is null`),
    index('users_created_at_idx').on(table.createdAt),
    check('users_role_check', sql`${table.role} in ('admin', 'cashier')`),
  ],
);

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  price: integer('price').notNull(),
  stock: integer('stock').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { mode: 'string' }),
});

export const transactionInvoiceSequence = pgSequence('transaction_invoice_seq', { startWith: 1 });

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    invoiceNumber: varchar('invoice_number', { length: 100 })
      .notNull()
      .unique()
      .default(
        sql`'INV-' || to_char(now() at time zone 'Asia/Jakarta', 'YYYYMMDD') || '-' || format_transaction_invoice_counter(nextval('transaction_invoice_seq'))`,
      ),
    subtotal: integer('subtotal').notNull(),
    total: integer('total').notNull(),
    paymentMethod: varchar('payment_method', { length: 10 }).$type<'cash' | 'qris'>().notNull(),
    paidAmount: integer('paid_amount').notNull(),
    changeAmount: integer('change_amount').notNull(),
    // Preserve legacy and development cashier IDs alongside historical name snapshots.
    userId: varchar('user_id', { length: 255 }).notNull(),
    userName: varchar('user_name', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index('transactions_created_at_idx').on(table.createdAt),
    check('transactions_payment_method_check', sql`${table.paymentMethod} in ('cash', 'qris')`),
    check(
      'transactions_amounts_check',
      sql`${table.subtotal} >= 0 and ${table.total} = ${table.subtotal} and ${table.paidAmount} >= ${table.total} and ${table.changeAmount} = ${table.paidAmount} - ${table.total}`,
    ),
  ],
);

export const transactionItems = pgTable(
  'transaction_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'restrict' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    productName: varchar('product_name', { length: 255 }).notNull(),
    price: integer('price').notNull(),
    quantity: integer('quantity').notNull(),
    subtotal: integer('subtotal').notNull(),
    position: integer('position').notNull(),
  },
  (table) => [
    index('transaction_items_product_id_idx').on(table.productId),
    unique('transaction_items_transaction_position_unique').on(table.transactionId, table.position),
    check(
      'transaction_items_amounts_check',
      sql`${table.price} >= 0 and ${table.quantity} > 0 and ${table.subtotal} = ${table.price}::bigint * ${table.quantity} and ${table.position} >= 0`,
    ),
  ],
);
