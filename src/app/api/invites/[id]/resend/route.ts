import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '../../../helper';
import { requirePermission } from '@/lib/rbac';
import { requireSameCompany } from '@/lib/tenant';
import { InviteStatus } from '@prisma/client';
import nodemailer from 'nodemailer';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const { id: userId, companyId } = userOrResponse;

  const permCheck = await requirePermission(request, 'create_user');
  if (permCheck) return permCheck;

  const params = await props.params;
  const { id } = params;

  try {
    const invite = await prisma.invite.findUnique({ where: { id } });
    if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 });

    await requireSameCompany(userId, invite.companyId);

    if (invite.status !== InviteStatus.PENDING) {
      return NextResponse.json({ error: 'Invite is not pending' }, { status: 400 });
    }

    const updatedInvite = await prisma.invite.update({
      where: { id },
      data: {
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

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
        to: updatedInvite.email,
        subject: 'Welcome to Assort1 - You are invited!',
        text: `Hello ${updatedInvite.name || ''}, you have been invited. Use this token to join: ${updatedInvite.token}`,
      });
    } catch (e) {
      console.error('Failed to send email', e);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
