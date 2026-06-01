describe('uuid generation', () => {
  it('generates valid UUIDs', () => {
    const uuid = require('uuid');
    const id = uuid.v4();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('jsonwebtoken HS256', () => {
  it('signs and verifies with HS256', () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ sub: 'test' }, 'secret', { algorithm: 'HS256' });
    const decoded = jwt.verify(token, 'secret');
    expect(decoded.sub).toBe('test');
  });

  it('detects wrong secret', () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ sub: 'test' }, 'secret', { algorithm: 'HS256' });
    expect(() => jwt.verify(token, 'wrong')).toThrow();
  });

  it('detects expired token', () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ sub: 'test' }, 'secret', { expiresIn: '0s' });
    expect(() => jwt.verify(token, 'secret')).toThrow();
  });
});

describe('better-sqlite3 in-memory', () => {
  it('creates an in-memory database instance', () => {
    const Database = require('better-sqlite3');
    const db = new Database(':memory:');
    expect(db).toBeDefined();
    expect(typeof db.prepare).toBe('function');
    expect(typeof db.exec).toBe('function');
    expect(typeof db.pragma).toBe('function');
    expect(typeof db.close).toBe('function');
  });
});
