import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getProducts } from '@/features/dashboard/products/api/product.api';
import type { Pagination } from '@/models/pagination';
import type { Product } from '@/models/product';

export type CashierProduct = Pick<Product, 'id' | 'name' | 'price' | 'code'>;

const SCAN_TIMEOUT_MS = 10_000;

export class ScanLookupTimeout extends Error {}

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

function parseCashierProducts(result: unknown, page: number, limit: number) {
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
      const result = await getProducts({ searchMode, page, limit, search: term });
      return parseCashierProducts(result, page, limit);
    },
  });
}

async function readExactProduct(code: string, controller: AbortController): Promise<CashierProduct | null> {
  const { signal } = controller;
  if (signal.aborted) throw signal.reason;

  let rejectOnAbort: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    rejectOnAbort = () => reject(signal.reason);
    signal.addEventListener('abort', rejectOnAbort, { once: true });
  });
  const timer = setTimeout(() => controller.abort(new ScanLookupTimeout()), SCAN_TIMEOUT_MS);
  try {
    const result = await Promise.race([
      getProducts({ searchMode: 'exact-code', page: 1, limit: 1, search: code }, { cache: 'no-store', signal }),
      aborted,
    ]);
    const { products, pagination } = parseCashierProducts(result, 1, 1);
    const product = products[0];
    if (
      products.length > 1 ||
      pagination.total !== products.length ||
      pagination.totalPages !== products.length ||
      (product && product.code?.toLowerCase() !== code.toLowerCase())
    ) {
      throw new Error('Invalid exact code response');
    }
    return product ?? null;
  } finally {
    clearTimeout(timer);
    if (rejectOnAbort) signal.removeEventListener('abort', rejectOnAbort);
  }
}

export function useCashierCodeLookup() {
  const queryClient = useQueryClient();

  return (code: string, controller: AbortController) =>
    queryClient.fetchQuery({
      queryKey: ['products', 'cashier', 'exact-code', code, 1, 1],
      queryFn: () => readExactProduct(code, controller),
      networkMode: 'always',
      staleTime: 0,
      gcTime: 0,
      retry: false,
    });
}
