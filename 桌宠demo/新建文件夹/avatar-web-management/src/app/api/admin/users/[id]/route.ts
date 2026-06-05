export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth/middleware';
import { logAudit } from '@/lib/audit';

import { ROLE_HIERARCHY } from '@/lib/constants';
import { hasRole } from '@/lib/auth/roles';

export const PUT = requireRole('super_admin')(async (req: NextRequest, user, ctx) => {
  const { id } = await ctx!.params! as { id: string };

  const body = await req.json();
  const { role, status } = body;

  const targetUser = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, workspaceId: true },
  });
  if (!targetUser) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }

  // Prevent escalating to super_admin or modifying super_admin users
  if (role) {
    const targetLevel = ROLE_HIERARCHY[targetUser.role] || 0;
    const operatorLevel = ROLE_HIERARCHY[user.role] || 0;
    const newLevel = ROLE_HIERARCHY[role] || 0;

    // Cannot promote anyone (including self) to super_admin unless you are super_admin
    if (newLevel >= 100 && user.role !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'Only super_admin can assign super_admin role' }, { status: 403 });
    }
    // Cannot modify users with equal or higher role than yourself
    if (targetLevel >= operatorLevel && targetUser.id !== user.sub) {
      return NextResponse.json({ success: false, error: 'Cannot modify a user with equal or higher role' }, { status: 403 });
    }
  }

  const data: Record<string, string> = {};
  if (role) data.role = role;
  if (status) data.status = status;
  if (Object.keys(data).length > 0) {
    await prisma.user.update({ where: { id }, data });
  }

  logAudit({ userId: user.sub, action: 'admin.user_update', resourceType: 'user', resourceId: id, details: { role, status, previousRole: targetUser.role }, req, workspaceId: user.workspaceId });

  const updated = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, username: true, role: true, status: true, createdAt: true },
  });
  return NextResponse.json({ success: true, data: updated });
});

// PATCH: ban/unban endpoint with role protection
export const PATCH = requireRole('super_admin')(async (req: NextRequest, user, ctx) => {
  const { id } = await ctx!.params! as { id: string };

  const body = await req.json();
  const { action } = body; // 'ban' | 'unban'

  if (!action || !['ban', 'unban'].includes(action)) {
    return NextResponse.json({ success: false, error: 'action must be "ban" or "unban"' }, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, username: true },
  });
  if (!targetUser) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }

  // Role protection: cannot ban users with equal or higher role
  const targetLevel = ROLE_HIERARCHY[targetUser.role] || 0;
  const operatorLevel = ROLE_HIERARCHY[user.role] || 0;
  if (targetLevel >= operatorLevel) {
    return NextResponse.json({
      success: false,
      error: `Cannot ${action} a user with equal or higher role (${targetUser.role})`,
    }, { status: 403 });
  }

  const newStatus = action === 'ban' ? 'suspended' : 'active';
  await prisma.user.update({ where: { id }, data: { status: newStatus } });

  logAudit({
    userId: user.sub,
    action: action === 'ban' ? 'admin.user_ban' : 'admin.user_unban',
    resourceType: 'user',
    resourceId: id,
    details: { targetRole: targetUser.role, previousStatus: targetUser.role },
    req,
    workspaceId: user.workspaceId,
  });

  return NextResponse.json({
    success: true,
    data: { id, status: newStatus, username: targetUser.username },
  });
});

export const DELETE = requireRole('super_admin')(async (req: NextRequest, user, ctx) => {
  const { id } = await ctx!.params! as { id: string };

  const targetUser = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  });
  if (!targetUser) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }

  // Prevent deleting super_admin users
  const targetLevel = ROLE_HIERARCHY[targetUser.role] || 0;
  const operatorLevel = ROLE_HIERARCHY[user.role] || 0;
  if (targetLevel >= operatorLevel) {
    return NextResponse.json({ success: false, error: 'Cannot delete a user with equal or higher role' }, { status: 403 });
  }

  await prisma.user.update({ where: { id }, data: { status: 'deleted' } });
  logAudit({ userId: user.sub, action: 'admin.user_delete', resourceType: 'user', resourceId: id, req, workspaceId: user.workspaceId });
  return NextResponse.json({ success: true, data: { id, status: 'deleted' } });
});
