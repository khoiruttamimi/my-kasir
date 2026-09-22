import type { Transaction } from '@/models/transaction';
import type { BaseParams, BaseResponse } from '@/types/base';
import { fetcher } from '@/utils/api';

export function getTransactions(params: BaseParams): Promise<BaseResponse<Transaction[]>> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.search) searchParams.set('search', params.search);
  return fetcher(`/api/transactions?${searchParams.toString()}`);
}

export function getTransactionById(id: string): Promise<Transaction> {
  return fetcher(`/api/transactions/${encodeURIComponent(id)}`);
}
