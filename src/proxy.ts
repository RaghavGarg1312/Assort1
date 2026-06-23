// src/proxy.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose' 

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Allow public auth endpoints straight through
  if (pathname.startsWith('/api/auth') && pathname !== '/api/auth/me') {
    return NextResponse.next()
  }

  // 2. Extract JWT token from httpOnly cookies
  const token = request.cookies.get('token')?.value

  // 3. Unauthenticated routes protection
  if (!token) {
    if (pathname.startsWith('/api/') || pathname.startsWith('/dashboard')) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized session' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    // 4. Verify token using edge-compatible 'jose'
    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)

    // 5. Inject downstream headers safely
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', payload.userId as string)
    requestHeaders.set('x-user-email', payload.email as string)

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  } catch (error) {
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('token')
    return response
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
}
