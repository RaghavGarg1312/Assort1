import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '../helper';
import { hashPassword } from '@/lib/password';
import { z } from 'zod';
import { BaseLevel, EntityType, UserStatus } from '@prisma/client';
import nodemailer from 'nodemailer';
export async function GET(request: Request) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const { companyId } = userOrResponse;

  const url = new URL(request.url);
  const excludeAdmins = url.searchParams.get('excludeAdmins') === 'true';

  try {
    const users = await prisma.user.findMany({
      where: {
        companyId,
        ...(excludeAdmins && { baseLevel: { not: 'ADMIN' } }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        designation: true,
        department: { select: { name: true } },
        manager: { select: { name: true } },
        role: { select: { name: true } },
        baseLevel: true,
        status: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  baseLevel: z.nativeEnum(BaseLevel).optional(),
  roleId: z.string().optional(),
  departmentId: z.string().optional(),
  managerId: z.string().optional(),
  designation: z.string().optional(),
});

export async function POST(request: Request) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const { id: userId, companyId } = userOrResponse;

  try {
    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

    const [deptCount, roleCount] = await Promise.all([
      prisma.department.count({ where: { companyId } }),
      prisma.role.count({ where: { companyId, name: { not: 'Company Admin' } } })
    ]);

    if (deptCount === 0 || roleCount === 0) {
      return NextResponse.json(
        { error: 'Please set up at least one Department and one Role in Company Settings before adding users.' },
        { status: 400 }
      );
    }

    const { name, email, baseLevel, roleId, departmentId, managerId, designation } = parsed.data;

    if (!baseLevel && !roleId) {
      return NextResponse.json({ error: 'Either baseLevel or roleId must be provided' }, { status: 400 });
    }

    // Generate password from email prefix
    const emailPrefix = email.split('@')[0];
    const tempPassword = `${emailPrefix}@123`;
    const passwordHash = await hashPassword(tempPassword);

    let role;
    if (roleId) {
      role = await prisma.role.findUnique({ where: { id: roleId } });
    } else if (baseLevel) {
      role = await prisma.role.findFirst({ where: { companyId, baseLevel } });
    }

    if (!role || role.companyId !== companyId) {
      return NextResponse.json({ error: 'Role not found' }, { status: 400 });
    }

    const actualBaseLevel = role.baseLevel;

    let departmentName = 'Unassigned';
    if (departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: departmentId } });
      if (dept) departmentName = dept.name;
    }

    // Check email not already taken
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return NextResponse.json({ error: 'Email already in use' }, { status: 400 });

    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          companyId,
          roleId: role.id,
          name,
          email,
          passwordHash,
          baseLevel: actualBaseLevel,
          designation: designation || null,
          departmentId: departmentId || null,
          managerId: managerId || null,
          status: UserStatus.ACTIVE,
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
    }, { timeout: 30000 });

    // Send welcome email
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: { rejectUnauthorized: false },
    });

    try {
      await transporter.sendMail({
        from: `"Assort1" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to: email,
        subject: 'Welcome to Assort1 - Your account is ready',
        html: `
          <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #faf8ff; border-radius: 12px;">
            <h2 style="color: #131b2e; margin-bottom: 8px;">Welcome to Assort1, ${name}!</h2>
            <p style="color: #434655; margin-bottom: 24px;">Your account has been created. Here are your login credentials:</p>
            <div style="background: white; border: 1px solid #c3c6d7; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <p style="margin: 0 0 8px; color: #434655; font-size: 14px;"><strong>Email:</strong> ${email}</p>
              <p style="margin: 0 0 8px; color: #434655; font-size: 14px;"><strong>Password:</strong> ${tempPassword}</p>
              <p style="margin: 0 0 8px; color: #434655; font-size: 14px;"><strong>Role:</strong> ${role.name}</p>
              <p style="margin: 0; color: #434655; font-size: 14px;"><strong>Department:</strong> ${departmentName}</p>
            </div>
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login" 
              style="display: inline-block; background: #2563EB; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Login to Assort1
            </a>
            <p style="color: #434655; font-size: 12px; margin-top: 24px;">Please change your password after first login.</p>
          </div>
        `,
      });
    } catch (e) {
      console.error('Failed to send welcome email', e);
    }

    return NextResponse.json({ success: true, userId: newUser.id }, { status: 201 });
  } catch (error) {
    console.error('User creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
