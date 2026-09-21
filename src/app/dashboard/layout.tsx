import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import DashboardLayout from '@/components/dashboard-layout';
import { SessionProvider } from 'next-auth/react';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session) {
    redirect('/auth/login');
  }

  return (
    <SessionProvider session={session}>
      <DashboardLayout>{children}</DashboardLayout>
    </SessionProvider>
  );
}
