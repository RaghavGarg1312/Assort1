const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: { contains: 'gp2' } },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: { permission: true }
          }
        }
      }
    }
  });
  console.log(JSON.stringify(user?.role?.rolePermissions.map(rp => rp.permission.code), null, 2));
}

main().finally(() => prisma.$disconnect());
