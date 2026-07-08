import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '@/app/api/helper';
import { requirePermission } from '@/lib/rbac';
import { BaseLevel, EntityType, Priority, TaskState, MilestoneStatus } from '@prisma/client';
import { z } from 'zod';

function getTaskScope(user: { id: string; companyId: string; departmentId: string | null; baseLevel: BaseLevel }) {
  if (user.baseLevel === 'ADMIN') {
    return { companyId: user.companyId };
  }
  if (user.baseLevel === 'MANAGER') {
    return { companyId: user.companyId };
  }
  return { companyId: user.companyId, assigneeId: user.id };
}

export async function GET(request: Request) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const state = url.searchParams.get('state');
  const priority = url.searchParams.get('priority');
  const assigneeId = url.searchParams.get('assigneeId');
  const dueBefore = url.searchParams.get('dueBefore');
  const dueAfter = url.searchParams.get('dueAfter');
  const archived = url.searchParams.get('archived') === 'true';

  const scope = getTaskScope(userOrResponse);

  const filter: any = {
    ...scope,
    isArchived: archived,
  };

  if (status) filter.taskStatusId = status;
  if (state) filter.state = state as TaskState;
  if (priority) filter.priority = priority as Priority;
  if (assigneeId && (userOrResponse.baseLevel === 'ADMIN' || userOrResponse.baseLevel === 'MANAGER')) {
    filter.assigneeId = assigneeId;
  }
  if (dueBefore || dueAfter) {
    filter.dueDate = {};
    if (dueBefore) filter.dueDate.lte = new Date(dueBefore);
    if (dueAfter) filter.dueDate.gte = new Date(dueAfter);
  }

  try {
    const tasks = await prisma.task.findMany({
      where: filter,
      include: {
        taskStatus: { select: { id: true, name: true, color: true } },
        assignee: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        milestones: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedTasks = tasks.map((task) => {
      const totalMilestones = task.milestones.length;
      const approvedMilestones = task.milestones.filter((m) => m.status === MilestoneStatus.APPROVED).length;

      return {
        id: task.id,
        title: task.title,
        priority: task.priority,
        status: task.taskStatus,
        assignee: task.assignee,
        createdBy: task.createdBy,
        dueDate: task.dueDate,
        state: task.state,
        completedMilestones: approvedMilestones,
        totalMilestones: totalMilestones,
        milestoneProgress: totalMilestones > 0 ? approvedMilestones / totalMilestones : 0,
        isArchived: task.isArchived,
      };
    });

    return NextResponse.json(formattedTasks);
  } catch (error) {
    console.error('Task GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.nativeEnum(Priority),
  dueDate: z.string().refine((date) => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return false;
    // 24-hour buffer handles global timezone edge cases where
    // a user's "today" is the server's "yesterday".
    return d.getTime() >= Date.now() - 24 * 60 * 60 * 1000;
  }, 'dueDate must be today or in the future'),
  assigneeId: z.string().nullable().optional(),
  taskStatusId: z.string(),
  departmentId: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const { id: userId, companyId, baseLevel } = userOrResponse;

  if (baseLevel === 'MEMBER' || baseLevel === 'VIEWER') {
    return NextResponse.json({ error: 'Forbidden. MEMBERs cannot create tasks.' }, { status: 403 });
  }

  // The baseLevel check above correctly guards this route for ADMINs and MANAGERs.
  // We bypass the explicit `requirePermission` check because custom roles created via
  // bulk upload currently don't have the `create_task` permission code mapped to them.

  try {
    const body = await request.json();
    const parsed = createTaskSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

    const { title, description, priority, dueDate, assigneeId, taskStatusId, departmentId } = parsed.data;

    // Validate status belongs to company
    const statusObj = await prisma.taskStatus.findUnique({ where: { id: taskStatusId } });
    if (!statusObj || statusObj.companyId !== companyId) {
      return NextResponse.json({ error: 'Invalid taskStatusId' }, { status: 400 });
    }

    if (departmentId) {
      const deptObj = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!deptObj || deptObj.companyId !== companyId) {
        return NextResponse.json({ error: 'Invalid departmentId' }, { status: 400 });
      }
    }

    if (assigneeId) {
      const assignee = await prisma.user.findUnique({ where: { id: assigneeId } });
      if (!assignee || assignee.companyId !== companyId) {
        return NextResponse.json({ error: 'Invalid assigneeId' }, { status: 400 });
      }
      if (assignee.baseLevel === 'ADMIN') {
        return NextResponse.json({ error: 'Cannot assign tasks to ADMIN users' }, { status: 400 });
      }

      if (baseLevel === 'MANAGER') {
        // Build in-memory chain to verify the assignee reports to this MANAGER
        const allUsers = await prisma.user.findMany({
          where: { companyId },
          select: { id: true, managerId: true },
        });

        const reportsMap = new Map<string, string[]>();
        for (const u of allUsers) {
          if (u.managerId) {
            if (!reportsMap.has(u.managerId)) reportsMap.set(u.managerId, []);
            reportsMap.get(u.managerId)!.push(u.id);
          }
        }

        let found = false;
        const queue = [userId];
        while (queue.length > 0) {
          const currentId = queue.shift()!;
          if (currentId === assigneeId) {
            found = true;
            break;
          }
          const directReports = reportsMap.get(currentId) || [];
          queue.push(...directReports);
        }

        if (!found) {
          return NextResponse.json({ error: 'Assignee is not in your reporting chain' }, { status: 400 });
        }
      }
    }

    const task = await prisma.$transaction(async (tx) => {
      const newTask = await tx.task.create({
        data: {
          companyId,
          title,
          description,
          priority,
          dueDate: new Date(dueDate),
          assigneeId,
          taskStatusId,
          departmentId,
          createdById: userId,
          state: TaskState.ACTIVE,
        },
      });

      if (assigneeId) {
        await tx.notification.create({
          data: {
            companyId,
            userId: assigneeId,
            type: 'task.assigned',
            title: 'New Task Assigned',
            body: `You have been assigned to task: "${title}"`,
            entityType: EntityType.TASK,
            entityId: newTask.id,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId,
          companyId,
          action: 'task.created',
          entityType: EntityType.TASK,
          entityId: newTask.id,
        },
      });

      return newTask;
    }, { timeout: 30000 });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('Task creation error:', JSON.stringify(error, null, 2));
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
