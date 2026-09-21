import { auth } from '@/auth';
import styles from './styles.module.scss';
import { redirect } from 'next/navigation';

export default async function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  if (session) {
    redirect('/');
  }

  return <div className={styles.authWrapper}>{children}</div>;
}
