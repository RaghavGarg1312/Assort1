import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '../../helper';
import { requirePermission } from '@/lib/rbac';
import { EntityType } from '@prisma/client';

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const { id: userId, companyId } = userOrResponse;

  const permCheck = await requirePermission(request, 'manage_roles');
  if (permCheck) return permCheck;

  try {
    const { id: roleId } = await context.params;

    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        _count: {
          select: { users: true, invites: true },
        },
      },
    });

    if (!role || role.companyId !== companyId) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    if (role._count.users > 0 || role._count.invites > 0) {
      return NextResponse.json({ error: 'Cannot delete role assigned to users or invites' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // First delete any rolePermissions links
      await tx.rolePermission.deleteMany({
        where: { roleId },
      });

      await tx.role.delete({
        where: { id: roleId },
      });

      await tx.auditLog.create({
        data: {
          userId,
          companyId,
          action: 'role.deleted',
          entityType: EntityType.ROLE,
          entityId: roleId,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
