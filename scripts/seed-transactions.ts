/* eslint-disable no-console -- Standalone seed command reports progress to the terminal. */
import 'dotenv/config';
import { randomInt } from 'node:crypto';

const TRANSACTION_COUNT = 15;
const MAX_INTEGER = 2147483647;
const cashier = { id: 'development-seed-cashier', name: 'Development Seed Cashier' };

function assertDevelopmentEnvironment() {
  if (
    process.env.NODE_ENV !== 'development' ||
    process.env.MYKASIR_ALLOW_DEV_SEED !== 'true' ||
    process.env.VERCEL_ENV === 'production' ||
    process.env.CONTEXT === 'production'
  ) {
    throw new Error(
      'Seed blocked: use a development database and explicitly set NODE_ENV=development and MYKASIR_ALLOW_DEV_SEED=true. Production environments are not allowed.',
    );
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required and must point to your development Neon database.');
  }
}

async function seedTransactions() {
  // Check before importing modules that initialize database connections.
  assertDevelopmentEnvironment();
  const { findProducts } = await import('../src/server/repositories/product.repository');
  const { createTransaction } = await import('../src/server/services/transaction.service');
  const { data: products } = await findProducts({ page: 1, limit: 100 });
  if (!products.length) {
    throw new Error('No active Products found. Seed or create Products in the development database first.');
  }

  console.log(`Creating ${TRANSACTION_COUNT} development transactions from ${products.length} active Products.`);
  console.log('Each run adds new transactions. Existing transactions and Product data are preserved.');
  let created = 0;
  try {
    for (let index = 0; index < TRANSACTION_COUNT; index++) {
      const available = [...products];
      const itemCount = randomInt(1, Math.min(5, available.length) + 1);
      const selected = Array.from({ length: itemCount }, () => {
        const [product] = available.splice(randomInt(available.length), 1);
        return { product, quantity: randomInt(1, 4) };
      });
      // Estimate tender using fetched prices. The service re-reads and locks active
      // Products, then calculates authoritative snapshots/subtotals/totals itself.
      const estimatedTotal = selected.reduce((sum, { product, quantity }) => sum + product.price * quantity, 0);
      const paymentMethod = index % 2 === 0 ? 'cash' : 'qris';
      const paidAmount = paymentMethod === 'cash' ? Math.ceil(estimatedTotal / 10000) * 10000 : estimatedTotal;
      if (!Number.isSafeInteger(paidAmount) || paidAmount < 0 || paidAmount > MAX_INTEGER) {
        throw new Error(
          'Selected Product prices exceed the supported payment range. Review development Product prices.',
        );
      }
      const transaction = await createTransaction(
        {
          items: selected.map(({ product, quantity }) => ({ productId: product.id, quantity })),
          paymentMethod,
          paidAmount,
        },
        cashier,
      );
      created++;
      console.log(
        `${created}/${TRANSACTION_COUNT}: ${transaction.invoiceNumber} (${paymentMethod}, Rp${transaction.total})`,
      );
    }
  } catch (error) {
    console.error(`Stopped after ${created} committed transactions. Each transaction and its items are atomic.`);
    throw error;
  }
  console.log(`Seed complete: ${created} transactions created for ${cashier.name}.`);
}

seedTransactions().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Transaction seed failed.');
  process.exitCode = 1;
});
