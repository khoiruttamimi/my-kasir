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

  return { lines, addProduct };
}
