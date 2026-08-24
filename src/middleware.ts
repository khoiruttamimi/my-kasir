import { type NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const url = req.nextUrl;

  if (url.pathname === '/') {
    url.pathname = '/dashboard/products';
    return NextResponse.redirect(url);
  }
}
