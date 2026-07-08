import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '../helper';
import { requirePermission } from '@/lib/rbac';
import { z } from 'zod';
import { EntityType, BaseLevel } from '@prisma/client';

export async function GET(request: Request) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const { companyId } = userOrResponse;

  try {
    const roles = await prisma.role.findMany({
      where: { companyId },
      include: {
        _count: {
          select: { users: true },
        },
      },
      orderBy: [{ level: 'asc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json(roles);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const createRoleSchema = z.object({
  name: z.string().min(1),
  level: z.number().int().min(1),
  baseLevel: z.nativeEnum(BaseLevel),
});

export async function POST(request: Request) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const { id: userId, companyId } = userOrResponse;

  const permCheck = await requirePermission(request, 'manage_roles');
  if (permCheck) return permCheck;

  try {
    const body = await request.json();
    const parsed = createRoleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { name, level, baseLevel } = parsed.data;

    // Check if role name already exists in this company
    const existing = await prisma.role.findUnique({
      where: {
        companyId_name: {
          companyId,
          name,
        }
      }
    });

    if (existing) {
      return NextResponse.json({ error: 'Role with this name already exists' }, { status: 400 });
    }

    const role = await prisma.$transaction(async (tx) => {
      const newRole = await tx.role.create({
        data: {
          name,
          level,
          baseLevel,
          companyId,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          companyId,
          action: 'role.created',
          entityType: EntityType.ROLE,
          entityId: newRole.id,
        },
      });

      return newRole;
    });

    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
