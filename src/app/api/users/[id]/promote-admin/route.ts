import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '../../../helper';
import { requireBaseLevel } from '@/lib/rbac';
import { requireSameCompany } from '@/lib/tenant';
import { BaseLevel, EntityType } from '@prisma/client';

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const { id: userId, companyId } = userOrResponse;

  const baseLevelCheck = await requireBaseLevel(request, BaseLevel.ADMIN);
  if (baseLevelCheck) return baseLevelCheck;

  const params = await props.params;
  const { id } = params;

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    await requireSameCompany(userId, user.companyId!);

    if (user.baseLevel === 'ADMIN') {
      return NextResponse.json({ success: true });
    }

    const adminRole = await prisma.role.findFirst({
      where: { companyId, name: 'admin' },
    });

    if (!adminRole) {
      return NextResponse.json({ error: 'Admin role not found' }, { status: 500 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          baseLevel: BaseLevel.ADMIN,
          roleId: adminRole.id,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          companyId,
          action: 'user.promoted_to_admin',
          entityType: EntityType.USER,
          entityId: id,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
