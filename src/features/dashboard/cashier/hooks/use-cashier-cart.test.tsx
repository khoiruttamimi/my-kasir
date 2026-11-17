/** @jest-environment jsdom */
import { expect, test } from '@jest/globals';
import { act, renderHook } from '@testing-library/react';
import { useCashierCart } from './use-cashier-cart';

const tea = { id: 'tea', name: 'Teh', price: 12000 };
const coffee = { id: 'coffee', name: 'Kopi', price: 8000 };

test('merges repeat adds by ID, keeps the initial price and name, and calculates totals', () => {
  const { result } = renderHook(useCashierCart);
  act(() => {
    result.current.addProduct(tea);
    result.current.addProduct({ ...tea, name: 'Teh Baru', price: 15000 });
    result.current.addProduct(coffee);
  });

  expect(result.current.lines).toEqual([
    { productId: 'tea', name: 'Teh', unitPrice: 12000, quantity: 2, subtotal: 24000 },
    { productId: 'coffee', name: 'Kopi', unitPrice: 8000, quantity: 1, subtotal: 8000 },
  ]);
  expect(result.current).toMatchObject({ totalItems: 3, grandTotal: 32000 });
});

test('updates quantities without going below one and recalculates totals after removal and clear', () => {
  const { result } = renderHook(useCashierCart);
  expect(result.current).toMatchObject({ lines: [], totalItems: 0, grandTotal: 0 });

  act(() => {
    result.current.addProduct(tea);
    result.current.addProduct(coffee);
    result.current.increaseQuantity(tea.id);
  });
  expect(result.current).toMatchObject({ totalItems: 3, grandTotal: 32000 });

  act(() => {
    result.current.decreaseQuantity(tea.id);
    result.current.decreaseQuantity(tea.id);
  });
  expect(result.current.lines[0]).toMatchObject({ quantity: 1, subtotal: 12000 });
  expect(result.current).toMatchObject({ totalItems: 2, grandTotal: 20000 });

  act(() => result.current.removeProduct(tea.id));
  expect(result.current.lines.map((line) => line.productId)).toEqual([coffee.id]);
  expect(result.current).toMatchObject({ totalItems: 1, grandTotal: 8000 });

  act(() => result.current.clear());
  expect(result.current).toMatchObject({ lines: [], totalItems: 0, grandTotal: 0 });
});
