import { NextRequest, NextResponse } from 'next/server';

import { createProduct, deleteProduct, getProducts, updateProduct } from '@/server/services/product.service';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const page = Number(searchParams.get('page') ?? 1);
  const limit = Number(searchParams.get('limit') ?? 10);
  const search = searchParams.get('search') ?? '';

  const products = await getProducts({ page, limit, search });

  return NextResponse.json(products);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const product = await createProduct({
    name: body.name,
    price: body.price,
    stock: body.stock,
  });

  return NextResponse.json(product, {
    status: 201,
  });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();

  const product = await updateProduct(body.id, {
    name: body.name,
    price: body.price,
    stock: body.stock,
  });

  if (!product) {
    return NextResponse.json(
      {
        message: 'Product not found',
      },
      {
        status: 404,
      },
    );
  }

  return NextResponse.json(product);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      {
        message: 'Product id is required',
      },
      {
        status: 400,
      },
    );
  }

  const product = await deleteProduct(id);

  if (!product) {
    return NextResponse.json(
      {
        message: 'Product not found',
      },
      {
        status: 404,
      },
    );
  }

  return NextResponse.json(product);
}
