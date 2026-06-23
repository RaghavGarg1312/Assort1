import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '../../helper';
import { requirePermission } from '@/lib/rbac';
import { requireSameCompany } from '@/lib/tenant';
import { z } from 'zod';
import { EntityType } from '@prisma/client';

const editDeptSchema = z.object({
  name: z.string().min(1).optional(),
  headUserId: z.string().nullable().optional(),
});

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const { id: userId, companyId } = userOrResponse;

  const permCheck = await requirePermission(request, 'edit_department');
  if (permCheck) return permCheck;

  const params = await props.params;
  const { id } = params;

  try {
    const department = await prisma.department.findUnique({ where: { id } });
    if (!department) return NextResponse.json({ error: 'Department not found' }, { status: 404 });

    await requireSameCompany(userId, department.companyId);

    const body = await request.json();
    const parsed = editDeptSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

    const { name, headUserId } = parsed.data;

    if (headUserId) {
      const headUser = await prisma.user.findUnique({
        where: { id: headUserId },
        select: { companyId: true, baseLevel: true },
      });

      if (!headUser || headUser.companyId !== companyId) {
        return NextResponse.json({ error: 'Invalid head user' }, { status: 400 });
      }

      if (headUser.baseLevel === 'MEMBER' || headUser.baseLevel === 'VIEWER') {
        return NextResponse.json({ error: 'Head user must be MANAGER or higher' }, { status: 400 });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.department.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(headUserId !== undefined && { headUserId }),
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          companyId,
          action: 'department.updated',
          entityType: EntityType.DEPARTMENT,
          entityId: id,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const { id: userId, companyId } = userOrResponse;

  const permCheck = await requirePermission(request, 'delete_department');
  if (permCheck) return permCheck;

  const params = await props.params;
  const { id } = params;

  try {
    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true } },
      },
    });

    if (!department) return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    await requireSameCompany(userId, department.companyId);

    if (department._count.users > 0) {
      return NextResponse.json({ error: 'Cannot delete department with assigned users' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.department.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          userId,
          companyId,
          action: 'department.deleted',
          entityType: EntityType.DEPARTMENT,
          entityId: id,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
