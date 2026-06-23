import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ message: 'Logged out successfully' });
  response.headers.set('Set-Cookie', `token=; HttpOnly; Path=/; SameSite=Strict; Secure; Max-Age=0`);
  return response;
}
