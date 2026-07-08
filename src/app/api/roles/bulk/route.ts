import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '../../helper';
import { requirePermission } from '@/lib/rbac';
import { z } from 'zod';
import { EntityType, BaseLevel } from '@prisma/client';

const roleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  level: z.number().int().min(1),
  baseLevel: z.enum(['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER']), // explicitly excluding SUPERADMIN
});

const bulkRolesSchema = z.array(roleSchema).min(1, "At least one role is required");

export async function POST(request: Request) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const { id: userId, companyId } = userOrResponse;

  const permCheck = await requirePermission(request, 'manage_roles');
  if (permCheck) return permCheck;

  try {
    const body = await request.json();
    const parsed = bulkRolesSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 });
    }

    const rolesData = parsed.data;

    // 1. Check for duplicates in the payload itself
    const namesInPayload = new Set<string>();
    for (let i = 0; i < rolesData.length; i++) {
      const name = rolesData[i].name.trim();
      if (namesInPayload.has(name.toLowerCase())) {
        return NextResponse.json({ error: `Duplicate role name in submission: ${name}` }, { status: 400 });
      }
      namesInPayload.add(name.toLowerCase());
    }

    // 2. Check for duplicates against the database
    const existingRoles = await prisma.role.findMany({
      where: {
        companyId,
        name: {
          in: rolesData.map(r => r.name.trim())
        }
      }
    });

    if (existingRoles.length > 0) {
      const existingNames = existingRoles.map(r => r.name).join(', ');
      return NextResponse.json({ error: `Roles with these names already exist: ${existingNames}` }, { status: 400 });
    }

    // 3. Create roles and audit logs in a transaction
    const createdRoles = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const roleData of rolesData) {
        const newRole = await tx.role.create({
          data: {
            name: roleData.name.trim(),
            level: roleData.level,
            baseLevel: roleData.baseLevel as BaseLevel,
            companyId,
          },
        });

        await tx.auditLog.create({
          data: {
            userId,
            companyId,
            action: 'role.created',
            entityType: EntityType.ROLE,
            entityId: newRole.id,
          },
        });
        results.push(newRole);
      }
      return results;
    });

    return NextResponse.json(createdRoles, { status: 201 });
  } catch (error) {
    console.error('Bulk role creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
