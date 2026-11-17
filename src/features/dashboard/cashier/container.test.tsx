/** @jest-environment jsdom */
import '@testing-library/jest-dom/jest-globals';
import { afterEach, beforeEach, expect, test } from '@jest/globals';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CashierContainer from './container';

jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/cashier',
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const product = { id: 'coffee', name: 'Kopi', price: 12000, code: '00123' };
const response = (products: (typeof product)[], limit = 1) => ({
  ok: true,
  status: 200,
  json: async () => ({
    data: products,
    pagination: { page: 1, limit, total: products.length, totalPages: products.length },
  }),
});
const exact = jest.fn<Promise<Pick<Response, 'ok' | 'status' | 'json'>>, [url: URL, init?: RequestInit]>();
const request = (input: string, init?: RequestInit) => {
  const url = new URL(input, 'http://localhost');
  if (url.searchParams.get('searchMode') === 'exact-code') return exact(url, init);
  return Promise.resolve(response([product], 24));
};
const originalFetch = globalThis.fetch;

beforeEach(() => {
  jest.useFakeTimers();
  exact.mockReset();
  globalThis.fetch = request as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.useRealTimers();
});

function renderCashier() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <CashierContainer />
    </QueryClientProvider>,
  );
}

async function tick(ms = 1) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

const input = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'Cari nama atau kode produk' });
const cart = () => within(screen.getByRole('region', { name: 'Keranjang' }));
function scan(code: string) {
  const field = input();
  fireEvent.change(field, { target: { value: code } });
  fireEvent.keyDown(field, { key: 'Enter' });
}

test('a focused scan preserves leading zeros, adds to an existing line, and allows a fresh repeat scan', async () => {
  exact.mockImplementation(async () => response([product]));
  renderCashier();
  await tick();
  fireEvent.click(screen.getByRole('button', { name: /^Kopi.*00123/ }));
  expect(screen.getByText('1 item')).toBeInTheDocument();

  input().focus();
  scan(' 00123 ');
  await tick();
  expect(input()).toHaveValue('');
  expect(input()).toHaveFocus();
  expect(screen.getByText('2 item')).toBeInTheDocument();
  expect(cart().getAllByRole('listitem')).toHaveLength(1);
  expect(cart().getByText(/Subtotal Rp\s*24\.000/)).toBeInTheDocument();

  scan('00123');
  await tick();
  expect(exact).toHaveBeenCalledTimes(2);
  for (const [url, init] of exact.mock.calls) {
    expect(url.pathname).toBe('/api/products');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: '1',
      limit: '1',
      search: '00123',
      searchMode: 'exact-code',
    });
    expect(init?.cache).toBe('no-store');
  }
  expect(screen.getByText('3 item')).toBeInTheDocument();
});

test('unknown code retains the text, and blank, held Enter, IME, and other controls do not submit a scan', async () => {
  exact.mockResolvedValue(response([]));
  renderCashier();
  await tick();
  fireEvent.keyDown(input(), { key: 'Enter' });
  fireEvent.change(input(), { target: { value: '0012' } });
  fireEvent.keyDown(input(), { key: 'Enter', repeat: true });
  fireEvent.keyDown(input(), { key: 'Enter', isComposing: true });
  const clearCart = cart().getByRole('button', { name: 'Kosongkan keranjang' });
  fireEvent.keyDown(clearCart, { key: 'Enter' });
  expect(exact).not.toHaveBeenCalled();

  fireEvent.keyDown(input(), { key: 'Enter' });
  await tick();
  expect(exact).toHaveBeenCalledTimes(1);
  expect(input()).toHaveValue('0012');
  expect(input()).not.toHaveAttribute('readonly');
  expect(screen.getByText('Kode produk tidak ditemukan')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Coba lagi' })).not.toBeInTheDocument();
  expect(cart().queryByRole('listitem')).not.toBeInTheDocument();
});

test('aborts at 10 seconds, blocks duplicate submissions, and ignores late success after retry', async () => {
  let finishFirst!: (value: ReturnType<typeof response>) => void;
  exact.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishFirst = resolve;
      }),
  );
  exact.mockResolvedValueOnce(response([product]));
  renderCashier();
  await tick();
  input().focus();
  scan('00123');
  fireEvent.keyDown(input(), { key: 'Enter' });
  expect(input()).toHaveAttribute('readonly');
  expect(input()).toHaveFocus();
  expect(screen.getByText(/Pindai ulang kode/)).toBeInTheDocument();
  expect(exact).toHaveBeenCalledTimes(1);

  await tick(9999);
  expect(exact.mock.calls[0][1]?.signal?.aborted).toBe(false);
  await tick();
  expect(exact.mock.calls[0][1]?.signal?.aborted).toBe(true);
  expect(input()).not.toHaveAttribute('readonly');
  expect(input()).toHaveValue('00123');
  expect(screen.getByText('Pencarian kode melebihi batas waktu. Coba lagi.')).toBeInTheDocument();
  expect(cart().queryByRole('listitem')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
  await tick();
  expect(exact).toHaveBeenCalledTimes(2);
  expect(exact.mock.calls[1][0].searchParams.get('search')).toBe('00123');
  expect(screen.getByText('1 item')).toBeInTheDocument();
  await act(async () => finishFirst(response([product])));
  expect(screen.getByText('1 item')).toBeInTheDocument();
});

test('discards a second code while busy and does not steal focus when the first scan succeeds', async () => {
  let finishFirst!: (value: ReturnType<typeof response>) => void;
  const secondProduct = { ...product, id: 'tea', name: 'Teh', code: '00456' };
  exact.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishFirst = resolve;
      }),
  );
  exact.mockResolvedValueOnce(response([secondProduct]));
  renderCashier();
  await tick();
  fireEvent.click(screen.getByRole('button', { name: /^Kopi.*00123/ }));
  input().focus();
  scan('00123');
  scan('00456');
  expect(input()).toHaveValue('00123');
  expect(exact).toHaveBeenCalledTimes(1);

  const increase = cart().getByRole('button', { name: 'Tambah jumlah Kopi' });
  increase.focus();
  await act(async () => finishFirst(response([product])));
  expect(increase).toHaveFocus();
  expect(input()).toHaveValue('');
  expect(screen.getByText('2 item')).toBeInTheDocument();

  input().focus();
  scan('00456');
  await tick();
  expect(exact.mock.calls[1][0].searchParams.get('search')).toBe('00456');
  expect(cart().getByText('Teh')).toBeInTheDocument();
  expect(screen.getByText('3 item')).toBeInTheDocument();
});

test.each(['network', 'HTTP 500'] as const)('recovers from %s without retyping or adding on failure', async (kind) => {
  if (kind === 'network') exact.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  else
    exact.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ message: 'Internal Server Error' }) });
  exact.mockResolvedValueOnce(response([product]));
  renderCashier();
  scan('00123');
  await tick();

  expect(input()).not.toHaveAttribute('readonly');
  expect(input()).toHaveValue('00123');
  expect(
    screen.getByText(
      kind === 'network'
        ? 'Gagal mencari kode produk. Periksa koneksi dan coba lagi.'
        : 'Gagal mencari kode produk. Coba lagi.',
    ),
  ).toBeInTheDocument();
  expect(cart().queryByRole('listitem')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
  await tick();
  expect(exact.mock.calls.map(([url]) => url.searchParams.get('search'))).toEqual(['00123', '00123']);
  expect(screen.getByText('1 item')).toBeInTheDocument();
  expect(input()).toHaveValue('');
});

test('leaving the cashier cancels the request immediately', async () => {
  exact.mockImplementationOnce(() => new Promise(() => {}));
  const view = renderCashier();
  scan('00123');
  expect(exact.mock.calls[0][1]?.signal?.aborted).toBe(false);
  view.unmount();
  expect(exact.mock.calls[0][1]?.signal?.aborted).toBe(true);
  await tick();
});
