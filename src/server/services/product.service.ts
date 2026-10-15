import 'server-only';

import { ApiError } from '@/utils/api';
import type { CreateProductPayload } from '@/models/product';
import {
  deleteProductById,
  findProductById,
  findProductByCode,
  findProducts,
  insertProduct,
  updateProductById,
  nextProductCodeValue,
} from '../repositories/product.repository';
import { formatInternalProductCode } from '../utils/product-code';

export interface GetProductsParams {
  page?: number;
  limit?: number;
  search?: string;
}

export async function getProducts({ page = 1, limit = 10, search = '' }: GetProductsParams = {}) {
  return findProducts({
    page,
    limit,
    search,
  });
}

export async function getProductById(id: string) {
  return findProductById(id);
}

type ProductInput = CreateProductPayload;

function validateCode(value: unknown): string {
  if (value === undefined || (typeof value === 'string' && !value.trim())) {
    throw new ApiError('Product Code is required', 400);
  }
  if (typeof value !== 'string') throw new ApiError('Product Code must be a string', 400);
  const code = value.trim();
  if (!/^[A-Za-z0-9]{1,100}$/.test(code)) {
    throw new ApiError('Product Code must contain 1–100 letters or digits', 400);
  }
  return code;
}

async function withCodeConflict<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    let current: unknown = error;
    const seen = new Set<unknown>();
    while (current && typeof current === 'object' && !seen.has(current)) {
      seen.add(current);
      const details = current as { code?: string; constraint?: string; cause?: unknown };
      if (details.code === '23505' && details.constraint === 'products_code_unique') {
        throw new ApiError('Product code is already in use', 409);
      }
      current = details.cause;
    }
    throw error;
  }
}

function validateProductPayload(payload: unknown, partial = false): Partial<ProductInput> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ApiError('Request body must be an object', 400);
  }

  const body = payload as Record<string, unknown>;
  const result: Partial<ProductInput> = {};
  if (!partial || 'code' in body) result.code = validateCode(body.code);
  for (const field of ['name', 'category'] as const) {
    if (partial && !(field in body)) continue;
    const value = body[field];
    if (typeof value !== 'string' || !value.trim()) {
      throw new ApiError(`${field} is required and must be a non-empty string`, 400);
    }
    result[field] = value;
  }
  for (const field of ['price', 'stock'] as const) {
    if (partial && !(field in body)) continue;
    const value = Number(body[field]);
    if (Number.isNaN(value) || !Number.isFinite(value) || value < 0) {
      throw new ApiError(`${field} must be a non-negative number`, 400);
    }
    result[field] = value;
  }
  if (!Object.keys(result).length) {
    throw new ApiError('At least one product field is required', 400);
  }
  return result;
}

export async function createProduct(body: unknown) {
  const payload = validateProductPayload(body) as ProductInput;

  if (await findProductByCode(payload.code)) throw new ApiError('Product code is already in use', 409);
  return withCodeConflict(() => insertProduct(payload));
}

export async function updateProduct(id: string, body: unknown) {
  const payload = validateProductPayload(body, true);
  if (payload.code !== undefined) {
    if (!(await findProductById(id))) return null;
    if (await findProductByCode(payload.code, id)) throw new ApiError('Product code is already in use', 409);
  }
  const updated = await withCodeConflict(() => updateProductById(id, payload));
  if (updated || payload.code !== undefined) return updated;
  // A failed guard is not retried: another request may have assigned a code in the meantime.
  const current = await findProductById(id);
  if (!current) return null;
  if (current.code === null) throw new ApiError('Product Code is required', 400);
  throw new ApiError('Product Code was assigned by another request. Refresh and retry manually.', 409);
}

export async function deleteProduct(id: string) {
  return deleteProductById(id);
}

export async function generateProductCode(): Promise<string> {
  for (let attempt = 0; attempt < 32; attempt++) {
    const value = await nextProductCodeValue();
    if (value === null) {
      throw new ApiError('Internal product code generation range is exhausted. Enter a code manually.', 503);
    }
    const code = formatInternalProductCode(value);
    if (!(await findProductByCode(code))) return code;
  }
  throw new ApiError('Unable to generate an unused product code. Try again or enter a code manually.', 503);
}
