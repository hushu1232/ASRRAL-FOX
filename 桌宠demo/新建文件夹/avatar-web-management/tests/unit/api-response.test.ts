import { success, error, paginated } from '@/lib/api-response';
import { AppError, NotFoundError, ValidationError } from '@/lib/errors';

// Mock the logger to avoid side effects
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  }),
}));

describe('api-response', () => {
  describe('success', () => {
    it('returns success:true with data', async () => {
      const res = success({ id: '1', name: 'Test' });
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual({ id: '1', name: 'Test' });
      expect(res.status).toBe(200);
    });

    it('returns custom status code', () => {
      const res = success({ id: '2' }, 201);
      expect(res.status).toBe(201);
    });

    it('handles null data', async () => {
      const res = success(null);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toBeNull();
    });

    it('handles array data', async () => {
      const res = success([1, 2, 3]);
      const body = await res.json();
      expect(body.data).toEqual([1, 2, 3]);
    });
  });

  describe('error', () => {
    it('returns error response for AppError', async () => {
      const err = new NotFoundError('Avatar', 'abc');
      const res = error(err);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('Avatar not found: abc');
      expect(body.code).toBe('NOT_FOUND');
      expect(res.status).toBe(404);
    });

    it('returns error response for ValidationError', async () => {
      const err = new ValidationError('Name is required');
      const res = error(err);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(res.status).toBe(400);
    });

    it('returns 500 for generic Error', async () => {
      const res = error(new Error('Something broke'));
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('Internal server error');
      expect(res.status).toBe(500);
    });

    it('returns 500 for non-Error thrown values', async () => {
      const res = error('just a string');
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('Internal server error');
      expect(res.status).toBe(500);
    });

    it('returns 500 for null/undefined', async () => {
      const res = error(null);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(res.status).toBe(500);
    });
  });

  describe('paginated', () => {
    it('returns paginated response with correct metadata', async () => {
      const items = [{ id: '1' }, { id: '2' }];
      const res = paginated(items, 10, 1, 2);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.items).toEqual(items);
      expect(body.data.total).toBe(10);
      expect(body.data.page).toBe(1);
      expect(body.data.pageSize).toBe(2);
      expect(body.data.totalPages).toBe(5);
    });

    it('calculates totalPages correctly with remainder', async () => {
      const res = paginated([], 11, 1, 5);
      const body = await res.json();
      expect(body.data.totalPages).toBe(3);
    });

    it('handles empty items', async () => {
      const res = paginated([], 0, 1, 20);
      const body = await res.json();
      expect(body.data.items).toEqual([]);
      expect(body.data.total).toBe(0);
      expect(body.data.totalPages).toBe(0);
    });

    it('handles single page', async () => {
      const res = paginated([{ id: '1' }], 5, 1, 10);
      const body = await res.json();
      expect(body.data.totalPages).toBe(1);
    });
  });
});
