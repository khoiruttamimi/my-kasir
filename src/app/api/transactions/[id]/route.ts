import { NextResponse } from 'next/server';

import { withAuth } from '@/server/auth/with-auth';
import { getTransactionById } from '@/server/services/transaction.service';
import { apiResponse } from '@/server/utils/api';

type Context = {
  params: Promise<{ id: string }>;
};

export const GET = withAuth<Context>(async (_request, { params }) =>
  apiResponse(async () => {
    const { id } = await params;
    const transaction = await getTransactionById(id);

    if (!transaction) {
      return NextResponse.json({ message: 'Transaction not found' }, { status: 404 });
    }

    return NextResponse.json(transaction);
  }),
);
