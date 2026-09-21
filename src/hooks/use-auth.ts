import { UserRole } from '@/models/user';
import { useSession } from 'next-auth/react';

export const useRoleChecking = () => {
  const { data, status } = useSession();

  return (role: UserRole) => status === 'authenticated' && data?.user?.role === role;
};
