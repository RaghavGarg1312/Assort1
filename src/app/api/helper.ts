import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function getAuthUser(request: Request) {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, companyId: true, departmentId: true, baseLevel: true, status: true },
  });

  if (!user || !user.companyId) {
    return NextResponse.json({ error: 'Unauthorized or no company assigned' }, { status: 403 });
  }

  return user as typeof user & { companyId: string };
}
