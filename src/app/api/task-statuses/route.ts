import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '../helper';
import { requireBaseLevel } from '@/lib/rbac';
import { BaseLevel, EntityType } from '@prisma/client';
import { z } from 'zod';

export async function GET(request: Request) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const { companyId } = userOrResponse;

  try {
    const statuses = await prisma.taskStatus.findMany({
      where: { companyId },
      orderBy: { position: 'asc' },
    });

    return NextResponse.json(statuses);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const createStatusSchema = z.object({
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#6B7280'),
  position: z.number().int().min(1),
  isCompleted: z.boolean().default(false),
  isDefault: z.boolean().default(false),
});

export async function POST(request: Request) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const { id: userId, companyId } = userOrResponse;

  const baseLevelCheck = await requireBaseLevel(request, BaseLevel.ADMIN);
  if (baseLevelCheck) return baseLevelCheck;

  try {
    const body = await request.json();
    const parsed = createStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { name, color, position, isCompleted, isDefault } = parsed.data;

    const newStatus = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.taskStatus.updateMany({
          where: { companyId, isDefault: true },
          data: { isDefault: false },
        });
      }

      await tx.taskStatus.updateMany({
        where: {
          companyId,
          position: { gte: position },
        },
        data: {
          position: { increment: 1 },
        },
      });

      const status = await tx.taskStatus.create({
        data: {
          companyId,
          name,
          color,
          position,
          isCompleted,
          isDefault,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          companyId,
          action: 'task_status.created',
          entityType: EntityType.TASK, // or EntityType.COMPANY if TASK_STATUS is missing
          entityId: status.id,
        },
      });

      return status;
    });

    return NextResponse.json(newStatus, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
