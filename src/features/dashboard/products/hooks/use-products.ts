import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createProduct, deleteProduct, getProducts, updateProduct } from '../api/product.api';
import { BaseParams } from '@/types/base';

export function useGetProducts(params: BaseParams) {
  return useQuery({
    queryKey: ['products', params.page, params.limit, params.search],
    queryFn: () => getProducts(params),
    placeholderData: keepPreviousData,
  });
}

export const useCreateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProduct,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products', 'detail', variables.id] });
    },
  });
};

export const useDeleteProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};
