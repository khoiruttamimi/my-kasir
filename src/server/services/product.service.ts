import 'server-only';

import { ApiError } from '@/utils/api';
import type { Product } from '@/models/product';
import {
  deleteProductById,
  findProductById,
  findProducts,
  insertProduct,
  updateProductById,
} from '../repositories/product.repository';

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

type ProductInput = Pick<Product, 'name' | 'category' | 'price' | 'stock'>;

function validateProductPayload(payload: unknown, partial = false): Partial<ProductInput> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ApiError('Request body must be an object', 400);
  }

  const body = payload as Record<string, unknown>;
  const result: Partial<ProductInput> = {};
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

  return insertProduct(payload);
}

export async function updateProduct(id: string, body: unknown) {
  const payload = validateProductPayload(body, true);

  return updateProductById(id, payload);
}

export async function deleteProduct(id: string) {
  return deleteProductById(id);
}
