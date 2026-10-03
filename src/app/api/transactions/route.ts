import { NextResponse } from 'next/server';

import { withAuth } from '@/server/auth/with-auth';
import { createTransaction, getTransactions } from '@/server/services/transaction.service';
import { apiResponse, readJsonBody } from '@/server/utils/api';

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

export const POST = withAuth(async (request, _context, session) =>
  apiResponse(async () => {
    const transaction = await createTransaction(await readJsonBody(request), session.user);
    return NextResponse.json(transaction, { status: 201 });
  }),
);
