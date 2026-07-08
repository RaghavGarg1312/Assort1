const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const superadmins = await prisma.user.findMany({
    where: { companyId: null }
  });
  console.log(JSON.stringify(superadmins, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
