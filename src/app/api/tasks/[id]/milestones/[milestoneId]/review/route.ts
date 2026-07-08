import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '../../../../../helper';
import { EntityType, MilestoneStatus, TaskState } from '@prisma/client';
import { z } from 'zod';

const reviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
  newDeadline: z.string().optional(),
  note: z.string().optional(),
});

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string; milestoneId: string }> }
) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const { id: userId, companyId, baseLevel } = userOrResponse;

  const params = await props.params;
  const { id: taskId, milestoneId } = params;

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { 
        milestones: { where: { id: milestoneId } },
        assignee: true
      },
    });

    if (!task || task.milestones.length === 0) {
      return NextResponse.json({ error: 'Task or Milestone not found' }, { status: 404 });
    }

    if (task.createdById !== userId && baseLevel !== 'ADMIN' && task.assignee?.managerId !== userId) {
      return NextResponse.json({ error: 'Only task creator, ADMIN, or assignee\'s manager can review milestones' }, { status: 403 });
    }

    const milestone = task.milestones[0];

    if (milestone.status !== MilestoneStatus.SUBMITTED) {
      return NextResponse.json({ error: 'Milestone must be in SUBMITTED status to review' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

    const { action, newDeadline, note } = parsed.data;

    if (action === 'reject' && !newDeadline) {
      return NextResponse.json({ error: 'newDeadline is required when rejecting' }, { status: 400 });
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      if (action === 'approve') {
        await tx.milestone.update({
          where: { id: milestoneId },
          data: {
            status: MilestoneStatus.APPROVED,
            approvedAt: now,
          },
        });

        // Check if all milestones are approved → complete the task
        const allMilestones = await tx.milestone.findMany({ where: { taskId } });
        const allApproved = allMilestones.every(m =>
          m.id === milestoneId ? true : m.status === MilestoneStatus.APPROVED
        );

        if (allApproved) {
          await tx.task.update({
            where: { id: taskId },
            data: { state: TaskState.COMPLETED },
          });
        }

        if (task.assigneeId) {
          await tx.notification.create({
            data: {
              companyId,
              userId: task.assigneeId,
              type: 'milestone.approved',
              title: 'Milestone Approved',
              body: `Your milestone "${milestone.name}" has been approved!`,
              entityType: EntityType.MILESTONE,
              entityId: milestoneId,
            },
          });
        }
      } else {
        await tx.milestone.update({
          where: { id: milestoneId },
          data: {
            status: MilestoneStatus.REJECTED,
            rejectedAt: now,
            newDeadline: newDeadline ? new Date(newDeadline) : undefined,
          },
        });

        if (task.assigneeId) {
          await tx.notification.create({
            data: {
              companyId,
              userId: task.assigneeId,
              type: 'milestone.rejected',
              title: 'Milestone Rejected',
              body: `Your milestone "${milestone.name}" was rejected. New deadline set.`,
              entityType: EntityType.MILESTONE,
              entityId: milestoneId,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          userId,
          companyId,
          action: action === 'approve' ? 'milestone.approved' : 'milestone.rejected',
          entityType: EntityType.MILESTONE,
          entityId: milestoneId,
          metadata: { note },
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Milestone review error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
