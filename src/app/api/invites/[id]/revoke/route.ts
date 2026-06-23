import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '../../../helper';
import { requirePermission } from '@/lib/rbac';
import { requireSameCompany } from '@/lib/tenant';
import { EntityType, InviteStatus } from '@prisma/client';

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const { id: userId, companyId } = userOrResponse;

  const permCheck = await requirePermission(request, 'create_user');
  if (permCheck) return permCheck;

  const params = await props.params;
  const { id } = params;

  try {
    const invite = await prisma.invite.findUnique({ where: { id } });
    if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 });

    await requireSameCompany(userId, invite.companyId);

    if (invite.status !== InviteStatus.PENDING) {
      return NextResponse.json({ error: 'Invite is not pending' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.invite.update({
        where: { id },
        data: { status: InviteStatus.REVOKED },
      });

      await tx.auditLog.create({
        data: {
          userId,
          companyId,
          action: 'invite.revoked',
          entityType: EntityType.INVITE,
          entityId: id,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
