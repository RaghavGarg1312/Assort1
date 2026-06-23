import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '../helper';

export async function GET(request: Request) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const { companyId } = userOrResponse;

  const url = new URL(request.url);
  const excludeAdmins = url.searchParams.get('excludeAdmins') === 'true';

  try {
    const users = await prisma.user.findMany({
      where: {
        companyId,
        ...(excludeAdmins && { baseLevel: { not: 'ADMIN' } }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        designation: true,
        department: { select: { name: true } },
        manager: { select: { name: true } },
        baseLevel: true,
        status: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
