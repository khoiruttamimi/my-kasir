import { NextResponse } from 'next/server';

import { createProduct, getProducts } from '@/server/services/product.service';
import { withAuth } from '@/server/auth/with-auth';

export const GET = withAuth(async (request) => {
  const { searchParams } = request.nextUrl;

  const page = Number(searchParams.get('page') ?? 1);
  const limit = Number(searchParams.get('limit') ?? 10);
  const search = searchParams.get('search') ?? '';

  const products = await getProducts({ page, limit, search });

  return NextResponse.json(products);
});

export const POST = withAuth(async (request) => {
  const body = await request.json();

  const product = await createProduct({
    name: body.name,
    category: body.category,
    price: body.price,
    stock: body.stock,
  });

  return NextResponse.json(product, {
    status: 201,
  });
});
