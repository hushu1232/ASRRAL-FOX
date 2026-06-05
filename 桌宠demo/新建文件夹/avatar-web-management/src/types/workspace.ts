export type WorkspacePlan = 'free' | 'pro' | 'enterprise';

export interface Workspace {
  id: string;
  name: string;
  plan: WorkspacePlan;
  sso_config: SSOConfig | null;
  storage_quota_bytes: number;
  member_count: number;
  created_at: string;
}

export interface SSOConfig {
  provider: 'ldap' | 'oidc';
  client_id: string;
  issuer: string;
  domain?: string;
}
