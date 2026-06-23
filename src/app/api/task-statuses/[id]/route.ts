import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '../../helper';
import { requireBaseLevel } from '@/lib/rbac';
import { requireSameCompany } from '@/lib/tenant';
import { BaseLevel, EntityType } from '@prisma/client';
import { z } from 'zod';

const updateStatusSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  position: z.number().int().min(1).optional(),
  isCompleted: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const { id: userId, companyId } = userOrResponse;

  const baseLevelCheck = await requireBaseLevel(request, BaseLevel.ADMIN);
  if (baseLevelCheck) return baseLevelCheck;

  const params = await props.params;
  const { id } = params;

  try {
    const statusToUpdate = await prisma.taskStatus.findUnique({ where: { id } });
    if (!statusToUpdate) return NextResponse.json({ error: 'Status not found' }, { status: 404 });
    await requireSameCompany(userId, statusToUpdate.companyId);

    const body = await request.json();
    const parsed = updateStatusSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

    const data = parsed.data;

    await prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.taskStatus.updateMany({
          where: { companyId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }

      if (data.position !== undefined && data.position !== statusToUpdate.position) {
        const newPos = data.position;
        const oldPos = statusToUpdate.position;

        if (newPos > oldPos) {
          // moving down, shift intermediate items up
          await tx.taskStatus.updateMany({
            where: {
              companyId,
              position: { gt: oldPos, lte: newPos },
              id: { not: id },
            },
            data: { position: { decrement: 1 } },
          });
        } else {
          // moving up, shift intermediate items down
          await tx.taskStatus.updateMany({
            where: {
              companyId,
              position: { gte: newPos, lt: oldPos },
              id: { not: id },
            },
            data: { position: { increment: 1 } },
          });
        }
      }

      await tx.taskStatus.update({
        where: { id },
        data,
      });

      await tx.auditLog.create({
        data: {
          userId,
          companyId,
          action: 'task_status.updated',
          entityType: EntityType.COMPANY,
          entityId: companyId,
          metadata: { id, changes: data },
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

  const baseLevelCheck = await requireBaseLevel(request, BaseLevel.ADMIN);
  if (baseLevelCheck) return baseLevelCheck;

  const params = await props.params;
  const { id } = params;

  try {
    const statusToDelete = await prisma.taskStatus.findUnique({
      where: { id },
      include: {
        _count: { select: { tasks: true } },
      },
    });

    if (!statusToDelete) return NextResponse.json({ error: 'Status not found' }, { status: 404 });
    await requireSameCompany(userId, statusToDelete.companyId);

    if (statusToDelete._count.tasks > 0) {
      return NextResponse.json({ error: 'Cannot delete status with active tasks' }, { status: 400 });
    }

    if (statusToDelete.isDefault) {
      return NextResponse.json({ error: 'Cannot delete the default status' }, { status: 400 });
    }

    const allStatuses = await prisma.taskStatus.count({ where: { companyId } });
    if (allStatuses <= 1) {
      return NextResponse.json({ error: 'Cannot delete the only remaining status' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.taskStatus.delete({ where: { id } });

      // Shift remaining positions
      await tx.taskStatus.updateMany({
        where: {
          companyId,
          position: { gt: statusToDelete.position },
        },
        data: { position: { decrement: 1 } },
      });

      await tx.auditLog.create({
        data: {
          userId,
          companyId,
          action: 'task_status.deleted',
          entityType: EntityType.COMPANY,
          entityId: companyId,
          metadata: { id },
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
