import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJwt } from '@/lib/auth';

export function proxy(request: NextRequest) {
  const token = request.cookies.get('token')?.value;

  // Allow unauthenticated access to auth endpoints, except /me
  if (request.nextUrl.pathname.startsWith('/api/auth')) {
    if (request.nextUrl.pathname === '/api/auth/me' && !token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (!token) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const payload = verifyJwt(token) as any;

  if (!payload) {
    // Token is invalid or expired
    const response = request.nextUrl.pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', request.url));
    
    // Clear the invalid cookie
    response.headers.set('Set-Cookie', `token=; HttpOnly; Path=/; SameSite=Strict; Secure; Max-Age=0`);
    return response;
  }

  // Attach user context to headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', payload.userId);
  if (payload.email) requestHeaders.set('x-user-email', payload.email);
  if (payload.companyId) requestHeaders.set('x-company-id', payload.companyId);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/api/:path*', '/dashboard/:path*'],
};
