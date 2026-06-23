import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '../../helper';
import { requirePermission } from '@/lib/rbac';
import { BaseLevel, EntityType, InviteStatus } from '@prisma/client';
import * as xlsx from 'xlsx';

export async function POST(request: Request) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const { id: userId, companyId } = userOrResponse;

  const permCheck = await requirePermission(request, 'create_user');
  if (permCheck) return permCheck;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = xlsx.read(arrayBuffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rows = xlsx.utils.sheet_to_json(worksheet) as any[];

    const result = {
      created: 0,
      skipped: 0,
      failed: 0,
      errors: [] as { row: number; email: string; reason: string }[],
    };

    // Load necessary company context
    const departments = await prisma.department.findMany({ where: { companyId } });
    const existingUsers = await prisma.user.findMany({ where: { companyId } });
    const roles = await prisma.role.findMany({ where: { companyId } });
    const existingInvites = await prisma.invite.findMany({ where: { companyId } });

    const deptMap = new Map(departments.map((d) => [d.name.toLowerCase(), d.id]));
    const emailSet = new Set(existingUsers.map((u) => u.email.toLowerCase()));
    const inviteEmailSet = new Set(existingInvites.map((i) => i.email.toLowerCase()));
    const managerEmailMap = new Map(existingUsers.map((u) => [u.email.toLowerCase(), u.id]));

    const validInvitesToCreate: any[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // Assuming header on row 1
      const row = rows[i];
      
      const name = row['Name'];
      const email = row['Email']?.toString().toLowerCase();
      const designation = row['Designation'];
      const departmentName = row['Department'];
      const rawBaseLevel = row['Base Level'];
      const managerEmail = row['Manager Email']?.toString().toLowerCase();

      if (!email) {
        result.failed++;
        result.errors.push({ row: rowNum, email: 'Missing', reason: 'Email is required' });
        continue;
      }

      if (emailSet.has(email) || inviteEmailSet.has(email)) {
        result.skipped++;
        continue;
      }

      let departmentId: string | undefined = undefined;
      if (departmentName) {
        departmentId = deptMap.get(departmentName.toString().toLowerCase());
        if (!departmentId) {
          result.failed++;
          result.errors.push({ row: rowNum, email, reason: `Department '${departmentName}' not found` });
          continue;
        }
      }

      let baseLevel: BaseLevel;
      if (rawBaseLevel === 'Admin') baseLevel = BaseLevel.ADMIN;
      else if (rawBaseLevel === 'Manager') baseLevel = BaseLevel.MANAGER;
      else if (rawBaseLevel === 'Member') baseLevel = BaseLevel.MEMBER;
      else {
        result.failed++;
        result.errors.push({ row: rowNum, email, reason: `Invalid Base Level '${rawBaseLevel}'` });
        continue;
      }

      const role = roles.find((r) => r.baseLevel === baseLevel);
      if (!role) {
        result.failed++;
        result.errors.push({ row: rowNum, email, reason: `Role for base level '${baseLevel}' not found` });
        continue;
      }

      let managerId: string | undefined = undefined;
      if (managerEmail) {
        managerId = managerEmailMap.get(managerEmail);
        if (!managerId) {
          result.failed++;
          result.errors.push({ row: rowNum, email, reason: `Manager email '${managerEmail}' not found` });
          continue;
        }
      }

      validInvitesToCreate.push({
        companyId,
        roleId: role.id,
        email,
        name: name?.toString(),
        designation: designation?.toString(),
        departmentId,
        managerId,
        status: InviteStatus.PENDING,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      // Optimistically add to sets to prevent duplicates in the same file
      inviteEmailSet.add(email);
    }

    if (validInvitesToCreate.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.invite.createMany({
          data: validInvitesToCreate,
        });

        result.created = validInvitesToCreate.length;

        await tx.auditLog.create({
          data: {
            userId,
            companyId,
            action: 'bulk_upload.completed',
            entityType: EntityType.INVITE,
            entityId: companyId,
            metadata: {
              created: result.created,
              skipped: result.skipped,
              failed: result.failed,
            },
          },
        });
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
