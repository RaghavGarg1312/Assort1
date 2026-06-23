import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '../helper';
import { requirePermission } from '@/lib/rbac';
import { z } from 'zod';
import { EntityType } from '@prisma/client';

export async function GET(request: Request) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const { companyId } = userOrResponse;

  try {
    const departments = await prisma.department.findMany({
      where: { companyId },
      include: {
        _count: {
          select: { users: true },
        },
        head: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(departments);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const createDeptSchema = z.object({
  name: z.string().min(1),
  headUserId: z.string().optional(),
});

export async function POST(request: Request) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const { id: userId, companyId } = userOrResponse;

  const permCheck = await requirePermission(request, 'create_department');
  if (permCheck) return permCheck;

  try {
    const body = await request.json();
    const parsed = createDeptSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

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

    const department = await prisma.$transaction(async (tx) => {
      const dept = await tx.department.create({
        data: {
          name,
          companyId,
          headUserId,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          companyId,
          action: 'department.created',
          entityType: EntityType.DEPARTMENT,
          entityId: dept.id,
        },
      });

      return dept;
    });

    return NextResponse.json(department, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
