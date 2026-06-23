import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyJwt } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyJwt(token) as any;

    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        companyId: true,
        roleId: true,
        baseLevel: true,
        departmentId: true,
        designation: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Me route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
