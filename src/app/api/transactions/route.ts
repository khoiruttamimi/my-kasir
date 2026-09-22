import { NextResponse } from 'next/server';

import { withAuth } from '@/server/auth/with-auth';
import { getTransactions } from '@/server/services/transaction.service';
import { apiResponse } from '@/server/utils/api';

export const GET = withAuth(async (request) =>
  apiResponse(async () => {
    const { searchParams } = request.nextUrl;
    const transactions = await getTransactions({
      page: Number(searchParams.get('page') ?? 1),
      limit: Number(searchParams.get('limit') ?? 10),
      search: searchParams.get('search') ?? '',
    });

    return NextResponse.json(transactions);
  }),
);
