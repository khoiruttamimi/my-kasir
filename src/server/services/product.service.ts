import 'server-only';

import { ApiError } from '@/utils/api';
import type { Product } from '@/models/product';
import { readJson, writeJson } from '@/server/utils/json-storage';
import { createMutationQueue } from '../utils/mutation-queue';
import { paginate } from '../utils/paginate';

const FILE_NAME = 'products';
const mutate = createMutationQueue();

async function getData() {
  return readJson<Product[]>(FILE_NAME);
}

async function saveData(products: Product[]) {
  return writeJson(FILE_NAME, products);
}

export interface GetProductsParams {
  page?: number;
  limit?: number;
  search?: string;
}

export async function getProducts({ page = 1, limit = 10, search = '' }: GetProductsParams = {}) {
  const products = await getData();
  const sortedProducts = products.toSorted((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const normalizedSearch = search.trim().toLowerCase();

  const filteredProducts = normalizedSearch
    ? sortedProducts.filter((product) => product.name.toLowerCase().includes(normalizedSearch))
    : sortedProducts;

  return paginate(filteredProducts, { page, limit });
}

export async function getProductById(id: string) {
  const products = await getData();

  return products.find((product) => product.id === id) ?? null;
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

  return mutate(async () => {
    const products = await getData();

    const now = new Date().toISOString();

    const product: Product = {
      id: crypto.randomUUID(),
      name: payload.name,
      category: payload.category,
      price: payload.price,
      stock: payload.stock,
      createdAt: now,
      updatedAt: now,
    };

    products.push(product);

    await saveData(products);

    return product;
  });
}

export async function updateProduct(id: string, body: unknown) {
  const payload = validateProductPayload(body, true);
  return mutate(async () => {
    const products = await getData();

    const index = products.findIndex((product) => product.id === id);

    if (index === -1) {
      return null;
    }

    const product: Product = {
      ...products[index],
      ...payload,
      updatedAt: new Date().toISOString(),
    };

    products[index] = product;

    await saveData(products);

    return product;
  });
}

export async function deleteProduct(id: string) {
  return mutate(async () => {
    const products = await getData();

    const product = products.find((product) => product.id === id);

    if (!product) {
      return null;
    }

    const newProducts = products.filter((product) => product.id !== id);

    await saveData(newProducts);

    return product;
  });
}
