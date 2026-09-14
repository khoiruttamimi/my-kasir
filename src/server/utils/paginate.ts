import { Pagination } from '@/models/pagination';

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: Pagination;
}

export function paginate<T>(data: T[], { page = 1, limit = 10 }: PaginationParams = {}): PaginatedResult<T> {
  const safePage = Math.max(page, 1);
  const safeLimit = Math.max(limit, 1);

  const start = (safePage - 1) * safeLimit;
  const end = start + safeLimit;

  return {
    data: data.slice(start, end),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: data.length,
      totalPages: Math.ceil(data.length / safeLimit),
    },
  };
}
