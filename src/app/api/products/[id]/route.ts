import { NextResponse } from 'next/server';

import { deleteProduct, getProductById, updateProduct } from '@/server/services/product.service';
import { withAuth } from '@/server/auth/with-auth';

type Context = {
  params: Promise<{ id: string }>;
};

export const GET = withAuth<Context>(async (_request, { params }) => {
  const { id } = await params;

  const product = await getProductById(id);

  if (!product) {
    return NextResponse.json({ message: 'Product not found' }, { status: 404 });
  }

  return NextResponse.json(product);
});

export const PUT = withAuth<Context>(async (request, { params }) => {
  const { id } = await params;
  const body = await request.json();

  const product = await updateProduct(id, body);

  return NextResponse.json({ data: product });
});

export const DELETE = withAuth<Context>(
  async (_request, { params }) => {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ message: 'Product id is required' }, { status: 400 });
    }

    const product = await deleteProduct(id);

    if (!product) {
      return NextResponse.json({ message: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json(product);
  },
  { roles: ['cashier'] },
);
