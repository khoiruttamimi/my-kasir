import { NextResponse, type NextRequest } from 'next/server';
import { withAuth } from '@/server/auth/with-auth';
import { generateProductCode } from '@/server/services/product.service';
import { apiResponse } from '@/server/utils/api';

const generate = withAuth(async () =>
  apiResponse(async () => NextResponse.json({ code: await generateProductCode() })),
);

// Add no-store to every handled response, including authentication and generation errors.
export async function POST(request: NextRequest) {
  const response = await generate(request, undefined);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
