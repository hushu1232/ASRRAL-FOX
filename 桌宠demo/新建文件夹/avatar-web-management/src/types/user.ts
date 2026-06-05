export type UserRole = 'super_admin' | 'workspace_admin' | 'user';
export type UserStatus = 'active' | 'suspended' | 'deleted';
export type SSOProvider = 'ldap' | 'oidc' | null;

export interface User {
  id: string;
  workspace_id: string;
  email: string;
  username: string;
  avatar_url: string | null;
  password_hash: string;
  role: UserRole;
  sso_provider: SSOProvider;
  sso_subject: string | null;
  totp_secret: string | null;
  status: UserStatus;
  last_login_at: string | null;
  created_at: string;
}

export type PublicUser = Omit<User, 'password_hash' | 'totp_secret' | 'sso_subject'>;
