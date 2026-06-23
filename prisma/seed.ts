// prisma/seed.ts
// Run with: npx prisma db seed
// Seeds global Permission rows — runs once, idempotent (safe to re-run)

import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const PERMISSIONS = [
  'create_task',
  'edit_task',
  'delete_task',
  'assign_task',
  'comment_task',
  'upload_attachment',
  'create_user',
  'edit_user',
  'deactivate_user',
  'create_department',
  'edit_department',
  'delete_department',
  'view_audit_logs',
  'manage_roles',
]

async function main() {
  console.log('Seeding global permissions...')

  for (const code of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      update: {},   // already exists — do nothing
      create: { code },
    })
  }

  console.log(`✅ ${PERMISSIONS.length} permissions seeded.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })