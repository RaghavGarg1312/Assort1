import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '../../helper';
import { requirePermission } from '@/lib/rbac';
import { EntityType, UserStatus } from '@prisma/client';
import * as xlsx from 'xlsx';
import { hashPassword } from '@/lib/password';
import nodemailer from 'nodemailer';

export async function GET(request: Request) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;

  const permCheck = await requirePermission(request, 'create_user');
  if (permCheck) return permCheck;

  try {
    const workbook = xlsx.utils.book_new();
    const worksheetData = [
      ['Name', 'Email', 'Role', 'Designation', 'Department', 'Manager Email'],
      ['Rahul Sharma', 'rahul@company.com', 'Manager', 'Senior Manager', 'Sales', 'vp@company.com']
    ];
    
    const worksheet = xlsx.utils.aoa_to_sheet(worksheetData);
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Template');
    
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="assort1_users_template.xlsx"'
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 });
  }
}

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

    const [deptCount, roleCount] = await Promise.all([
      prisma.department.count({ where: { companyId } }),
      prisma.role.count({ where: { companyId, name: { not: 'Company Admin' } } })
    ]);

    if (deptCount === 0 || roleCount === 0) {
      return NextResponse.json(
        { error: 'Please set up at least one Department and one Role in Company Settings before uploading users.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    let workbook;
    try {
      workbook = xlsx.read(arrayBuffer, { type: 'buffer' });
    } catch (e) {
      return NextResponse.json({ error: 'Invalid template: File could not be parsed as a spreadsheet.' }, { status: 400 });
    }
    
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    if (!rawData || rawData.length === 0) {
      return NextResponse.json({ error: 'Invalid template: File is empty.' }, { status: 400 });
    }
    
    const headers = (rawData[0] || []).map(h => h?.toString().trim().toLowerCase());
    const requiredHeaders = ['name', 'email', 'role', 'designation', 'department', 'manager email'];
    const hasAllHeaders = requiredHeaders.every(req => headers.includes(req));

    if (!hasAllHeaders) {
      return NextResponse.json(
        { error: 'Invalid template. Expected columns: Name, Email, Role, Designation, Department, Manager Email. Please download the template and try again.' }, 
        { status: 400 }
      );
    }

    const rows = xlsx.utils.sheet_to_json(worksheet) as any[];

    const result = {
      totalRows: rows.length,
      createdCount: 0,
      skippedDuplicates: 0,
      skippedDifferent: [] as { row: number; email: string; differences: string[] }[],
      errors: [] as { row: number; email: string; reason: string }[],
      warnings: [] as { row: number; email: string; reason: string }[],
    };

    // Global existing users
    const allExistingUsers = await prisma.user.findMany({
      select: {
        id: true,
        companyId: true,
        email: true,
        name: true,
        designation: true,
        role: { select: { name: true } },
        department: { select: { name: true } }
      }
    });

    const globalEmailMap = new Map();
    for (const u of allExistingUsers) {
      globalEmailMap.set(u.email.toLowerCase(), u);
    }

    const departments = await prisma.department.findMany({ where: { companyId } });
    const roles = await prisma.role.findMany({ where: { companyId } });

    const deptMap = new Map(departments.map((d) => [d.name.toLowerCase(), d]));
    const roleMap = new Map(roles.map((r) => [r.name.toLowerCase(), r]));

    const usersToCreate: any[] = [];
    const batchEmails = new Set<string>();

    // Parse rows
    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;
      const row = rows[i];
      
      const name = row['Name']?.toString().trim();
      const email = row['Email']?.toString().trim().toLowerCase();
      const roleName = row['Role']?.toString().trim();
      const designation = row['Designation']?.toString().trim() || null;
      const departmentName = row['Department']?.toString().trim();
      const managerEmail = row['Manager Email']?.toString().trim().toLowerCase() || null;

      if (!name || !email || !roleName) {
        result.errors.push({ row: rowNum, email: email || 'Missing', reason: 'Name, Email, and Role are required' });
        continue;
      }

      const existing = globalEmailMap.get(email);
      if (existing) {
        const diffs = [];
        if (existing.name !== name) diffs.push(`Name (DB: ${existing.name} vs Excel: ${name})`);
        if ((existing.role?.name || '') !== roleName) diffs.push(`Role (DB: ${existing.role?.name || 'None'} vs Excel: ${roleName})`);
        if ((existing.designation || '') !== (designation || '')) diffs.push(`Designation (DB: ${existing.designation || 'None'} vs Excel: ${designation || 'None'})`);
        if ((existing.department?.name || '') !== (departmentName || '')) diffs.push(`Department (DB: ${existing.department?.name || 'None'} vs Excel: ${departmentName || 'None'})`);
        
        if (diffs.length === 0) {
          result.skippedDuplicates++;
        } else {
          result.skippedDifferent.push({ row: rowNum, email, differences: diffs });
        }
        continue;
      }

      if (batchEmails.has(email)) {
        result.errors.push({ row: rowNum, email, reason: 'Duplicate email within the uploaded file' });
        continue;
      }

      const matchedRole = roleMap.get(roleName.toLowerCase());
      if (!matchedRole) {
        result.errors.push({ row: rowNum, email, reason: `Role '${roleName}' not found in this company` });
        continue;
      }

      let departmentId: string | null = null;
      if (departmentName) {
        const matchedDept = deptMap.get(departmentName.toLowerCase());
        if (!matchedDept) {
          result.errors.push({ row: rowNum, email, reason: `Department '${departmentName}' not found in this company` });
          continue;
        }
        departmentId = matchedDept.id;
      }

      usersToCreate.push({
        rowNum,
        name,
        email,
        roleId: matchedRole.id,
        baseLevel: matchedRole.baseLevel,
        departmentId,
        designation,
        managerEmail,
        departmentName: departmentName || 'Unassigned',
        roleName: matchedRole.name
      });
      batchEmails.add(email);
    }

    // Pass 1: Creation and Emails
    const newlyCreatedUsersMap = new Map();
    
    if (usersToCreate.length > 0) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        tls: { rejectUnauthorized: false },
      });

      for (const u of usersToCreate) {
        const emailPrefix = u.email.split('@')[0];
        const tempPassword = `${emailPrefix}@123`;
        const passwordHash = await hashPassword(tempPassword);

        try {
          const newUser = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
              data: {
                companyId,
                name: u.name,
                email: u.email,
                roleId: u.roleId,
                baseLevel: u.baseLevel,
                departmentId: u.departmentId,
                designation: u.designation,
                passwordHash,
                status: UserStatus.ACTIVE,
                managerId: null, // Will resolve in pass 2
              },
            });
            await tx.auditLog.create({
              data: {
                userId,
                companyId,
                action: 'user.created',
                entityType: EntityType.USER,
                entityId: user.id,
              },
            });
            return user;
          });

          newlyCreatedUsersMap.set(u.email, newUser);
          result.createdCount++;

          // Send Email
          await transporter.sendMail({
            from: `"Assort1" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
            to: u.email,
            subject: 'Welcome to Assort1 - Your account is ready',
            html: `
              <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #faf8ff; border-radius: 12px;">
                <h2 style="color: #131b2e; margin-bottom: 8px;">Welcome to Assort1, ${u.name}!</h2>
                <p style="color: #434655; margin-bottom: 24px;">Your account has been created. Here are your login credentials:</p>
                <div style="background: white; border: 1px solid #c3c6d7; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                  <p style="margin: 0 0 8px; color: #434655; font-size: 14px;"><strong>Email:</strong> ${u.email}</p>
                  <p style="margin: 0 0 8px; color: #434655; font-size: 14px;"><strong>Password:</strong> ${tempPassword}</p>
                  <p style="margin: 0 0 8px; color: #434655; font-size: 14px;"><strong>Role:</strong> ${u.roleName}</p>
                  <p style="margin: 0; color: #434655; font-size: 14px;"><strong>Department:</strong> ${u.departmentName}</p>
                </div>
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login" 
                  style="display: inline-block; background: #2563EB; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                  Login to Assort1
                </a>
                <p style="color: #434655; font-size: 12px; margin-top: 24px;">Please change your password after first login.</p>
              </div>
            `,
          }).catch((e) => console.error('Failed to send email:', e));

        } catch (e: any) {
          result.errors.push({ row: u.rowNum, email: u.email, reason: 'Database error: ' + e.message });
        }
      }
    }

    // Pass 2: Manager Resolution
    for (const u of usersToCreate) {
      if (!u.managerEmail) continue;
      
      const createdUser = newlyCreatedUsersMap.get(u.email);
      if (!createdUser) continue; // Skip if creation failed

      let managerId = null;
      
      // Check in newly created users first
      const newlyCreatedManager = newlyCreatedUsersMap.get(u.managerEmail);
      if (newlyCreatedManager) {
        managerId = newlyCreatedManager.id;
      } else {
        // Check global users
        const existingManager = globalEmailMap.get(u.managerEmail);
        if (existingManager && existingManager.companyId === companyId) {
          managerId = existingManager.id;
        }
      }

      if (managerId) {
        await prisma.user.update({
          where: { id: createdUser.id },
          data: { managerId }
        });
      } else {
        result.warnings.push({ row: u.rowNum, email: u.email, reason: `Manager email '${u.managerEmail}' not found. Created without manager.` });
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Bulk upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
