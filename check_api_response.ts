import prisma from './src/lib/prisma';
import { MilestoneStatus } from '@prisma/client';

async function main() {
  const id = 'cmrcawe2m00155omxzr9j8k7q'; // valid task id from earlier errors, wait no let's just use findFirst
  const task = await prisma.task.findFirst({
    where: { milestones: { some: { submissions: { some: { note: { not: null } } } } } },
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

  if (!task) {
    console.log("No task found");
    return;
  }

  const totalMilestones = task.milestones.length;
  const approvedMilestones = task.milestones.filter((m) => m.status === MilestoneStatus.APPROVED).length;
  const now = Date.now();

  const milestonesWithOverdue = task.milestones.map((m) => ({
    ...m,
    isOverdue: m.dueDate.getTime() < now && m.status !== MilestoneStatus.APPROVED,
  }));

  const responseBody = {
    ...task,
    milestones: milestonesWithOverdue,
    milestoneProgress: totalMilestones > 0 ? approvedMilestones / totalMilestones : 0,
  };

  console.log("JSON response milestones:");
  console.log(JSON.stringify(responseBody.milestones, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
