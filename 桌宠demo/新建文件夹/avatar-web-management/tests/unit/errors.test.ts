import {
  AppError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  ConflictError,
} from '@/lib/errors';

describe('AppError', () => {
  it('constructs with status code, message, and code', () => {
    const err = new AppError(422, 'Invalid input', 'INVALID_INPUT');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(422);
    expect(err.message).toBe('Invalid input');
    expect(err.code).toBe('INVALID_INPUT');
    expect(err.name).toBe('AppError');
  });

  it('defaults code to INTERNAL_ERROR', () => {
    const err = new AppError(500, 'Something broke');
    expect(err.code).toBe('INTERNAL_ERROR');
  });
});

describe('NotFoundError', () => {
  it('formats with resource and ID', () => {
    const err = new NotFoundError('Avatar', 'abc-123');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Avatar not found: abc-123');
    expect(err.code).toBe('NOT_FOUND');
  });

  it('formats with resource only', () => {
    const err = new NotFoundError('User');
    expect(err.message).toBe('User not found');
  });
});

describe('UnauthorizedError', () => {
  it('defaults to "Unauthorized"', () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.message).toBe('Unauthorized');
  });

  it('accepts custom message', () => {
    const err = new UnauthorizedError('Token expired');
    expect(err.message).toBe('Token expired');
  });
});

describe('ForbiddenError', () => {
  it('defaults to "Forbidden"', () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });
});

describe('ValidationError', () => {
  it('sets 400 status', () => {
    const err = new ValidationError('Email is required');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('Email is required');
  });
});

describe('ConflictError', () => {
  it('sets 409 status', () => {
    const err = new ConflictError('Part already equipped');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
  });
});

describe('Error inheritance chain', () => {
  it('NotFoundError is instanceof AppError and Error', () => {
    const err = new NotFoundError('Avatar', '1');
    expect(err).toBeInstanceOf(NotFoundError);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
  });

  it('UnauthorizedError is instanceof AppError', () => {
    expect(new UnauthorizedError()).toBeInstanceOf(AppError);
  });

  it('ForbiddenError is instanceof AppError', () => {
    expect(new ForbiddenError()).toBeInstanceOf(AppError);
  });

  it('ValidationError is instanceof AppError', () => {
    expect(new ValidationError('x')).toBeInstanceOf(AppError);
  });

  it('ConflictError is instanceof AppError', () => {
    expect(new ConflictError('x')).toBeInstanceOf(AppError);
  });
});
