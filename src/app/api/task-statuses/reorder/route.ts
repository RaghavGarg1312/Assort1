import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '../../helper';
import { requireBaseLevel } from '@/lib/rbac';
import { BaseLevel, EntityType } from '@prisma/client';
import { z } from 'zod';

const reorderSchema = z.array(
  z.object({
    id: z.string(),
    position: z.number().int().min(1),
  })
);

export async function PATCH(request: Request) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const { id: userId, companyId } = userOrResponse;

  const baseLevelCheck = await requireBaseLevel(request, BaseLevel.ADMIN);
  if (baseLevelCheck) return baseLevelCheck;

  try {
    const body = await request.json();
    const parsed = reorderSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

    const updates = parsed.data;

    // Validate all IDs belong to this company
    const ids = updates.map((u) => u.id);
    const existing = await prisma.taskStatus.findMany({
      where: { id: { in: ids }, companyId },
      select: { id: true },
    });

    if (existing.length !== ids.length) {
      return NextResponse.json({ error: 'One or more statuses not found or do not belong to this company' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // Step 1: Set to temporary negative positions to sidestep unique index conflicts
      for (const update of updates) {
        await tx.taskStatus.update({
          where: { id: update.id },
          data: { position: -update.position },
        });
      }

      // Step 2: Set to real positive positions
      for (const update of updates) {
        await tx.taskStatus.update({
          where: { id: update.id },
          data: { position: update.position },
        });
      }

      await tx.auditLog.create({
        data: {
          userId,
          companyId,
          action: 'task_status.reordered',
          entityType: EntityType.COMPANY,
          entityId: companyId,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
