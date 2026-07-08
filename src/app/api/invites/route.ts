import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '../helper';
import { requirePermission, requireBaseLevel } from '@/lib/rbac';
import { z } from 'zod';
import { BaseLevel, EntityType, InviteStatus } from '@prisma/client';
import nodemailer from 'nodemailer';

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  designation: z.string().optional(),
  departmentId: z.string().optional(),
  baseLevel: z.nativeEnum(BaseLevel).optional(),
  roleId: z.string().optional(),
  managerId: z.string().optional(),
});

export async function POST(request: Request) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const { id: userId, companyId } = userOrResponse;

  const permCheck = await requirePermission(request, 'create_user');
  if (permCheck) return permCheck;

  try {
    const body = await request.json();
    const parsed = inviteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { email, name, designation, departmentId, baseLevel, roleId, managerId } = parsed.data;

    const [deptCount, roleCount] = await Promise.all([
      prisma.department.count({ where: { companyId } }),
      prisma.role.count({ where: { companyId } })
    ]);

    if (deptCount === 0 || roleCount === 0) {
      return NextResponse.json(
        { error: 'Please set up at least one Department and one Role in Company Settings before inviting users.' },
        { status: 400 }
      );
    }

    if (!baseLevel && !roleId) {
      return NextResponse.json({ error: 'Either baseLevel or roleId must be provided' }, { status: 400 });
    }

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

    if (actualBaseLevel === BaseLevel.VIEWER) {
      return NextResponse.json({ error: 'Cannot directly invite a VIEWER' }, { status: 400 });
    }

    if (managerId) {
      const manager = await prisma.user.findUnique({
        where: { id: managerId },
        select: { companyId: true, baseLevel: true },
      });
      if (!manager || manager.companyId !== companyId) {
        return NextResponse.json({ error: 'Invalid manager' }, { status: 400 });
      }
      if (manager.baseLevel === 'MEMBER' || manager.baseLevel === 'VIEWER') {
        return NextResponse.json({ error: 'Manager must be MANAGER level or higher' }, { status: 400 });
      }
    }

    if (departmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: departmentId },
        select: { companyId: true },
      });
      if (!dept || dept.companyId !== companyId) {
        return NextResponse.json({ error: 'Invalid department' }, { status: 400 });
      }
    }

    const invite = await prisma.$transaction(async (tx) => {
      const newInvite = await tx.invite.create({
        data: {
          companyId,
          roleId: role.id,
          email,
          name,
          designation,
          departmentId,
          managerId,
          status: InviteStatus.PENDING,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          companyId,
          action: 'invite.created',
          entityType: EntityType.INVITE,
          entityId: newInvite.id,
        },
      });

      return newInvite;
    });

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
        to: invite.email,
        subject: 'Welcome to Assort1 - You are invited!',
        text: `Hello ${invite.name || ''}, you have been invited. Use this token to join: ${invite.token}`,
      });
    } catch (e) {
      console.error('Failed to send email', e);
    }

    return NextResponse.json(invite, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const userOrResponse = await getAuthUser(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const { companyId } = userOrResponse;

  const baseLevelCheck = await requireBaseLevel(request, BaseLevel.ADMIN);
  if (baseLevelCheck) return baseLevelCheck;

  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status');

  try {
    const invites = await prisma.invite.findMany({
      where: {
        companyId,
        ...(statusParam && { status: statusParam as InviteStatus }),
      },
      include: {
        role: { select: { name: true, baseLevel: true } },
        department: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(invites);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
