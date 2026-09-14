import '@ant-design/v5-patch-for-react-19';
import './globals.css';
import type { Metadata } from 'next';
import { Quicksand } from 'next/font/google';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { ConfigProvider } from 'antd';
import QueryProvider from '@/providers/query-provider';

const quickSand = Quicksand({ subsets: ['latin'] });

export const metadata: Metadata = { title: 'My Kasir', description: 'My Kasir for everyone' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={quickSand.className}>
        <AntdRegistry>
          <ConfigProvider
            theme={{
              token: { ...quickSand.style, colorPrimary: '#89986D' },
              components: {
                Layout: { siderBg: '#89986D' },
                Menu: { colorBgContainer: '#89986D' },
              },
            }}
          >
            <QueryProvider>{children}</QueryProvider>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
