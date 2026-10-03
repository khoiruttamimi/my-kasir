# Transaction database migration

Transaction now follows API → service → repository → Drizzle → Neon. Product's
HTTP connection and soft-delete behavior are unchanged. Transaction creation uses
an operation-scoped Neon WebSocket pool with the same `DATABASE_URL` because it
requires an interactive transaction. The pool closes after commit or rollback.

## Apply after SQL review

Review `drizzle/0002_ambiguous_ronan.sql` and the subsequent invoice-counter migrations, then run:

```sh
pnpm db:migrate
```

No database migration or database writes were run during implementation. Older
migration files were not changed. Verify the existing Product migrations are
already recorded in the target database before applying pending migrations.

The new tables are `transactions` and `transaction_items`. Both use generated
UUID primary keys. Items reference both transactions and products with
`ON DELETE RESTRICT`; soft-deleted products remain valid references. Each item
stores its purchased product name, price, quantity, subtotal, and ordering.
Transactions include a nullable `deleted_at`; reads exclude deleted rows. There
is no delete endpoint. `user_id` remains text to preserve legacy and development cashier IDs; User
accounts now have their own database migration and import workflow.

Invoice counters use `lpad(..., 6, '0')`; values above six digits are preserved
without truncation. Invoice counters continue across days and may have gaps after a rollback. Existing
invoices are unchanged. If importing historical counter invoices, advance
`transaction_invoice_seq` above the highest imported counter before accepting
new transactions.

## Existing history

Runtime Transaction code no longer reads `src/server/data/transactions.json`.
That file is retained as a historical import source. Applying the schema migration
alone creates empty transaction tables; it does not import JSON history.

Before switching production traffic, prepare an explicit mapping from each
legacy JSON product ID (including IDs such as `1`, `5`, and `15`) to its actual
UUID in the existing Product table. Do not infer identity from names or silently
create replacement products. For unmatched products, reconcile the mapping
before importing. Soft-deleted Product rows can be referenced by historical
imports. Preserve transaction UUIDs, invoice numbers, cashier snapshots,
timestamps, payment amounts, item order, and all original item snapshot values.
Do not reprice history with today's Product values or import history through the
new creation endpoint. Insert each historical transaction and its mapped items
atomically, then verify record counts and monetary totals against the source.
Back up the original JSON before retiring it.

## Creation API

Authenticated `POST /api/transactions` accepts:

```json
{
  "items": [{ "productId": "existing-product-uuid", "quantity": 2 }],
  "paymentMethod": "cash",
  "paidAmount": 25000
}
```

Cashier ID/name come from the authenticated session. Client product names,
prices, subtotals, totals, invoice numbers, and cashier fields are ignored.
Products must be active and each product may appear only once. Quantities and
money must be integers within PostgreSQL's integer range. Cash must cover the
total; QRIS must equal the total. The server generates a unique invoice using
`INV-YYYYMMDD-000001` (date in Asia/Jakarta, global PostgreSQL sequence). No stock mutation, discounts, taxes, update, or deletion were
added because the existing Transaction feature had no such behavior.

List/detail responses retain the existing Transaction model, including nested
items without internal item IDs or foreign-key metadata. Search remains a
trimmed, case-insensitive literal substring on invoice number or cashier name.
Pagination/counting runs in PostgreSQL, newest first; items are loaded only for
transactions on the requested page. Historical reads use snapshots without
joining active Products.

## Verification

```sh
pnpm exec tsc --noEmit
pnpm lint
node --test tests/transaction-service.test.mjs
```

Service tests mock the repository and cover snapshots, authoritative totals,
invalid/inactive products, quantity and overflow validation, payment validation,
and pagination. After applying SQL to a test database, verify creation and
rollback, foreign-key rejection of hard deletes, pagination/search, and history
after Product edits/soft deletes. Live Neon integration was intentionally not
run during this implementation.
