import type { Product } from '@/models/product';
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

export const createProduct = (payload: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
  return fetcher('/api/products', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
};

export const updateProduct = ({ id, ...payload }: Product) => {
  return fetcher(`/api/products/${encodeURIComponent(id)}`, {
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
