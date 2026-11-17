/** @jest-environment jsdom */
import '@testing-library/jest-dom/jest-globals';
import { expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import ProductGrid from './product-grid';

test('shows selling prices and codes and exposes native buttons for adding products', () => {
  const tea = { id: 'tea', name: 'Teh', code: '00123', price: 12000 };
  const onSelect = jest.fn();
  render(<ProductGrid products={[tea, { id: 'coffee', name: 'Kopi', code: null, price: 8000 }]} onSelect={onSelect} />);

  const card = screen.getByRole('button', { name: /Teh.*00123/ });
  expect(card).toHaveTextContent(/Rp\s*12\.000/);
  expect(card.tagName).toBe('BUTTON');
  card.focus();
  expect(card).toHaveFocus();
  fireEvent.click(card);
  expect(onSelect).toHaveBeenCalledWith(tea);
  expect(screen.getByRole('button', { name: /Kopi.*Kode belum diisi/ })).toBeInTheDocument();
});

test('distinguishes loading, no results, and a retryable load failure', () => {
  const onSelect = jest.fn();
  const onRetry = jest.fn();
  const { rerender } = render(<ProductGrid loading onSelect={onSelect} />);
  expect(screen.getByRole('status')).toHaveTextContent('Memuat produk');
  rerender(<ProductGrid products={[]} onSelect={onSelect} />);
  expect(screen.getByText('Tidak ada produk yang cocok.')).toBeInTheDocument();
  rerender(<ProductGrid onRetry={onRetry} onSelect={onSelect} />);
  expect(screen.getByText('Gagal memuat produk.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
  expect(onRetry).toHaveBeenCalledTimes(1);
});
