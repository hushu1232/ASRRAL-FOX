import {
  JWT_ACCESS_EXPIRY,
  JWT_REFRESH_EXPIRY_DAYS,
  BCRYPT_ROUNDS,
  MAX_UNDO_STEPS,
  MAX_UPLOAD_SIZE,
  DEFAULT_PAGE_SIZE,
  ROLE_HIERARCHY,
  AVATAR_STYLES,
  AVATAR_STATUS_MAP,
} from '@/lib/constants';

describe('constants', () => {
  describe('JWT', () => {
    it('has valid access expiry', () => {
      expect(JWT_ACCESS_EXPIRY).toBe('15m');
    });

    it('has positive refresh expiry days', () => {
      expect(JWT_REFRESH_EXPIRY_DAYS).toBeGreaterThan(0);
    });
  });

  describe('security', () => {
    it('BCRYPT_ROUNDS is at least 10', () => {
      expect(BCRYPT_ROUNDS).toBeGreaterThanOrEqual(10);
    });
  });

  describe('limits', () => {
    it('MAX_UNDO_STEPS is positive', () => {
      expect(MAX_UNDO_STEPS).toBeGreaterThan(0);
    });

    it('MAX_UPLOAD_SIZE is 500MB', () => {
      expect(MAX_UPLOAD_SIZE).toBe(500 * 1024 * 1024);
    });

    it('DEFAULT_PAGE_SIZE is positive', () => {
      expect(DEFAULT_PAGE_SIZE).toBeGreaterThan(0);
    });
  });

  describe('ROLE_HIERARCHY', () => {
    it('super_admin has highest priority', () => {
      const ranks = Object.values(ROLE_HIERARCHY);
      expect(ROLE_HIERARCHY.super_admin).toBe(Math.max(...ranks));
    });

    it('user has lowest priority', () => {
      const ranks = Object.values(ROLE_HIERARCHY);
      expect(ROLE_HIERARCHY.user).toBe(Math.min(...ranks));
    });

    it('workspace_admin outranks user', () => {
      expect(ROLE_HIERARCHY.workspace_admin).toBeGreaterThan(ROLE_HIERARCHY.user);
    });

    it('super_admin outranks workspace_admin', () => {
      expect(ROLE_HIERARCHY.super_admin).toBeGreaterThan(ROLE_HIERARCHY.workspace_admin);
    });
  });

  describe('AVATAR_STYLES', () => {
    it('contains all expected styles', () => {
      const values = AVATAR_STYLES.map((s) => s.value);
      expect(values).toContain('anime');
      expect(values).toContain('realistic');
      expect(values).toContain('lowpoly');
      expect(values).toContain('korean');
      expect(values).toContain('western');
      expect(values).toContain('chibi');
    });

    it('each style has a label', () => {
      AVATAR_STYLES.forEach((s) => {
        expect(s.label).toBeTruthy();
      });
    });
  });

  describe('AVATAR_STATUS_MAP', () => {
    it('has all statuses with color and label', () => {
      const statuses = ['draft', 'published', 'archived', 'pending_review', 'approved', 'rejected'];
      statuses.forEach((status) => {
        expect(AVATAR_STATUS_MAP[status]).toBeDefined();
        expect(AVATAR_STATUS_MAP[status].color).toBeTruthy();
        expect(AVATAR_STATUS_MAP[status].label).toBeTruthy();
      });
    });
  });
});
