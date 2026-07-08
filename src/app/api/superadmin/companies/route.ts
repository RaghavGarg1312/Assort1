import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isSuperadmin } from '../helper';
import { z } from 'zod';
import { seedNewCompany } from '@/lib/company-seed';
import nodemailer from 'nodemailer';
import { CompanyStatus, EntityType } from '@prisma/client';

export async function GET(request: Request) {
  const adminCheck = await isSuperadmin(request);
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const companies = await prisma.company.findMany({
      include: {
        _count: {
          select: { users: true },
        },
        users: {
          where: { baseLevel: 'ADMIN' },
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = companies.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      createdAt: c.createdAt,
      employeeCount: c._count.users,
      admins: c.users,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const createCompanySchema = z.object({
  name: z.string().trim().min(1),
  timezone: z.string().optional(),
  adminName: z.string().min(1),
  adminEmail: z.string().email(),
});

export async function POST(request: Request) {
  const adminCheck = await isSuperadmin(request);
  if (adminCheck instanceof NextResponse) return adminCheck;
  const { userId } = adminCheck;

  try {
    const body = await request.json();
    const parsed = createCompanySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { name, timezone, adminName, adminEmail } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create company
      const company = await tx.company.create({
        data: {
          name,
          timezone,
          status: CompanyStatus.PENDING_SETUP,
        },
      });

      // 2. Seed company
      await seedNewCompany(tx, company.id);

      // 3. Find admin role
      const adminRole = await tx.role.findFirst({
        where: { companyId: company.id, name: 'Company Admin' },
      });

      if (!adminRole) {
        throw new Error('Admin role not generated');
      }

      // 4. Create user and audit log in transaction
      const { hashPassword } = await import('@/lib/password');
      const emailPrefix = adminEmail.split('@')[0];
      const tempPassword = `${emailPrefix}@123`;
      const passwordHash = await hashPassword(tempPassword);

      const newAdmin = await tx.user.create({
        data: {
          companyId: company.id,
          roleId: adminRole.id,
          name: adminName,
          email: adminEmail,
          passwordHash,
          baseLevel: 'ADMIN',
          status: 'ACTIVE',
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'company.created',
          entityType: EntityType.COMPANY,
          entityId: company.id,
        },
      });

      return { company, admin: newAdmin, tempPassword };
    }, { timeout: 30000 });
    
    const { company, admin, tempPassword } = result;

    // 5. Send Email
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    try {
      await transporter.sendMail({
        from: `"Assort1" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to: admin.email,
        subject: 'Welcome to Assort1 - Your account is ready',
        html: `
          <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #faf8ff; border-radius: 12px;">
            <h2 style="color: #131b2e; margin-bottom: 8px;">Welcome to Assort1, ${admin.name}!</h2>
            <p style="color: #434655; margin-bottom: 24px;">Your company <strong>${company.name}</strong> has been set up on Assort1. Here are your admin login credentials:</p>
            <div style="background: white; border: 1px solid #c3c6d7; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <p style="margin: 0 0 8px; color: #434655; font-size: 14px;"><strong>Email:</strong> ${admin.email}</p>
              <p style="margin: 0 0 8px; color: #434655; font-size: 14px;"><strong>Password:</strong> ${tempPassword}</p>
              <p style="margin: 0; color: #434655; font-size: 14px;"><strong>Role:</strong> Company Admin</p>
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
      console.error('Failed to send email', e);
    }

    return NextResponse.json({ success: true, companyId: company.id }, { status: 201 });
  } catch (error) {
    console.error('Company creation error:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}
