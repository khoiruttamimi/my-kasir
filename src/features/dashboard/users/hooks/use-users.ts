import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createUser, deleteUser, getUsers, updateUser } from '../api/user.api';
import { BaseParams } from '@/types/base';

export function useGetUsers(params: BaseParams, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ['users', params.page, params.limit, params.search],
    queryFn: () => getUsers(params),
    placeholderData: keepPreviousData,
  });
}

export const useCreateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateUser,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'detail', variables.id] });
    },
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};
