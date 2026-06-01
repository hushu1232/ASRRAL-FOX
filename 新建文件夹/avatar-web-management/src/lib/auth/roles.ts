import { ROLE_HIERARCHY } from '@/lib/constants';

export function hasRole(userRole: string, requiredRole: string): boolean {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
  return userLevel >= requiredLevel;
}

export function isSuperAdmin(userRole: string): boolean {
  return userRole === 'super_admin';
}

export function isWorkspaceAdmin(userRole: string): boolean {
  return userRole === 'workspace_admin' || userRole === 'super_admin';
}

export function canManageUsers(userRole: string): boolean {
  return userRole === 'super_admin';
}

export function canReview(userRole: string): boolean {
  return hasRole(userRole, 'workspace_admin');
}
