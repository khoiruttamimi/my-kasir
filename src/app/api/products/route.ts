import { NextResponse } from 'next/server';

import { createProduct, getProducts } from '@/server/services/product.service';
import { withAuth } from '@/server/auth/with-auth';
import { apiResponse, readJsonBody } from '@/server/utils/api';

export const GET = withAuth(async (request) =>
  apiResponse(async () => {
    const { searchParams } = request.nextUrl;

    const page = Number(searchParams.get('page') ?? 1);
    const limit = Number(searchParams.get('limit') ?? 10);
    const search = searchParams.get('search') ?? '';
    const searchMode = searchParams.get('searchMode') ?? undefined;

    const products = await getProducts({ page, limit, search, searchMode });

    return NextResponse.json(
      products,
      searchMode === 'exact-code' ? { headers: { 'Cache-Control': 'no-store' } } : undefined,
    );
  }),
);

export const POST = withAuth(async (request) =>
  apiResponse(async () => {
    const product = await createProduct(await readJsonBody(request));

    return NextResponse.json(product, { status: 201 });
  }),
);
