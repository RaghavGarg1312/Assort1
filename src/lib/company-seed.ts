// src/lib/company-seed.ts
// Called inside a transaction whenever a new company is created.
// Seeds: 4 roles + permission mappings + 4 default TaskStatuses

import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, BaseLevel } from '@prisma/client'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// Which permission codes each base level gets
const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: [
    'create_user',
    'edit_user',
    'deactivate_user',
    'create_department',
    'edit_department',
    'delete_department',
    'view_audit_logs',
    'manage_roles',
  ],
  manager: [
    'create_task',
    'edit_task',
    'delete_task',
    'assign_task',
    'comment_task',
    'upload_attachment',
  ],
  member: [
    'comment_task',
    'upload_attachment',
  ],
  viewer: [
    'comment_task',
  ],
}

const DEFAULT_TASK_STATUSES = [
  { name: 'To Do',       color: '#6B7280', position: 1, isDefault: true,  isCompleted: false },
  { name: 'In Progress', color: '#3B82F6', position: 2, isDefault: false, isCompleted: false },
  { name: 'In Review',   color: '#F59E0B', position: 3, isDefault: false, isCompleted: false },
  { name: 'Done',        color: '#10B981', position: 4, isDefault: false, isCompleted: true  },
]

const BASE_LEVEL_MAP: Record<string, BaseLevel> = {
  admin:   BaseLevel.ADMIN,
  manager: BaseLevel.MANAGER,
  member:  BaseLevel.MEMBER,
  viewer:  BaseLevel.VIEWER,
}

export async function seedNewCompany(companyId: string) {
  // Fetch all global permissions upfront
  const allPermissions = await prisma.permission.findMany()
  const permissionMap = Object.fromEntries(allPermissions.map(p => [p.code, p.id]))

  await prisma.$transaction(async (tx) => {
    // 1. Seed 4 roles for this company
    for (const roleName of Object.keys(ROLE_PERMISSIONS)) {
      const role = await tx.role.create({
        data: {
          companyId,
          name:      roleName,
          baseLevel: BASE_LEVEL_MAP[roleName],
        },
      })

      // 2. Attach permissions to this role
      const codes = ROLE_PERMISSIONS[roleName]
      for (const code of codes) {
        const permissionId = permissionMap[code]
        if (!permissionId) {
          throw new Error(`Permission code "${code}" not found. Run prisma db seed first.`)
        }
        await tx.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId,
          },
        })
      }
    }

    // 3. Seed 4 default TaskStatuses for this company
    for (const status of DEFAULT_TASK_STATUSES) {
      await tx.taskStatus.create({
        data: {
          companyId,
          ...status,
        },
      })
    }
  })

  console.log(`✅ Company ${companyId} seeded: roles, permissions, task statuses.`)
}