/** @jest-environment jsdom */
import '@testing-library/jest-dom/jest-globals';
import { afterAll, beforeAll, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App, Button } from 'antd';
import CartPanel from './cart-panel';
import { useCashierCart } from '../hooks/use-cashier-cart';

beforeAll(() => {
  const getComputedStyle = window.getComputedStyle.bind(window);
  // jsdom cannot measure the pseudo-element Ant Design uses for modal scrollbar sizing.
  jest.spyOn(window, 'getComputedStyle').mockImplementation((element) => getComputedStyle(element));
});

afterAll(() => {
  jest.restoreAllMocks();
});

function CartExample() {
  const { addProduct, ...cart } = useCashierCart();

  return (
    <App>
      <Button onClick={() => addProduct({ id: 'tea', name: 'Teh', price: 12000 })}>Pilih Teh</Button>
      <Button onClick={() => addProduct({ id: 'coffee', name: 'Kopi', price: 8000 })}>Pilih Kopi</Button>
      <CartPanel {...cart} />
    </App>
  );
}

test('shows the unit price and subtotal, updates quantity, and removes a line immediately', () => {
  render(<CartExample />);
  fireEvent.click(screen.getByRole('button', { name: 'Pilih Teh' }));
  fireEvent.click(screen.getByRole('button', { name: 'Pilih Kopi' }));
  const panel = within(screen.getByRole('region', { name: 'Keranjang' }));
  const decrease = panel.getByRole('button', { name: 'Kurangi jumlah Teh' });
  expect(decrease).toBeDisabled();

  fireEvent.click(panel.getByRole('button', { name: 'Tambah jumlah Teh' }));
  expect(decrease).toBeEnabled();
  expect(panel.getByText(/harga satuan.*Rp\s*12\.000/i)).toBeInTheDocument();
  expect(panel.getByText(/subtotal.*Rp\s*24\.000/i)).toBeInTheDocument();
  expect(panel.getByText(/Rp\s*32\.000/)).toBeInTheDocument();

  fireEvent.click(decrease);
  expect(decrease).toBeDisabled();
  expect(panel.getByText(/Rp\s*20\.000/)).toBeInTheDocument();

  fireEvent.click(panel.getByRole('button', { name: 'Hapus Teh' }));
  expect(panel.queryByText('Teh')).not.toBeInTheDocument();
  expect(panel.getByText('Kopi')).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('cancel preserves items and confirming clear shows an empty cart with zero totals', async () => {
  render(<CartExample />);
  fireEvent.click(screen.getByRole('button', { name: 'Pilih Kopi' }));
  fireEvent.click(screen.getByRole('button', { name: 'Pilih Teh' }));
  const panel = within(screen.getByRole('region', { name: 'Keranjang' }));
  const clear = panel.getByRole('button', { name: 'Kosongkan keranjang' });

  fireEvent.click(clear);
  const firstDialog = await screen.findByRole('dialog');
  expect(firstDialog).toHaveTextContent('Kosongkan keranjang?');
  fireEvent.click(within(firstDialog).getByRole('button', { name: 'Batal' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(panel.getByText('Kopi')).toBeInTheDocument();
  expect(panel.getByText('Teh')).toBeInTheDocument();

  fireEvent.click(clear);
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Kosongkan' }));
  expect(await panel.findByText('Keranjang masih kosong.')).toBeInTheDocument();
  expect(panel.queryByRole('listitem')).not.toBeInTheDocument();
  expect(panel.getByText('0', { selector: 'dd' })).toBeInTheDocument();
  expect(panel.getByText(/^Rp\s*0$/)).toBeInTheDocument();
  expect(clear).toBeDisabled();
});
