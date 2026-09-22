import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { BaseParams } from '@/types/base';
import { getTransactionById, getTransactions } from '../api/transaction.api';

export function useGetTransactions(params: BaseParams) {
  return useQuery({
    queryKey: ['transactions', params.page, params.limit, params.search],
    queryFn: () => getTransactions(params),
    placeholderData: keepPreviousData,
  });
}

export function useGetTransaction(id?: string) {
  return useQuery({
    queryKey: ['transactions', 'detail', id],
    queryFn: () => getTransactionById(id!),
    enabled: Boolean(id),
  });
}
