import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isSuperadmin } from '../../../helper';
import { seedNewCompany } from '@/lib/company-seed';
import nodemailer from 'nodemailer';
import { CompanyStatus, DemoRequestStatus, EntityType, InviteStatus } from '@prisma/client';

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const adminCheck = await isSuperadmin(request);
  if (adminCheck instanceof NextResponse) return adminCheck;
  const { userId } = adminCheck;

  const params = await props.params;
  const { id } = params;

  try {
    const demoRequest = await prisma.demoRequest.findUnique({ where: { id } });
    if (!demoRequest || demoRequest.status !== DemoRequestStatus.PENDING) {
      return NextResponse.json({ error: 'Invalid demo request' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create company
      const company = await tx.company.create({
        data: {
          name: demoRequest.companyName.trim(),
          status: CompanyStatus.PENDING_SETUP,
        },
      });

      // 2. Seed company
      await seedNewCompany(tx, company.id);

      // 3. Find admin role
      const adminRole = await tx.role.findFirst({
        where: { companyId: company.id, name: 'admin' },
      });

      if (!adminRole) {
        throw new Error('Admin role not generated');
      }

      // 4. Update demo request, create invite, write audit log
      await tx.demoRequest.update({
        where: { id },
        data: {
          status: DemoRequestStatus.APPROVED,
          companyId: company.id,
        },
      });

      const newInvite = await tx.invite.create({
        data: {
          companyId: company.id,
          roleId: adminRole.id,
          email: demoRequest.email,
          name: demoRequest.contactName,
          status: InviteStatus.PENDING,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'demo_request.approved',
          entityType: EntityType.DEMO_REQUEST,
          entityId: id,
        },
      });

      return { company, invite: newInvite };
    });

    const { company, invite } = result;

    // 5. Send Email
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: Number(process.env.SMTP_PORT) || 2525,
      auth: {
        user: process.env.SMTP_USER || 'user',
        pass: process.env.SMTP_PASS || 'pass',
      },
    });

    try {
      await transporter.sendMail({
        from: '"Assort1" <noreply@assort1.com>',
        to: invite.email,
        subject: 'Welcome to Assort1 - You are invited!',
        text: `Hello ${invite.name}, your company ${company.name} has been approved. Use this token to join: ${invite.token}`,
      });
    } catch (e) {
      console.error('Failed to send email', e);
      // Not failing the request since everything else worked
    }

    return NextResponse.json({ success: true, companyId: company.id });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
