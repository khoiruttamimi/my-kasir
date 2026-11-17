/** @jest-environment jsdom */
import '@testing-library/jest-dom/jest-globals';
import { afterEach, beforeAll, beforeEach, expect, test } from '@jest/globals';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import DashboardLayout from '@/components/dashboard-layout';
import { getProducts } from '@/features/dashboard/products/api/product.api';
import CashierContainer from './container';

let pathname = '/dashboard/cashier';
let viewportWidth = 1440;

jest.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Kasir Uji', role: 'cashier' } }, status: 'authenticated' }),
}));
jest.mock('@/features/dashboard/products/api/product.api', () => ({ getProducts: jest.fn() }));

// Rendering the full Ant Design shell and resolving accessibility roles is slow in jsdom.
jest.setTimeout(20_000);

const catalog = jest.mocked(getProducts);
const product = {
  id: 'coffee',
  name: 'Kopi',
  code: '00123',
  price: 12000,
  category: 'Minuman',
  stock: 0,
  createdAt: '',
  updatedAt: '',
};

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn((media: string) => {
      const min = /min-width:\s*(\d+)/.exec(media);
      const max = /max-width:\s*(\d+(?:\.\d+)?)/.exec(media);
      return {
        media,
        matches: (!min || viewportWidth >= Number(min[1])) && (!max || viewportWidth <= Number(max[1])),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      };
    }),
  });
});

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  pathname = '/dashboard/cashier';
  viewportWidth = 1440;
  catalog.mockReset();
  jest.useRealTimers();
});

function mountDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  catalog.mockResolvedValue({ data: [product], pagination: { page: 1, limit: 24, total: 1, totalPages: 1 } });
  const tree = () => (
    <QueryClientProvider client={client}>
      <App>
        <DashboardLayout>
          {pathname === '/dashboard/cashier' ? <CashierContainer /> : <h1>Halaman produk</h1>}
        </DashboardLayout>
      </App>
    </QueryClientProvider>
  );
  const view = render(tree());
  return {
    navigate(nextPath: string) {
      pathname = nextPath;
      view.rerender(tree());
    },
  };
}

const searchInput = () => screen.getByRole('textbox', { name: 'Cari nama atau kode produk' });
const cart = () => within(screen.getByRole('region', { name: 'Keranjang' }));

async function chooseSearch(value: string) {
  fireEvent.change(searchInput(), { target: { value } });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(250);
  });
  return screen.findByRole('button', { name: /^Kopi.*00123/ });
}

test('focus mode preserves the same workspace and restores the prior dashboard sidebar state', async () => {
  mountDashboard();
  expect(screen.getByRole('banner')).toBeInTheDocument();
  expect(screen.getByRole('menu')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Tutup sidebar' }));
  expect(screen.getByRole('button', { name: 'Buka sidebar' })).toHaveAttribute('aria-expanded', 'false');

  const search = searchInput();
  const card = await chooseSearch('Kopi');
  fireEvent.click(card);
  fireEvent.click(cart().getByRole('button', { name: 'Tambah jumlah Kopi' }));
  expect(cart().getByText(/^Rp\s*24\.000$/)).toBeInTheDocument();

  const toggle = screen.getByRole('button', { name: 'Layar penuh' });
  toggle.focus();
  await act(async () => fireEvent.click(toggle));
  expect(screen.getByRole('button', { name: 'Keluar layar penuh' })).toBe(toggle);
  expect(toggle).toHaveFocus();
  expect(screen.queryByRole('banner', { hidden: true })).not.toBeInTheDocument();
  expect(screen.queryByRole('menu', { hidden: true })).not.toBeInTheDocument();
  expect(searchInput()).toBe(search);
  expect(search).toHaveValue('Kopi');
  expect(screen.getByRole('button', { name: /^Kopi.*00123/ })).toBe(card);
  expect(cart().getByText(/^Rp\s*24\.000$/)).toBeInTheDocument();
  expect(screen.getByText('2 item')).toBeInTheDocument();

  await act(async () => fireEvent.click(toggle));
  expect(screen.getByRole('button', { name: 'Layar penuh' })).toBe(toggle);
  expect(toggle).toHaveFocus();
  expect(screen.getByRole('banner')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Buka sidebar' })).toHaveAttribute('aria-expanded', 'false');
  expect(searchInput()).toBe(search);
  expect(screen.getByText('2 item')).toBeInTheDocument();
});

test('opening and closing the sidebar at 375 px keeps the cashier mounted and allows a shortcut to the cart', async () => {
  viewportWidth = 375;
  mountDashboard();
  const search = searchInput();
  const card = await chooseSearch('001');
  fireEvent.click(card);

  fireEvent.click(screen.getByRole('button', { name: 'Buka sidebar' }));
  expect(screen.getByRole('menu')).toBeInTheDocument();
  expect(searchInput()).toBe(search);
  fireEvent.click(screen.getByRole('button', { name: 'Tutup sidebar' }));
  expect(searchInput()).toBe(search);
  expect(search).toHaveValue('001');
  expect(screen.getByText('1 item')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Layar penuh' }));
  expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Keluar layar penuh' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: /Lihat keranjang/ }));
  expect(screen.getByRole('heading', { name: 'Keranjang' })).toHaveFocus();
  fireEvent.click(cart().getByRole('button', { name: 'Tambah jumlah Kopi' }));
  expect(screen.getByText('2 item')).toBeInTheDocument();
});

test('leaving the cashier restores the shell and returning starts in normal mode', async () => {
  const { navigate } = mountDashboard();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Layar penuh' })));
  await act(async () => navigate('/dashboard/products'));
  expect(screen.getByRole('heading', { name: 'Halaman produk' })).toBeInTheDocument();
  expect(screen.getByRole('banner')).toBeInTheDocument();
  expect(screen.getByRole('menu')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Keluar layar penuh' })).not.toBeInTheDocument();

  await act(async () => navigate('/dashboard/cashier'));
  expect(screen.getByRole('banner')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Layar penuh' })).toBeEnabled();
});
