import { Pagination } from '@/models/pagination';

export type BaseParams = {
  page?: number;
  limit?: number;
  search?: string;
};

export type BaseResponse<T> = {
  data: T;
  pagination?: Pagination;
};
