/** @jest-environment jsdom */
import '@testing-library/jest-dom/jest-globals';
import { afterEach, beforeAll, expect, test } from '@jest/globals';
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getMenus } from '@/components/dashboard-layout/util';
import { getProducts } from '@/features/dashboard/products/api/product.api';
import type { Product } from '@/models/product';
import CashierContainer from './container';
import { useCashierCart } from './hooks/use-cashier-cart';

const push = jest.fn();
let currentQuery = '';

jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/cashier',
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(currentQuery),
}));
jest.mock('@/features/dashboard/products/api/product.api', () => ({ getProducts: jest.fn() }));

const catalog = jest.mocked(getProducts);
const row = (name: string, code: string | null): Product => ({
  id: name,
  name,
  code,
  price: 12000,
  stock: 0,
  category: 'Minuman',
  createdAt: '',
  updatedAt: '',
});
const result = (product: Product, page = 1) => ({
  data: [product],
  pagination: { page, limit: 24, total: page === 2 ? 25 : 1, totalPages: page },
});

function deferredCatalog() {
  let resolve!: (response: ReturnType<typeof result>) => void;
  const promise = new Promise<ReturnType<typeof result>>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function renderCashier() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <CashierContainer />
    </QueryClientProvider>,
  );
}

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn((media: string) => ({
      matches: false,
      media,
      addListener: jest.fn(),
      removeListener: jest.fn(),
    })),
  });
});

afterEach(() => {
  currentQuery = '';
  catalog.mockReset();
});

test.each(['admin', 'cashier'] as const)('shows the nested Kasir menu for %s', (role) => {
  const menu = getMenus((candidate) => candidate === role);
  expect(menu[0]).toMatchObject({ key: '/dashboard/cashier', label: 'Kasir' });
});

test('only the current search is selectable, even when the older request returns last', async () => {
  const first = deferredCatalog();
  const second = deferredCatalog();
  catalog.mockImplementation(({ search }) => {
    if (search === 'A') return first.promise;
    if (search === 'B') return second.promise;
    return Promise.resolve(result(row('Awal', null)));
  });
  renderCashier();
  fireEvent.click(await screen.findByRole('button', { name: /^Awal/ }));
  expect(screen.getByText('1 item')).toBeInTheDocument();

  const search = screen.getByRole('textbox', { name: 'Cari nama atau kode produk' });
  fireEvent.change(search, { target: { value: ' A ' } });
  expect(screen.queryByRole('button', { name: /^Awal/ })).not.toBeInTheDocument();
  await waitFor(() =>
    expect(catalog).toHaveBeenCalledWith({ searchMode: 'name-or-code', search: 'A', page: 1, limit: 24 }),
  );
  fireEvent.change(search, { target: { value: 'B' } });
  await waitFor(() =>
    expect(catalog).toHaveBeenCalledWith({ searchMode: 'name-or-code', search: 'B', page: 1, limit: 24 }),
  );
  expect(screen.queryByRole('button', { name: /^(Awal|Hasil A)/ })).not.toBeInTheDocument();

  await act(async () => second.resolve(result(row('Hasil B', '00124'))));
  const current = await screen.findByRole('button', { name: /^Hasil B/ });
  await act(async () => first.resolve(result(row('Hasil A', '00123'))));
  expect(screen.queryByRole('button', { name: /^Hasil A/ })).not.toBeInTheDocument();
  fireEvent.click(current);
  expect(screen.getByText('2 item')).toBeInTheDocument();
  expect(screen.getByText('Hasil B ditambahkan.')).toBeInTheDocument();
});

test('uses the URL page, resets it for a new search, and keeps the count during retry', async () => {
  currentQuery = 'page=2&keep=yes';
  push.mockImplementation((url: string) => {
    currentQuery = url.split('?')[1] ?? '';
  });
  catalog
    .mockResolvedValueOnce(result(row('Halaman Dua', '00122'), 2))
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(result(row('Kopi', '00123')));
  renderCashier();
  fireEvent.click(await screen.findByRole('button', { name: /Halaman Dua/ }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Cari nama atau kode produk' }), { target: { value: 'Kopi' } });
  expect(push).toHaveBeenCalledWith('/dashboard/cashier?keep=yes');
  fireEvent.click(await screen.findByRole('button', { name: 'Coba lagi' }));
  expect(await screen.findByRole('button', { name: /Kopi/ })).toBeInTheDocument();
  expect(screen.getByText('1 item')).toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: 'Keranjang' })).getByText('Halaman Dua')).toBeInTheDocument();
  expect(catalog).toHaveBeenLastCalledWith({ searchMode: 'name-or-code', search: 'Kopi', page: 1, limit: 24 });
});

test('adding the same product keeps a single line and its initial name and price', () => {
  const { result: cart } = renderHook(useCashierCart);
  const product = row('Kopi', '00123');
  act(() => {
    cart.current.addProduct(product);
    cart.current.addProduct({ ...product, name: 'Kopi Baru', price: 15000 });
  });
  expect(cart.current.lines).toEqual([
    { productId: product.id, name: 'Kopi', unitPrice: 12000, quantity: 2, subtotal: 24000 },
  ]);
});

test('malformed catalog data surfaces a retry instead of showing selectable products', async () => {
  catalog.mockResolvedValueOnce(result({ ...row('Harga tidak valid', null), price: 1.5 }));
  renderCashier();
  expect(await screen.findByRole('alert')).toHaveTextContent('Gagal memuat produk.');
  expect(screen.queryByRole('button', { name: /Harga tidak valid/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeInTheDocument();
});
