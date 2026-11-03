import { loadSource } from './load-source';
export const { ApiError } = loadSource<typeof import('@/utils/api')>('src/utils/api.ts');
export const id = '11111111-1111-4111-8111-111111111111';
export const otherId = '22222222-2222-4222-8222-222222222222';
export const input = (code = 'AbC001') => ({ name: 'Tea', category: 'Minuman', price: 10000, stock: 5, code });
type ProductRecord = Pick<
  import('@/models/product').Product,
  'id' | 'name' | 'category' | 'price' | 'stock' | 'code'
> & {
  deletedAt?: string | null;
  createdAt?: string;
};
interface SetupOptions {
  records?: ProductRecord[];
  failure?: unknown;
  sequenceFailure?: unknown;
  sequence?: string[];
  guardedMiss?: boolean;
  afterMiss?: (records: ProductRecord[]) => void; // eslint-disable-line no-unused-vars -- Parameter names document test callback types.
}
export function setup(options: SetupOptions = {}) {
  const records = options.records ?? [];
  const calls = { inserts: 0, updates: 0, generated: 0, lookup: [] as { code: string; excludeId?: string }[] };
  const repository = {
    nextProductCodeValue: async () => {
      const position = calls.generated++;
      if (options.sequenceFailure) throw options.sequenceFailure;
      return options.sequence ? (options.sequence[position] ?? null) : String(position);
    },
    findProducts: async () => ({ data: records.filter((row) => !row.deletedAt), pagination: {} }),
    findProductById: async (productId: string) => records.find((row) => row.id === productId && !row.deletedAt) ?? null,
    findProductByCode: async (code: string, excludeId?: string) => {
      calls.lookup.push({ code, excludeId });
      return records.find((row) => row.id !== excludeId && row.code?.toLowerCase() === code.toLowerCase()) ?? null;
    },
    insertProduct: async (data: import('@/models/product').CreateProductPayload) => {
      calls.inserts++;
      if (options.failure) throw options.failure;
      const row = { ...data, id };
      records.push(row);
      return row;
    },
    updateProductById: async (productId: string, data: Partial<import('@/models/product').CreateProductPayload>) => {
      calls.updates++;
      if (options.failure) throw options.failure;
      if (options.guardedMiss) {
        options.afterMiss?.(records);
        return null;
      }
      const row = records.find((entry) => entry.id === productId && !entry.deletedAt);
      if (!row || (data.code === undefined && row.code === null)) return null;
      Object.assign(row, data);
      return row;
    },
    deleteProductById: async (productId: string) => {
      const row = records.find((entry) => entry.id === productId && !entry.deletedAt);
      if (!row) return null;
      row.deletedAt = '2026-10-14';
      return row;
    },
  };
  const service = loadSource<typeof import('@/server/services/product.service')>(
    'src/server/services/product.service.ts',
    {
      'server-only': {},
      '@/utils/api': { ApiError },
      '../repositories/product.repository': repository,
      '../utils/product-code': loadSource<typeof import('@/server/utils/product-code')>(
        'src/server/utils/product-code.ts',
      ),
    },
  );
  return { service, records, calls };
}
export const status = (value: number, message?: string) => (error: unknown) =>
  error instanceof ApiError && error.status === value && (message === undefined || error.message === message);
