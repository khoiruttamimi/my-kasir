import { useState } from 'react';
import type { Product } from '@/models/product';

type CartLine = {
  productId: Product['id'];
  name: Product['name'];
  unitPrice: Product['price'];
  quantity: number;
};

export function useCashierCart() {
  const [lines, setLines] = useState<CartLine[]>([]);

  function addProduct(product: Pick<Product, 'id' | 'name' | 'price'>) {
    setLines((current) => {
      if (current.some((line) => line.productId === product.id)) {
        return current.map((line) => (line.productId === product.id ? { ...line, quantity: line.quantity + 1 } : line));
      }

      return [...current, { productId: product.id, name: product.name, unitPrice: product.price, quantity: 1 }];
    });
  }

  function changeQuantity(productId: CartLine['productId'], delta: 1 | -1) {
    setLines((current) =>
      current.map((line) => {
        const quantity = line.quantity + delta;
        return line.productId === productId && quantity >= 1 ? { ...line, quantity } : line;
      }),
    );
  }

  function removeProduct(productId: CartLine['productId']) {
    setLines((current) => current.filter((line) => line.productId !== productId));
  }

  const subtotalLines = lines.map((line) => ({ ...line, subtotal: line.unitPrice * line.quantity }));

  return {
    lines: subtotalLines,
    totalItems: lines.reduce((total, line) => total + line.quantity, 0),
    grandTotal: subtotalLines.reduce((total, line) => total + line.subtotal, 0),
    addProduct,
    increaseQuantity: (productId: CartLine['productId']) => changeQuantity(productId, 1),
    decreaseQuantity: (productId: CartLine['productId']) => changeQuantity(productId, -1),
    removeProduct,
    clear: () => setLines([]),
  };
}
