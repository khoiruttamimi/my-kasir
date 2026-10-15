import type { Product, CreateProductPayload, UpdateProductPayload } from '@/models/product';
import { BaseParams, BaseResponse } from '@/types/base';
import { fetcher } from '@/utils/api';

export function getProducts(params: BaseParams): Promise<BaseResponse<Product[]>> {
  const searchParams = new URLSearchParams();

  if (params.page) {
    searchParams.set('page', String(params.page));
  }

  if (params.limit) {
    searchParams.set('limit', String(params.limit));
  }

  if (params.search) {
    searchParams.set('search', params.search);
  }

  return fetcher(`/api/products?${searchParams.toString()}`);
}

export const createProduct = (payload: CreateProductPayload): Promise<Product> => {
  return fetcher<Product>('/api/products', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
};

export const updateProduct = ({ id, ...payload }: UpdateProductPayload): Promise<BaseResponse<Product>> => {
  return fetcher<BaseResponse<Product>>(`/api/products/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
};

export const deleteProduct = (id: string) => {
  return fetcher(`/api/products/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
};

export const generateProductCode = (): Promise<{ code: string }> => {
  return fetcher('/api/products/generate-code', { method: 'POST', cache: 'no-store' });
};
