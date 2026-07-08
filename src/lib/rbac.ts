import { cache } from 'react';
import prisma from '@/lib/prisma';
import { BaseLevel } from '@prisma/client';
import { NextResponse } from 'next/server';

const LEVEL_WEIGHTS: Record<BaseLevel, number> = {
  SUPERADMIN: 50,
  ADMIN: 40,
  MANAGER: 30,
  MEMBER: 20,
  VIEWER: 10,
};

export const getPermissions = cache(async (userId: string): Promise<string[]> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  if (!user || !user.role) {
    return [];
  }

  return user.role.rolePermissions.map((rp) => rp.permission.code);
});

export async function hasPermission(userId: string, permissionCode: string): Promise<boolean> {
  const permissions = await getPermissions(userId);
  return permissions.includes(permissionCode);
}

export async function requirePermission(request: Request, permissionCode: string): Promise<NextResponse | undefined> {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hasPerm = await hasPermission(userId, permissionCode);
  if (!hasPerm) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return undefined;
}

export async function requireBaseLevel(request: Request, minLevel: BaseLevel): Promise<NextResponse | undefined> {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { baseLevel: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userWeight = LEVEL_WEIGHTS[user.baseLevel];
  const minWeight = LEVEL_WEIGHTS[minLevel];

  if (userWeight < minWeight) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return undefined;
}
