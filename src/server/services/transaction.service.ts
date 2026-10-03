import 'server-only';

import { ApiError } from '@/utils/api';
import {
  findTransactionById,
  findTransactions,
  insertTransactionWithItems,
} from '@/server/repositories/transaction.repository';

export interface GetTransactionsParams {
  page?: number;
  limit?: number;
  search?: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_INTEGER = 2147483647;

function integer(value: unknown, field: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > MAX_INTEGER) {
    throw new ApiError(`${field} must be an integer between ${minimum} and ${MAX_INTEGER}`, 400);
  }
  return value;
}

export async function getTransactions({ page = 1, limit = 10, search = '' }: GetTransactionsParams = {}) {
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    !Number.isSafeInteger((page - 1) * limit)
  ) {
    throw new ApiError('Page and limit must be positive integers', 400);
  }
  return findTransactions({ page, limit, search });
}

export async function getTransactionById(id: string) {
  if (!UUID_PATTERN.test(id)) return null;
  return findTransactionById(id);
}

export async function createTransaction(body: unknown, cashier: { id: string; name?: string | null }) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError('Request body must be an object', 400);
  }
  const payload = body as Record<string, unknown>;
  if (!Array.isArray(payload.items) || !payload.items.length) {
    throw new ApiError('items must be a non-empty array', 400);
  }
  const seen = new Set<string>();
  const requestedItems = payload.items.map((item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item))
      throw new ApiError('Each item must be an object', 400);
    const { productId, quantity } = item as Record<string, unknown>;
    if (typeof productId !== 'string' || !UUID_PATTERN.test(productId))
      throw new ApiError('productId must be a UUID', 400);
    const id = productId.toLowerCase();
    if (seen.has(id)) throw new ApiError('Each product must appear only once', 400);
    seen.add(id);
    return { productId: id, quantity: integer(quantity, 'quantity', 1) };
  });
  const paymentMethod = payload.paymentMethod;
  if (paymentMethod !== 'cash' && paymentMethod !== 'qris')
    throw new ApiError('paymentMethod must be cash or qris', 400);
  const paidAmount = integer(payload.paidAmount, 'paidAmount');
  if (!cashier.id || cashier.id.length > 255 || !cashier.name?.trim() || cashier.name.length > 255) {
    throw new ApiError('Authenticated cashier must have an ID and name', 400);
  }
  const userName = cashier.name;
  return insertTransactionWithItems(
    requestedItems.map((item) => item.productId),
    (currentProducts) => {
      const byId = new Map(currentProducts.map((product) => [product.id, product]));
      const items = requestedItems.map(({ productId, quantity }) => {
        const product = byId.get(productId);
        if (!product) throw new ApiError(`Product ${productId} does not exist or is inactive`, 400);
        const price = integer(product.price, 'Product price');
        return {
          productId,
          productName: product.name,
          price,
          quantity,
          subtotal: integer(price * quantity, 'Item subtotal'),
        };
      });
      const total = integer(
        items.reduce((sum, item) => sum + item.subtotal, 0),
        'Transaction total',
      );
      if (paidAmount < total) throw new ApiError('paidAmount must cover the transaction total', 400);
      if (paymentMethod === 'qris' && paidAmount !== total)
        throw new ApiError('QRIS paidAmount must equal the transaction total', 400);
      return {
        transaction: {
          subtotal: total,
          total,
          paymentMethod,
          paidAmount,
          changeAmount: paidAmount - total,
          userId: cashier.id,
          userName,
        },
        items,
      };
    },
  );
}
