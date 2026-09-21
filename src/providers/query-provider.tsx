'use client';

import { ApiError } from '@/utils/api';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { signOut } from 'next-auth/react';
import { useState } from 'react';

type QueryProviderProps = {
  children: React.ReactNode;
};

export default function QueryProvider({ children }: QueryProviderProps) {
  let isLoggingOut = false;

  const handleUnauthorized = async (error: Error) => {
    if (!(error instanceof ApiError) || error.status !== 401 || isLoggingOut) {
      return;
    }

    isLoggingOut = true;

    try {
      await signOut({ redirectTo: '/auth/login' });
    } catch {
      isLoggingOut = false;
    }
  };

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: false,
          },
          mutations: {
            retry: false,
          },
        },
        queryCache: new QueryCache({
          onError: handleUnauthorized,
        }),

        mutationCache: new MutationCache({
          onError: handleUnauthorized,
        }),
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
