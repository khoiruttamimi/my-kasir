export type Product = {
  id: string;
  code: string | null;
  name: string;
  category: string;
  price: number;
  stock: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateProductPayload = Pick<Product, 'name' | 'category' | 'price' | 'stock'> & { code: string };
export type UpdateProductPayload = { id: string } & Partial<CreateProductPayload>;
