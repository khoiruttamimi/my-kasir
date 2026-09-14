import type { Product } from '@/models/product';
import { BaseParams, BaseResponse } from '@/types/base';

export async function getProducts(params: BaseParams): Promise<BaseResponse<Product[]>> {
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

  const response = await fetch(`/api/products?${searchParams.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch products');
  }

  return response.json();
}
