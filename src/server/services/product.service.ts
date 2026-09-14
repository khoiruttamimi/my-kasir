import 'server-only';

import type { Product } from '@/models/product';
import { readJson, writeJson } from '@/server/utils/json-storage';
import { paginate } from '../utils/paginate';

const FILE_NAME = 'products';

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

  const normalizedSearch = search.trim().toLowerCase();

  const filteredProducts = normalizedSearch
    ? products.filter((product) => product.name.toLowerCase().includes(normalizedSearch))
    : products;

  return paginate(filteredProducts, { page, limit });
}

export async function getProductById(id: string) {
  const products = await getData();

  return products.find((product) => product.id === id) ?? null;
}

export async function createProduct(payload: Pick<Product, 'name' | 'price' | 'stock'>) {
  const products = await getData();

  const now = new Date().toISOString();

  const product: Product = {
    id: crypto.randomUUID(),
    name: payload.name,
    price: payload.price,
    stock: payload.stock,
    createdAt: now,
    updatedAt: now,
  };

  products.push(product);

  await saveData(products);

  return product;
}

export async function updateProduct(id: string, payload: Partial<Pick<Product, 'name' | 'price' | 'stock'>>) {
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
}

export async function deleteProduct(id: string) {
  const products = await getData();

  const product = products.find((product) => product.id === id);

  if (!product) {
    return null;
  }

  const newProducts = products.filter((product) => product.id !== id);

  await saveData(newProducts);

  return product;
}
