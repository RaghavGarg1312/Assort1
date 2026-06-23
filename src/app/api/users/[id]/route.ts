import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '../../helper';
import { requirePermission } from '@/lib/rbac';
import { requireSameCompany } from '@/lib/tenant';
import { BaseLevel, EntityType } from '@prisma/client';
import { z } from 'zod';

const editUserSchema = z.object({
  name: z.string().optional(),
  designation: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  managerId: z.string().nullable().optional(),
  baseLevel: z.nativeEnum(BaseLevel).optional(),
  roleId: z.string().nullable().optional(),
});

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const { id: userId, companyId } = userOrResponse;

  const params = await props.params;
  const { id } = params;

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        department: true,
        manager: true,
        role: true,
      },
    });

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    await requireSameCompany(userId, user.companyId!);

    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const { id: userId, companyId } = userOrResponse;

  const permCheck = await requirePermission(request, 'edit_user');
  if (permCheck) return permCheck;

  const params = await props.params;
  const { id } = params;

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    await requireSameCompany(userId, user.companyId!);

    const body = await request.json();
    const parsed = editUserSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

    const data = parsed.data;

    if (data.baseLevel && user.baseLevel === 'ADMIN' && data.baseLevel !== 'ADMIN') {
      return NextResponse.json({ error: 'Cannot change baseLevel of an ADMIN user' }, { status: 403 });
    }

    if (data.managerId) {
      const manager = await prisma.user.findUnique({ where: { id: data.managerId } });
      if (!manager || manager.companyId !== companyId) {
        return NextResponse.json({ error: 'Invalid manager' }, { status: 400 });
      }
    }

    if (data.departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: data.departmentId } });
      if (!dept || dept.companyId !== companyId) {
        return NextResponse.json({ error: 'Invalid department' }, { status: 400 });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data,
      });

      await tx.auditLog.create({
        data: {
          userId,
          companyId,
          action: 'user.updated',
          entityType: EntityType.USER,
          entityId: id,
          metadata: { changes: data },
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
