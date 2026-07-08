import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '@/app/api/helper';
import { requirePermission } from '@/lib/rbac';
import { requireSameCompany } from '@/lib/tenant';
import { BaseLevel, EntityType, Priority, TaskState, MilestoneStatus } from '@prisma/client';
import { z } from 'zod';

function getTaskScope(user: { id: string; companyId: string; departmentId: string | null; baseLevel: BaseLevel }) {
  if (user.baseLevel === 'ADMIN') return { companyId: user.companyId };
  if (user.baseLevel === 'MANAGER') return { companyId: user.companyId };
  return { companyId: user.companyId, assigneeId: user.id };
}

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const { id: userId } = userOrResponse;

  const params = await props.params;
  const { id } = params;

  try {
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignee: true,
        createdBy: true,
        taskStatus: true,
        department: true,
        milestones: {
          orderBy: { position: 'asc' },
          include: { submissions: { orderBy: { createdAt: 'desc' }, take: 1 } },
        },
      },
    });

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    await requireSameCompany(userId, task.companyId);

    // Apply visibility scope
    const scope = getTaskScope(userOrResponse);
    if (scope.assigneeId && task.assigneeId !== scope.assigneeId) {
      return NextResponse.json({ error: 'Task not found in your scope' }, { status: 404 });
    }

    const totalMilestones = task.milestones.length;
    const approvedMilestones = task.milestones.filter((m) => m.status === MilestoneStatus.APPROVED).length;
    const now = Date.now();

    const milestonesWithOverdue = task.milestones.map((m) => ({
      ...m,
      isOverdue: m.dueDate.getTime() < now && m.status !== MilestoneStatus.APPROVED,
    }));

    return NextResponse.json({
      ...task,
      milestones: milestonesWithOverdue,
      milestoneProgress: totalMilestones > 0 ? approvedMilestones / totalMilestones : 0,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  priority: z.nativeEnum(Priority).optional(),
  dueDate: z.string().refine((date) => new Date(date).getTime() > Date.now(), 'dueDate must be in the future').optional(),
  taskStatusId: z.string().optional(),
  assigneeId: z.string().nullable().optional(),
});

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const { id: userId, companyId, baseLevel } = userOrResponse;

  const permCheck = await requirePermission(request, 'edit_task');
  if (permCheck) return permCheck;

  const params = await props.params;
  const { id } = params;

  try {
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    await requireSameCompany(userId, task.companyId);

    if (task.createdById !== userId && baseLevel !== 'MANAGER' && baseLevel !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Only task creator or MANAGER+ can edit tasks.' }, { status: 403 });
    }

    if (task.state === TaskState.COMPLETED) {
      return NextResponse.json({ error: 'Cannot edit a COMPLETED task' }, { status: 400 });
    }

    if (task.isArchived) {
      return NextResponse.json({ error: 'Cannot edit an archived task' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = updateTaskSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

    const data = parsed.data;

    if (data.assigneeId !== undefined && data.assigneeId !== null) {
      const assignee = await prisma.user.findUnique({ where: { id: data.assigneeId } });
      if (!assignee || assignee.companyId !== companyId) {
        return NextResponse.json({ error: 'Invalid assigneeId' }, { status: 400 });
      }
      if (assignee.baseLevel === 'ADMIN') {
        return NextResponse.json({ error: 'Cannot assign tasks to ADMIN users' }, { status: 400 });
      }
    }

    if (data.taskStatusId !== undefined) {
      const statusObj = await prisma.taskStatus.findUnique({ where: { id: data.taskStatusId } });
      if (!statusObj || statusObj.companyId !== companyId) {
        return NextResponse.json({ error: 'Invalid taskStatusId' }, { status: 400 });
      }
    }

    await prisma.$transaction(async (tx) => {
      const updatedTask = await tx.task.update({
        where: { id },
        data: {
          ...data,
          ...(data.dueDate ? { dueDate: new Date(data.dueDate) } : {}),
        },
      });

      if (data.assigneeId !== undefined && data.assigneeId !== task.assigneeId) {
        if (data.assigneeId) {
          await tx.notification.create({
            data: {
              companyId,
              userId: data.assigneeId,
              type: 'task.assigned',
              title: 'New Task Assigned',
              body: `You have been assigned to task: "${updatedTask.title}"`,
              entityType: EntityType.TASK,
              entityId: updatedTask.id,
            },
          });
        }
        if (task.assigneeId) {
          await tx.notification.create({
            data: {
              companyId,
              userId: task.assigneeId,
              type: 'task.unassigned',
              title: 'Task Unassigned',
              body: `You have been unassigned from task: "${updatedTask.title}"`,
              entityType: EntityType.TASK,
              entityId: updatedTask.id,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          userId,
          companyId,
          action: 'task.updated',
          entityType: EntityType.TASK,
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

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const { id: userId, companyId, baseLevel } = userOrResponse;

  const permCheck = await requirePermission(request, 'delete_task');
  if (permCheck) return permCheck;

  const params = await props.params;
  const { id } = params;

  try {
    const task = await prisma.task.findUnique({
      where: { id },
      include: { milestones: true },
    });
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    await requireSameCompany(userId, task.companyId);

    if (task.createdById !== userId && baseLevel !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Only task creator or ADMIN can archive tasks.' }, { status: 403 });
    }

    const hasPendingMilestones = task.milestones.some(
      (m) => m.status === MilestoneStatus.SUBMITTED || m.status === MilestoneStatus.IN_REVIEW
    );

    if (hasPendingMilestones) {
      return NextResponse.json({ error: 'Task has pending milestone reviews' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id },
        data: { isArchived: true },
      });

      await tx.auditLog.create({
        data: {
          userId,
          companyId,
          action: 'task.archived',
          entityType: EntityType.TASK,
          entityId: id,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
