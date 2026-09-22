import type { User, UserResponse } from '@/models/user';
import type { BaseParams, BaseResponse } from '@/types/base';
import { fetcher } from '@/utils/api';

export type CreateUserPayload = Omit<User, 'id'>;
export type UpdateUserPayload = { id: string } & Partial<CreateUserPayload>;

export function getUsers(params: BaseParams): Promise<BaseResponse<UserResponse[]>> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.search) searchParams.set('search', params.search);
  return fetcher(`/api/users?${searchParams.toString()}`);
}

export function createUser(payload: CreateUserPayload): Promise<UserResponse> {
  return fetcher('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function updateUser({ id, ...payload }: UpdateUserPayload): Promise<BaseResponse<UserResponse>> {
  return fetcher(`/api/users/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function deleteUser(id: string): Promise<UserResponse> {
  return fetcher(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
