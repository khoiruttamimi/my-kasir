import 'server-only';

import type { Transaction } from '@/models/transaction';
import { readJson } from '@/server/utils/json-storage';
import { paginate } from '@/server/utils/paginate';
import { ApiError } from '@/utils/api';

const FILE_NAME = 'transactions';

async function getData() {
  return readJson<Transaction[]>(FILE_NAME);
}

export interface GetTransactionsParams {
  page?: number;
  limit?: number;
  search?: string;
}

export async function getTransactions({ page = 1, limit = 10, search = '' }: GetTransactionsParams = {}) {
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1) {
    throw new ApiError('Page and limit must be positive integers', 400);
  }

  const transactions = await getData();
  const normalizedSearch = search.trim().toLowerCase();
  const filteredTransactions = transactions.filter(
    (transaction) =>
      transaction.invoiceNumber.toLowerCase().includes(normalizedSearch) ||
      transaction.userName.toLowerCase().includes(normalizedSearch),
  );
  const sortedTransactions = filteredTransactions.toSorted(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return paginate(sortedTransactions, { page, limit });
}

export async function getTransactionById(id: string) {
  const transactions = await getData();
  return transactions.find((transaction) => transaction.id === id) ?? null;
}
