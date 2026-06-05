import fs from 'fs';
import path from 'path';
import os from 'os';
import { LocalStorageAdapter } from '@/lib/storage/fs';

describe('LocalStorageAdapter — chunked upload', () => {
  let adapter: LocalStorageAdapter;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `chunked-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    const uploadsDir = path.join(tmpDir, 'uploads');
    fs.mkdirSync(uploadsDir, { recursive: true });

    adapter = new LocalStorageAdapter(uploadsDir);
  });

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('initChunkedUpload creates a session', async () => {
    const uploadId = await adapter.initChunkedUpload!('test/file.glb', 'model/gltf-binary');
    expect(uploadId).toBeDefined();
    expect(uploadId).toContain('upload_');
  });

  it('uploadChunk persists chunk data', async () => {
    const uploadId = await adapter.initChunkedUpload!('test/chunked.glb', 'model/gltf-binary');
    const data = Buffer.from('chunk data content');
    await adapter.uploadChunk!(uploadId, 0, data);

    const chunks = await adapter.getUploadedChunks!(uploadId);
    expect(chunks).toContain(0);
  });

  it('assembleChunks merges chunks into final file', async () => {
    const uploadId = await adapter.initChunkedUpload!('test/merged.glb', 'model/gltf-binary');

    const chunk1 = Buffer.from('AAAA');
    const chunk2 = Buffer.from('BBBB');
    const chunk3 = Buffer.from('CCCC');

    await adapter.uploadChunk!(uploadId, 0, chunk1);
    await adapter.uploadChunk!(uploadId, 1, chunk2);
    await adapter.uploadChunk!(uploadId, 2, chunk3);

    const storagePath = await adapter.assembleChunks!(uploadId, 3, 'test/merged.glb', 'model/gltf-binary');
    expect(storagePath).toContain('/uploads/test/merged.glb');

    // Verify final file content
    const finalPath = path.join(tmpDir, 'uploads', 'test', 'merged.glb');
    expect(fs.existsSync(finalPath)).toBe(true);
    const content = fs.readFileSync(finalPath);
    expect(content.toString()).toBe('AAAABBBBCCCC');

    // Chunk temp dir should be cleaned up
    const chunkDir = path.join(tmpDir, 'uploads', '.chunks', uploadId);
    expect(fs.existsSync(chunkDir)).toBe(false);
  });

  it('assembleChunks throws when chunk is missing', async () => {
    const uploadId = await adapter.initChunkedUpload!('test/missing-chunk.glb', 'model/gltf-binary');

    await adapter.uploadChunk!(uploadId, 0, Buffer.from('part0'));
    // Skip chunk 1
    await adapter.uploadChunk!(uploadId, 2, Buffer.from('part2'));

    await expect(adapter.assembleChunks!(uploadId, 3, 'test/missing-chunk.glb')).rejects.toThrow('Missing chunk');
  });

  it('abortChunkedUpload removes temp files', async () => {
    const uploadId = await adapter.initChunkedUpload!('test/aborted.glb', 'model/gltf-binary');
    await adapter.uploadChunk!(uploadId, 0, Buffer.from('data'));

    await adapter.abortChunkedUpload!(uploadId);

    const chunkDir = path.join(tmpDir, 'uploads', '.chunks', uploadId);
    expect(fs.existsSync(chunkDir)).toBe(false);
  });

  it('getUploadedChunks returns correct indices', async () => {
    const uploadId = await adapter.initChunkedUpload!('test/check.glb', 'model/gltf-binary');

    await adapter.uploadChunk!(uploadId, 0, Buffer.from('a'));
    await adapter.uploadChunk!(uploadId, 5, Buffer.from('b'));
    await adapter.uploadChunk!(uploadId, 10, Buffer.from('c'));

    const chunks = await adapter.getUploadedChunks!(uploadId);
    expect(chunks.sort((a, b) => a - b)).toEqual([0, 5, 10]);
  });

  it('getUploadedChunks returns empty for non-existent upload', async () => {
    const chunks = await adapter.getUploadedChunks!('nonexistent-id');
    expect(chunks).toEqual([]);
  });

  it('handles single-chunk file (tiny file)', async () => {
    const uploadId = await adapter.initChunkedUpload!('test/tiny.png', 'image/png');
    await adapter.uploadChunk!(uploadId, 0, Buffer.from('tiny image data'));

    const storagePath = await adapter.assembleChunks!(uploadId, 1, 'test/tiny.png', 'image/png');
    expect(storagePath).toContain('/uploads/test/tiny.png');
  });

  it('handles large number of chunks', async () => {
    const uploadId = await adapter.initChunkedUpload!('test/many.glb', 'model/gltf-binary');
    const chunkCount = 20;
    const expectedParts: string[] = [];

    for (let i = 0; i < chunkCount; i++) {
      const data = `chunk-${i.toString().padStart(4, '0')}`;
      expectedParts.push(data);
      await adapter.uploadChunk!(uploadId, i, Buffer.from(data));
    }

    const uploadedChunks = await adapter.getUploadedChunks!(uploadId);
    expect(uploadedChunks.length).toBe(chunkCount);

    const storagePath = await adapter.assembleChunks!(uploadId, chunkCount, 'test/many.glb', 'model/gltf-binary');
    expect(storagePath).toContain('/uploads/test/many.glb');

    const finalPath = path.join(tmpDir, 'uploads', 'test', 'many.glb');
    expect(fs.existsSync(finalPath)).toBe(true);
    const actual = fs.readFileSync(finalPath, 'utf-8');
    expect(actual).toBe(expectedParts.join(''));
  });
});
