import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '../../../helper';
import { requireSameCompany } from '@/lib/tenant';
import { BaseLevel, EntityType, TaskState } from '@prisma/client';
import { z } from 'zod';

const createMilestoneSchema = z.object({
  name: z.string().min(1),
  dueDate: z.string().refine((date) => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return false;
    return d.getTime() >= Date.now() - 24 * 60 * 60 * 1000;
  }, 'dueDate must be today or in the future'),
});

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const { id: userId, companyId, baseLevel } = userOrResponse;


  const params = await props.params;
  const { id: taskId } = params;

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { milestones: { select: { position: true } }, assignee: true },
    });

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    await requireSameCompany(userId, task.companyId);

    if (task.createdById !== userId && baseLevel !== 'ADMIN' && task.assignee?.managerId !== userId) {
      return NextResponse.json({ error: 'Forbidden. Only task creator, ADMIN, or assignee\'s manager can add milestones.' }, { status: 403 });
    }

    if (task.state === TaskState.COMPLETED) {
      return NextResponse.json({ error: 'Cannot add milestones to a COMPLETED task' }, { status: 400 });
    }

    if (task.isArchived) {
      return NextResponse.json({ error: 'Cannot add milestones to an archived task' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = createMilestoneSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

    const { name, dueDate } = parsed.data;

    let maxPos = 0;
    if (task.milestones.length > 0) {
      maxPos = Math.max(...task.milestones.map((m) => m.position));
    }
    const newPosition = maxPos + 1;

    const newMilestone = await prisma.$transaction(async (tx) => {
      const ms = await tx.milestone.create({
        data: {
          taskId,
          name,
          dueDate: new Date(dueDate),
          position: newPosition,
        },
      });

      if (task.assigneeId) {
        await tx.notification.create({
          data: {
            companyId,
            userId: task.assigneeId,
            type: 'milestone.added',
            title: 'New Milestone Added',
            body: `A new milestone "${name}" was added to your task "${task.title}".`,
            entityType: EntityType.MILESTONE,
            entityId: ms.id,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId,
          companyId,
          action: 'milestone.created',
          entityType: EntityType.MILESTONE,
          entityId: ms.id,
        },
      });

      return ms;
    });

    return NextResponse.json(newMilestone, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
