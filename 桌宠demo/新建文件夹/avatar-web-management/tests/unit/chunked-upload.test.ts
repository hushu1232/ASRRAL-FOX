import { createSession, getSession, recordChunk, deleteSession, getSessionStatus, cleanupExpired } from '@/lib/storage/chunked-upload';
import type { ChunkedUploadSession } from '@/lib/storage/types';

describe('ChunkedUpload Session Manager', () => {
  afterEach(() => {
    // Clean up sessions between tests
    cleanupExpired();
  });

  it('creates a session with valid parameters', () => {
    const session = createSession({
      finalKey: 'ws-123/models/test.glb',
      fileSize: 10 * 1024 * 1024, // 10MB
      contentType: 'model/gltf-binary',
    });

    expect(session.uploadId).toBeDefined();
    expect(session.finalKey).toBe('ws-123/models/test.glb');
    expect(session.fileSize).toBe(10 * 1024 * 1024);
    expect(session.totalChunks).toBe(2); // 10MB / 5MB default = 2 chunks
    expect(session.chunkSize).toBe(5 * 1024 * 1024);
    expect(session.status).toBe('uploading');
    expect(session.uploadedChunks).toEqual([]);
    expect(session.createdAt).toBeLessThanOrEqual(Date.now());
  });

  it('calculates totalChunks correctly for uneven sizes', () => {
    const session = createSession({
      finalKey: 'ws/test.png',
      fileSize: 12 * 1024 * 1024, // 12MB
      contentType: 'image/png',
    });

    expect(session.totalChunks).toBe(3); // ceil(12/5) = 3
    expect(session.fileSize).toBe(12 * 1024 * 1024);
  });

  it('respects custom chunkSize', () => {
    const session = createSession({
      finalKey: 'ws/test.glb',
      fileSize: 20 * 1024 * 1024,
      contentType: 'model/gltf-binary',
      chunkSize: 2 * 1024 * 1024, // 2MB chunks
    });

    expect(session.chunkSize).toBe(2 * 1024 * 1024);
    expect(session.totalChunks).toBe(10); // 20MB / 2MB = 10
  });

  it('totalChunks is 1 for small files', () => {
    const session = createSession({
      finalKey: 'ws/tiny.jpg',
      fileSize: 1024, // 1KB
      contentType: 'image/jpeg',
    });

    expect(session.totalChunks).toBe(1);
  });

  it('retrieves session by uploadId', () => {
    const session = createSession({
      finalKey: 'ws/test.glb',
      fileSize: 1024,
      contentType: 'model/gltf-binary',
    });

    const retrieved = getSession(session.uploadId);
    expect(retrieved).toBeDefined();
    expect(retrieved!.uploadId).toBe(session.uploadId);
    expect(retrieved!.totalChunks).toBe(1);
  });

  it('getSession returns undefined for non-existent uploadId', () => {
    expect(getSession('nonexistent-id')).toBeUndefined();
  });

  it('recordChunk adds chunk index', () => {
    const session = createSession({
      finalKey: 'ws/test.glb',
      fileSize: 15 * 1024 * 1024,
      contentType: 'model/gltf-binary',
    });

    const updated = recordChunk(session.uploadId, 0);
    expect(updated).not.toBeNull();
    expect(updated!.uploadedChunks).toContain(0);

    recordChunk(session.uploadId, 1);
    const status = getSessionStatus(session.uploadId);
    expect(status!.uploadedChunks).toEqual([0, 1]);
  });

  it('recordChunk does not duplicate chunk index', () => {
    const session = createSession({
      finalKey: 'ws/test.glb',
      fileSize: 15 * 1024 * 1024,
      contentType: 'model/gltf-binary',
    });

    recordChunk(session.uploadId, 0);
    recordChunk(session.uploadId, 0); // duplicate
    recordChunk(session.uploadId, 0); // duplicate again

    const status = getSessionStatus(session.uploadId);
    expect(status!.uploadedChunks).toEqual([0]);
  });

  it('recordChunk returns null for invalid uploadId', () => {
    expect(recordChunk('invalid-id', 0)).toBeNull();
  });

  it('deleteSession removes session', () => {
    const session = createSession({
      finalKey: 'ws/to-delete.glb',
      fileSize: 1024,
      contentType: 'model/gltf-binary',
    });

    expect(getSession(session.uploadId)).toBeDefined();
    deleteSession(session.uploadId);
    expect(getSession(session.uploadId)).toBeUndefined();
  });

  it('getSessionStatus returns the full session', () => {
    const session = createSession({
      finalKey: 'ws/status-test.glb',
      fileSize: 50 * 1024 * 1024,
      contentType: 'model/gltf-binary',
    });

    const status = getSessionStatus(session.uploadId);
    expect(status).toBeDefined();
    expect(status!.totalChunks).toBe(10);
    expect(status!.status).toBe('uploading');
    expect(status!.fileSize).toBe(50 * 1024 * 1024);
  });

  it('generates unique uploadIds', () => {
    const s1 = createSession({ finalKey: 'ws/a.glb', fileSize: 100, contentType: 'model/gltf-binary' });
    const s2 = createSession({ finalKey: 'ws/b.glb', fileSize: 100, contentType: 'model/gltf-binary' });
    const s3 = createSession({ finalKey: 'ws/c.glb', fileSize: 100, contentType: 'model/gltf-binary' });

    expect(s1.uploadId).not.toBe(s2.uploadId);
    expect(s2.uploadId).not.toBe(s3.uploadId);
    expect(s1.uploadId).not.toBe(s3.uploadId);
  });
});
