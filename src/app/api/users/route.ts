import { NextResponse } from 'next/server';
import { withAuth } from '@/server/auth/with-auth';
import { createUser, getUsers } from '@/server/services/user.service';
import { readJsonBody, apiResponse } from '@/server/utils/api';

export const GET = withAuth(
  async (request) =>
    apiResponse(async () => {
      const { searchParams } = request.nextUrl;
      const users = await getUsers({
        page: Number(searchParams.get('page') ?? 1),
        limit: Number(searchParams.get('limit') ?? 10),
        search: searchParams.get('search') ?? '',
      });
      return NextResponse.json(users);
    }),
  { roles: ['admin'] },
);

export const POST = withAuth(
  async (request) =>
    apiResponse(async () => {
      const user = await createUser(await readJsonBody(request));
      return NextResponse.json(user, { status: 201 });
    }),
  { roles: ['admin'] },
);
