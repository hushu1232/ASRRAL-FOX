export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';
import { success, error } from '@/lib/api-response';
import { registerSchema } from '@/lib/validators';
import { ValidationError, ConflictError } from '@/lib/errors';
import { generateCsrfToken } from '@/lib/csrf';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map(e => e.message).join(', '));
    }

    const { email, username, password } = parsed.data;

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictError('邮箱或用户名已被注册');
    }

    const workspace = await prisma.workspace.create({
      data: { name: `${username}的工作空间` },
    });

    const id = uuidv4();
    const pwHash = await hashPassword(password);

    await prisma.user.create({
      data: {
        id,
        workspaceId: workspace.id,
        email,
        username,
        passwordHash: pwHash,
        role: 'user',
      },
    });

    logAudit({ userId: id, action: 'auth.register', resourceType: 'auth', details: { email, username }, req, workspaceId: workspace.id });

    const response = success({ id, email, username, role: 'user' }, 201);
    response.cookies.set('XSRF-TOKEN', generateCsrfToken(), {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 86400,
    });
    return response;
  } catch (err) {
    return error(err);
  }
}
