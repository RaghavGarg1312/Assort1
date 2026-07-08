import prisma from './src/lib/prisma';

async function main() {
  const subs = await prisma.milestoneSubmission.findMany({ 
    orderBy: { createdAt: 'desc' }, 
    take: 5, 
    select: { id: true, note: true, milestoneId: true, submittedById: true } 
  }); 
  console.log('Submissions:', JSON.stringify(subs, null, 2)); 
}
main().catch(console.error).finally(() => prisma.$disconnect());
