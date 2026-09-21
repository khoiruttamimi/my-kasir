import { auth } from '@/auth';
import { UserRole } from '@/models/user';
import type { Session } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

type AuthHandler<TContext> = (request: NextRequest, context: TContext, session: Session) => Promise<Response>;

type WithAuthOptions = {
  roles?: UserRole[];
};

export const withAuth = <TContext>(handler: AuthHandler<TContext>, options?: WithAuthOptions) => {
  return async (request: NextRequest, context: TContext) => {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    if (options?.roles && !options.roles.includes(session.user.role)) {
      return Response.json({ message: 'Forbidden' }, { status: 403 });
    }

    return handler(request, context, session);
  };
};
