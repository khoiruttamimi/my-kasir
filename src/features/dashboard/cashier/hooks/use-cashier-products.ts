import { useQuery } from '@tanstack/react-query';
import { getProducts } from '@/features/dashboard/products/api/product.api';
import type { Pagination } from '@/models/pagination';
import type { Product } from '@/models/product';

export type CashierProduct = Pick<Product, 'id' | 'name' | 'price' | 'code'>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isCashierProduct(value: unknown): value is CashierProduct {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.name === 'string' &&
    (value.code === null || typeof value.code === 'string') &&
    isNonNegativeInteger(value.price)
  );
}

function isPagination(value: unknown): value is Pagination {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.page) &&
    value.page > 0 &&
    isNonNegativeInteger(value.limit) &&
    value.limit > 0 &&
    isNonNegativeInteger(value.total) &&
    isNonNegativeInteger(value.totalPages)
  );
}

export function useCashierProducts(
  { page, limit, search }: { page: number; limit: number; search: string },
  enabled: boolean,
) {
  const searchMode = 'name-or-code';
  const term = search.trim();

  return useQuery({
    queryKey: ['products', 'cashier', searchMode, term, page, limit],
    enabled,
    queryFn: async () => {
      const result: unknown = await getProducts({ searchMode, page, limit, search: term });
      if (
        !isRecord(result) ||
        !Array.isArray(result.data) ||
        !result.data.every(isCashierProduct) ||
        !isPagination(result.pagination) ||
        result.pagination.page !== page ||
        result.pagination.limit !== limit
      ) {
        throw new Error('Invalid cashier catalog response');
      }

      return { products: result.data, pagination: result.pagination };
    },
  });
}
