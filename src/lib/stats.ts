import prisma from '@/lib/prisma';
import { TaskState, MilestoneStatus } from '@prisma/client';

export async function computeUserStats(userId: string, companyId: string) {
  const tasks = await prisma.task.findMany({
    where: { assigneeId: userId, companyId },
    include: {
      milestones: {
        include: {
          submissions: {
            orderBy: { attemptNumber: 'asc' },
          },
        },
      },
    },
    orderBy: { updatedAt: 'asc' }, // for streak calculation
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { baseLevel: true }
  });

  let totalUsers = 0;
  let totalDepartments = 0;

  if (user?.baseLevel === 'ADMIN') {
    totalUsers = await prisma.user.count({ where: { companyId } });
    totalDepartments = await prisma.department.count({ where: { companyId } });
  }

  let tasksCompleted = 0;
  let activeTasks = 0;
  let overdueTasks = 0;

  let totalFirstSubmissions = 0;
  let onTimeFirstSubmissions = 0;

  let totalApprovedMilestones = 0;
  let firstTryApprovals = 0;

  let resubmissionCount = 0;

  let totalReviewTurnaroundHours = 0;
  let reviewTurnaroundCount = 0;

  // Track streak
  let currentStreak = 0;

  for (const task of tasks) {
    if (task.state === TaskState.COMPLETED) tasksCompleted++;
    if (task.state === TaskState.ACTIVE) activeTasks++;
    if (task.state === TaskState.OVERDUE) overdueTasks++;

    let taskFirstSubmissionsAllOnTime = true;
    let taskHasSubmissions = false;

    for (const milestone of task.milestones) {
      if (milestone.status === MilestoneStatus.APPROVED) {
        totalApprovedMilestones++;
      }

      // First submission logic
      const firstSubmission = milestone.submissions.find((s) => s.attemptNumber === 1);
      if (firstSubmission) {
        taskHasSubmissions = true;
        totalFirstSubmissions++;

        // On time check: milestone.submittedAt <= milestone.dueDate
        // Wait, milestone.submittedAt is set on the first submission
        const submittedAt = milestone.submittedAt;
        if (submittedAt && submittedAt <= milestone.dueDate) {
          onTimeFirstSubmissions++;
        } else {
          taskFirstSubmissionsAllOnTime = false;
        }

        // First approval check
        // If it was approved, and it only took 1 attempt
        if (milestone.status === MilestoneStatus.APPROVED && milestone.submissions.length === 1) {
          firstTryApprovals++;
        }
      } else {
        taskFirstSubmissionsAllOnTime = false; // No submissions = not on time
      }

      // Resubmissions
      const resubmissions = milestone.submissions.filter((s) => s.attemptNumber > 1);
      resubmissionCount += resubmissions.length;

      // Review turnaround
      for (const sub of milestone.submissions) {
        if (sub.reviewedAt && milestone.submittedAt) { // Wait, sub.createdAt is submission time
          const timeDiffMs = sub.reviewedAt.getTime() - sub.createdAt.getTime();
          totalReviewTurnaroundHours += timeDiffMs / (1000 * 60 * 60);
          reviewTurnaroundCount++;
        }
      }
    }

    // Streak logic: evaluated only for completed tasks
    if (task.state === TaskState.COMPLETED) {
      if (taskHasSubmissions && taskFirstSubmissionsAllOnTime) {
        currentStreak++;
      } else {
        currentStreak = 0; // Streak broken
      }
    }
  }

  const onTimePercent = totalFirstSubmissions > 0 ? (onTimeFirstSubmissions / totalFirstSubmissions) * 100 : 0;
  const firstApprovalRate = totalApprovedMilestones > 0 ? (firstTryApprovals / totalApprovedMilestones) * 100 : 0;
  const averageManagerReviewTurnaround = reviewTurnaroundCount > 0 ? totalReviewTurnaroundHours / reviewTurnaroundCount : 0;

  return {
    tasksCompleted,
    onTimePercent: Math.round(onTimePercent),
    firstApprovalRate: Math.round(firstApprovalRate),
    resubmissionCount,
    currentStreak,
    activeTasks,
    overdueTasks,
    averageManagerReviewTurnaround: Math.round(averageManagerReviewTurnaround * 10) / 10,
    ...(user?.baseLevel === 'ADMIN' ? { totalUsers, totalDepartments } : {})
  };
}
