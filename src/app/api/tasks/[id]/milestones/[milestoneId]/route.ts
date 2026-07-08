import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '../../../../helper';
import { requireSameCompany } from '@/lib/tenant';
import { BaseLevel, EntityType, MilestoneStatus } from '@prisma/client';
import { z } from 'zod';

const updateMilestoneSchema = z.object({
  name: z.string().min(1).optional(),
  dueDate: z.string().refine((date) => new Date(date).getTime() > Date.now(), 'dueDate must be in the future').optional(),
});

export async function PATCH(request: Request, props: { params: Promise<{ id: string; milestoneId: string }> }) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const { id: userId, companyId, baseLevel } = userOrResponse;


  const params = await props.params;
  const { id: taskId, milestoneId } = params;

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { milestones: { where: { id: milestoneId } } },
    });

    if (!task || task.milestones.length === 0) {
      return NextResponse.json({ error: 'Task or Milestone not found' }, { status: 404 });
    }
    await requireSameCompany(userId, task.companyId);

    if (task.createdById !== userId && baseLevel !== 'MANAGER' && baseLevel !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Only task creator or MANAGER+ can edit milestones.' }, { status: 403 });
    }

    const milestone = task.milestones[0];

    if (milestone.status === MilestoneStatus.APPROVED) {
      return NextResponse.json({ error: 'Cannot edit an APPROVED milestone' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = updateMilestoneSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

    let { name, dueDate } = parsed.data;

    // Mutability logic based on state
    if (milestone.status !== MilestoneStatus.NOT_STARTED) {
      // name is locked
      name = undefined;
    }

    await prisma.$transaction(async (tx) => {
      await tx.milestone.update({
        where: { id: milestoneId },
        data: {
          ...(name ? { name } : {}),
          ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          companyId,
          action: 'milestone.updated',
          entityType: EntityType.MILESTONE,
          entityId: milestoneId,
          metadata: { changes: parsed.data },
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string; milestoneId: string }> }) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const { id: userId, companyId, baseLevel } = userOrResponse;


  const params = await props.params;
  const { id: taskId, milestoneId } = params;

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        milestones: {
          include: { _count: { select: { submissions: true } } },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    await requireSameCompany(userId, task.companyId);

    const milestone = task.milestones.find((m) => m.id === milestoneId);
    if (!milestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }

    if (task.createdById !== userId && baseLevel !== 'MANAGER' && baseLevel !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Only task creator or MANAGER+ can delete milestones.' }, { status: 403 });
    }

    if (task.milestones.length <= 2) {
      return NextResponse.json({ error: 'Task must have a minimum of 2 milestones' }, { status: 400 });
    }

    if (milestone.status !== MilestoneStatus.NOT_STARTED) {
      return NextResponse.json({ error: 'Can only delete milestones in NOT_STARTED status' }, { status: 400 });
    }

    if (milestone._count.submissions > 0) {
      return NextResponse.json({ error: 'Cannot delete a milestone that has submissions' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.milestone.delete({ where: { id: milestoneId } });

      // Shift subsequent positions down
      await tx.milestone.updateMany({
        where: {
          taskId,
          position: { gt: milestone.position },
        },
        data: { position: { decrement: 1 } },
      });

      await tx.auditLog.create({
        data: {
          userId,
          companyId,
          action: 'milestone.deleted',
          entityType: EntityType.MILESTONE,
          entityId: milestoneId,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
