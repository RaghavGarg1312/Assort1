import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/password';

const registerSchema = z.object({
  token: z.string(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { token, password } = result.data;

    const invite = await prisma.invite.findUnique({
      where: { token },
      include: { role: true },
    });

    if (!invite || invite.status !== 'PENDING' || invite.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Invalid or expired invite token' }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email: invite.email,
        name: invite.name || 'New User',
        passwordHash,
        companyId: invite.companyId,
        roleId: invite.roleId,
        baseLevel: invite.role.baseLevel,
        departmentId: invite.departmentId,
        designation: invite.designation,
        managerId: invite.managerId,
        status: 'ACTIVE',
        emailVerified: true,
      },
    });

    await prisma.invite.update({
      where: { id: invite.id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
    });

    return NextResponse.json({ message: 'Registered successfully', userId: user.id });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
