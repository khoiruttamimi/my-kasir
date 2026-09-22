import { NextResponse } from 'next/server';
import { withAuth } from '@/server/auth/with-auth';
import { deleteUser, getUserById, updateUser } from '@/server/services/user.service';
import { readJsonBody, apiResponse } from '@/server/utils/api';

type Context = { params: Promise<{ id: string }> };

const notFound = () => NextResponse.json({ message: 'User not found' }, { status: 404 });

export const GET = withAuth<Context>(
  async (_request, { params }) => {
    const { id } = await params;
    const user = await getUserById(id);
    return user ? NextResponse.json(user) : notFound();
  },
  { roles: ['admin'] },
);

export const PUT = withAuth<Context>(
  async (request, { params }) =>
    apiResponse(async () => {
      const { id } = await params;
      const user = await updateUser(id, await readJsonBody(request));
      return user ? NextResponse.json({ data: user }) : notFound();
    }),
  { roles: ['admin'] },
);

export const PATCH = PUT;

export const DELETE = withAuth<Context>(
  async (_request, { params }) => {
    const { id } = await params;
    const user = await deleteUser(id);
    return user ? NextResponse.json(user) : notFound();
  },
  { roles: ['admin'] },
);
