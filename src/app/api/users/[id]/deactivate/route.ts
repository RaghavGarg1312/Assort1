import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '../../../helper';
import { requirePermission } from '@/lib/rbac';
import { requireSameCompany } from '@/lib/tenant';
import { EntityType, UserStatus } from '@prisma/client';

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const { id: userId, companyId } = userOrResponse;

  const permCheck = await requirePermission(request, 'deactivate_user');
  if (permCheck) return permCheck;

  const params = await props.params;
  const { id } = params;

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    await requireSameCompany(userId, user.companyId!);

    if (user.baseLevel === 'ADMIN') {
      return NextResponse.json({ error: 'Cannot deactivate an ADMIN' }, { status: 403 });
    }

    if (user.status === UserStatus.DEACTIVATED) {
      return NextResponse.json({ success: true });
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { status: UserStatus.DEACTIVATED },
      });

      const tasks = await tx.task.findMany({
        where: { assigneeId: id },
        select: { id: true, createdById: true, title: true },
      });

      if (tasks.length > 0) {
        await tx.task.updateMany({
          where: { assigneeId: id },
          data: {
            assigneeId: null,
            previousAssigneeId: id,
          },
        });

        const notifications = tasks.map((task) => ({
          companyId,
          userId: task.createdById,
          type: 'TASK_UNASSIGNED',
          title: 'Task Unassigned',
          body: `Task "${task.title}" has been unassigned because the assignee was deactivated.`,
          entityType: EntityType.TASK,
          entityId: task.id,
        }));

        await tx.notification.createMany({
          data: notifications,
        });
      }

      await tx.auditLog.create({
        data: {
          userId,
          companyId,
          action: 'user.deactivated',
          entityType: EntityType.USER,
          entityId: id,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
