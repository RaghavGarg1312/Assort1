import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '@/app/api/helper';
import { computeUserStats } from '@/lib/stats';
import { TaskState } from '@prisma/client';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const targetUserId = params.id;

  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;

  const { companyId } = userOrResponse;

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        department: { select: { name: true } },
        manager: { select: { name: true } },
        company: { select: { showProfileStats: true } },
        tasksAssigned: {
          where: { state: TaskState.COMPLETED },
          orderBy: { updatedAt: 'desc' },
          take: 10,
          select: { title: true, state: true },
        },
      },
    });

    if (!targetUser || targetUser.companyId !== companyId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const {
      name,
      baseLevel,
      designation,
      avatarUrl,
      createdAt,
      department,
      manager,
      company,
      tasksAssigned: pastTasks,
    } = targetUser;

    const joinedAtMs = Date.now() - createdAt.getTime();
    const joinedAtMonths = Math.floor(joinedAtMs / (1000 * 60 * 60 * 24 * 30));
    let joinedAtStr = `${joinedAtMonths} months ago`;
    if (joinedAtMonths >= 12) {
      const years = Math.floor(joinedAtMonths / 12);
      joinedAtStr = `${years} year${years > 1 ? 's' : ''} ago`;
    } else if (joinedAtMonths === 0) {
      joinedAtStr = 'Recently joined';
    }

    const baseProfile = {
      name,
      baseLevel,
      designation,
      departmentName: department?.name || null,
      managerName: manager?.name || null,
      avatarUrl,
      joinedAt: joinedAtStr,
      pastTasks,
    };

    if (company?.showProfileStats) {
      const stats = await computeUserStats(targetUserId, companyId);
      return NextResponse.json({
        ...baseProfile,
        tasksCompleted: stats.tasksCompleted,
        onTimePercent: stats.onTimePercent,
        firstApprovalRate: stats.firstApprovalRate,
        currentStreak: stats.currentStreak,
        activeTasks: stats.activeTasks,
      });
    }

    // Hide stats
    return NextResponse.json({
      ...baseProfile,
      tasksCompleted: null,
      onTimePercent: null,
      firstApprovalRate: null,
      currentStreak: null,
      activeTasks: null,
    });
  } catch (error) {
    console.error('Public profile GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
