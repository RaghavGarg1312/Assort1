import prisma from './src/lib/prisma';

async function main() {
  const task = await prisma.task.findFirst({
    where: {
      milestones: {
        some: {
          submissions: {
            some: {
              note: { not: null }
            }
          }
        }
      }
    },
    include: {
      milestones: {
        include: {
          submissions: true
        }
      }
    }
  });

  if (!task) {
    console.log("No task found with milestone submissions containing notes.");
    return;
  }

  console.log("Task ID:", task.id);
  console.log(JSON.stringify(task.milestones.map(m => m.submissions), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
