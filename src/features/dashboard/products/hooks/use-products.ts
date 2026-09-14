import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { getProducts } from '../api/product.api';
import { BaseParams } from '@/types/base';

export function useProducts(params: BaseParams) {
  return useQuery({
    queryKey: ['products', params.page, params.limit, params.search],
    queryFn: () => getProducts(params),
    placeholderData: keepPreviousData,
  });
}
