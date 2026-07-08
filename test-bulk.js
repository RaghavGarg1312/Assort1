const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findFirst();
  if (!company) { console.log('No company'); return; }
  const companyId = company.id;

  const rolesData = [
    { name: 'MD', level: 1, baseLevel: 'MANAGER' },
    { name: 'ED', level: 2, baseLevel: 'MANAGER' },
    { name: 'VP', level: 3, baseLevel: 'MANAGER' },
    { name: 'Team Lead', level: 4, baseLevel: 'MANAGER' },
    { name: 'Member', level: 5, baseLevel: 'MEMBER' },
  ];

  try {
    const createdRoles = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const roleData of rolesData) {
        const newRole = await tx.role.create({
          data: {
            name: roleData.name.trim(),
            level: roleData.level,
            baseLevel: roleData.baseLevel,
            companyId,
          },
        });

        await tx.auditLog.create({
          data: {
            userId: 'fake-user-id',
            companyId,
            action: 'role.created',
            entityType: 'ROLE',
            entityId: newRole.id,
          },
        });
        results.push(newRole);
      }
      return results;
    });
    console.log(createdRoles);
  } catch (err) {
    console.error('ERROR TRACE:', err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
