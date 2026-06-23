import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '@/app/api/helper';
import { TaskState, MilestoneStatus } from '@prisma/client';

export async function GET(request: Request) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;

  const { id: userId, companyId, baseLevel } = userOrResponse;

  if (baseLevel === 'MEMBER' || baseLevel === 'VIEWER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    let targetUserIds: string[] = [];

    if (baseLevel === 'ADMIN') {
      const users = await prisma.user.findMany({
        where: { companyId, baseLevel: { not: 'ADMIN' } },
        select: { id: true },
      });
      targetUserIds = users.map((u) => u.id);
    } else if (baseLevel === 'MANAGER') {
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

      const queue = [userId];
      while (queue.length > 0) {
        const currentId = queue.shift()!;
        const directReports = reportsMap.get(currentId) || [];
        for (const reportId of directReports) {
          targetUserIds.push(reportId);
          queue.push(reportId);
        }
      }
    }

    if (targetUserIds.length === 0) {
      return NextResponse.json([]);
    }

    const teamData = await prisma.user.findMany({
      where: { id: { in: targetUserIds } },
      select: {
        id: true,
        name: true,
        designation: true,
        avatarUrl: true,
        tasksAssigned: {
          include: {
            milestones: {
              include: {
                submissions: { orderBy: { attemptNumber: 'asc' } },
              },
            },
          },
        },
      },
    });

    const result = teamData.map((user) => {
      let activeTasks = 0;
      let totalMilestonesInActiveTasks = 0;
      let approvedMilestonesInActiveTasks = 0;
      let nextDeadline: Date | null = null;

      let totalFirstSubmissions = 0;
      let onTimeFirstSubmissions = 0;

      for (const task of user.tasksAssigned) {
        if (task.state === TaskState.ACTIVE) {
          activeTasks++;
          totalMilestonesInActiveTasks += task.milestones.length;
          
          if (!nextDeadline || task.dueDate < nextDeadline) {
            nextDeadline = task.dueDate;
          }

          for (const milestone of task.milestones) {
            if (milestone.status === MilestoneStatus.APPROVED) {
              approvedMilestonesInActiveTasks++;
            }
          }
        }

        // On-time percent across all historical tasks
        for (const milestone of task.milestones) {
          const firstSubmission = milestone.submissions.find((s) => s.attemptNumber === 1);
          if (firstSubmission) {
            totalFirstSubmissions++;
            const submittedAt = milestone.submittedAt;
            if (submittedAt && submittedAt <= milestone.dueDate) {
              onTimeFirstSubmissions++;
            }
          }
        }
      }

      const overallProgress = totalMilestonesInActiveTasks > 0
        ? (approvedMilestonesInActiveTasks / totalMilestonesInActiveTasks) * 100
        : 0;

      const onTimePercent = totalFirstSubmissions > 0
        ? (onTimeFirstSubmissions / totalFirstSubmissions) * 100
        : 0;

      return {
        userId: user.id,
        name: user.name,
        designation: user.designation,
        avatarUrl: user.avatarUrl,
        activeTasks,
        overallProgress: Math.round(overallProgress),
        nextDeadline,
        onTimePercent: Math.round(onTimePercent),
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Team dashboard GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
