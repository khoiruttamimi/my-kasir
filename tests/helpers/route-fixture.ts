import type { Session } from 'next-auth';
import { NextRequest } from 'next/server';
import { loadSource } from './load-source';

export const { ApiError } = loadSource<typeof import('@/utils/api')>('src/utils/api.ts');

export function routeFixture() {
  let session: Session | null = {
    user: { id: 'cashier-1', name: 'Cashier', email: 'cashier@example.com', role: 'admin' },
    expires: '2099-01-01T00:00:00.000Z',
  };
  const { withAuth } = loadSource<typeof import('@/server/auth/with-auth')>('src/server/auth/with-auth.ts', {
    '@/auth': { auth: async () => session },
  });
  const responses = loadSource<typeof import('@/server/utils/api')>('src/server/utils/api.ts', {
    '@/utils/api': { ApiError },
  });
  return {
    dependencies: { '@/server/auth/with-auth': { withAuth }, '@/server/utils/api': responses },
    setRole(role: Session['user']['role']) {
      if (session) session.user.role = role;
    },
    signOut() {
      session = null;
    },
  };
}

export const jsonRequest = (url: string, method: string, body: unknown) =>
  new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
