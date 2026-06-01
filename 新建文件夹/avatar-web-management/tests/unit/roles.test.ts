import { hasRole, isSuperAdmin, isWorkspaceAdmin, canManageUsers, canReview } from '@/lib/auth/roles';

describe('Role Hierarchy', () => {
  it('super_admin outranks all roles', () => {
    expect(hasRole('super_admin', 'workspace_admin')).toBe(true);
    expect(hasRole('super_admin', 'user')).toBe(true);
  });

  it('workspace_admin outranks user only', () => {
    expect(hasRole('workspace_admin', 'user')).toBe(true);
    expect(hasRole('workspace_admin', 'super_admin')).toBe(false);
  });

  it('user outranks nothing', () => {
    expect(hasRole('user', 'workspace_admin')).toBe(false);
    expect(hasRole('user', 'super_admin')).toBe(false);
  });

  it('same role has access to itself', () => {
    expect(hasRole('workspace_admin', 'workspace_admin')).toBe(true);
    expect(hasRole('user', 'user')).toBe(true);
    expect(hasRole('super_admin', 'super_admin')).toBe(true);
  });

  it('unknown roles default to level 0', () => {
    expect(hasRole('unknown', 'user')).toBe(false);
    expect(hasRole('super_admin', 'unknown')).toBe(true);
  });
});

describe('Role helper functions', () => {
  it('isSuperAdmin — true only for super_admin', () => {
    expect(isSuperAdmin('super_admin')).toBe(true);
    expect(isSuperAdmin('workspace_admin')).toBe(false);
    expect(isSuperAdmin('user')).toBe(false);
  });

  it('isWorkspaceAdmin — true for workspace_admin and super_admin', () => {
    expect(isWorkspaceAdmin('workspace_admin')).toBe(true);
    expect(isWorkspaceAdmin('super_admin')).toBe(true);
    expect(isWorkspaceAdmin('user')).toBe(false);
  });

  it('canManageUsers — super_admin only', () => {
    expect(canManageUsers('super_admin')).toBe(true);
    expect(canManageUsers('workspace_admin')).toBe(false);
    expect(canManageUsers('user')).toBe(false);
  });

  it('canReview — workspace_admin and above', () => {
    expect(canReview('workspace_admin')).toBe(true);
    expect(canReview('super_admin')).toBe(true);
    expect(canReview('user')).toBe(false);
  });
});
