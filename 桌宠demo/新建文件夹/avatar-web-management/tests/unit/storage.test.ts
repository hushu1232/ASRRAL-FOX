// Mock fs before imports
const mockExistsSync = jest.fn();
const mockMkdirSync = jest.fn();
const mockWriteFileSync = jest.fn();
const mockReadFileSync = jest.fn();
const mockUnlinkSync = jest.fn();
const mockReaddirSync = jest.fn();
const mockRmSync = jest.fn();

jest.mock('fs', () => ({
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  writeFileSync: mockWriteFileSync,
  readFileSync: mockReadFileSync,
  unlinkSync: mockUnlinkSync,
  readdirSync: mockReaddirSync,
  rmSync: mockRmSync,
}));

jest.mock('minio', () => ({
  Client: jest.fn(),
  CopySourceOptions: {},
  CopyDestinationOptions: {},
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import { getStorageAdapter, LocalStorageAdapter, MinioStorageAdapter } from '@/lib/storage';

describe('getStorageAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    delete process.env.STORAGE_DRIVER;
    delete process.env.STORAGE_ENDPOINT;
  });

  async function loadStorage() {
    jest.resetModules();
    return import('@/lib/storage');
  }

  it('returns LocalStorageAdapter by default', async () => {
    const mod = await loadStorage();
    const adapter = mod.getStorageAdapter();
    expect(adapter).toBeDefined();
  });

  it('returns same instance on subsequent calls (singleton)', async () => {
    const mod = await loadStorage();
    const a1 = mod.getStorageAdapter();
    const a2 = mod.getStorageAdapter();
    expect(a1).toBe(a2);
  });
});

describe('LocalStorageAdapter', () => {
  let adapter: LocalStorageAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockReaddirSync.mockReturnValue([]);
    adapter = new LocalStorageAdapter('/tmp/test-storage');
  });

  describe('upload', () => {
    it('writes buffer to the base directory and returns storage path', async () => {
      const result = await adapter.upload('models/test.glb', Buffer.from('data'), 'application/octet-stream');
      expect(mockMkdirSync).toHaveBeenCalled();
      expect(mockWriteFileSync).toHaveBeenCalled();
      expect(result).toBe('/uploads/models/test.glb');
    });

    it('normalizes key by stripping /uploads/ prefix', async () => {
      await adapter.upload('/uploads/assets/model.glb', Buffer.from('data'));
      const filePath = mockWriteFileSync.mock.calls[0][0] as string;
      expect(filePath.replace(/\\/g, '/')).toContain('assets/model.glb');
      expect(filePath.replace(/\\/g, '/')).not.toContain('/uploads/');
    });

    it('ensures parent directory exists', async () => {
      await adapter.upload('deeply/nested/file.glb', Buffer.from('data'));
      expect(mockMkdirSync).toHaveBeenCalled();
    });
  });

  describe('getFileUrl', () => {
    it('returns key with /uploads/ prefix for plain keys', async () => {
      const url = await adapter.getFileUrl('models/test.glb');
      expect(url).toBe('/uploads/models/test.glb');
    });

    it('returns key as-is if already starting with /uploads/', async () => {
      const url = await adapter.getFileUrl('/uploads/models/test.glb');
      expect(url).toBe('/uploads/models/test.glb');
    });
  });

  describe('delete', () => {
    it('deletes file if it exists', async () => {
      mockExistsSync.mockReturnValue(true);
      await adapter.delete('models/old.glb');
      expect(mockUnlinkSync).toHaveBeenCalled();
    });

    it('does nothing if file does not exist', async () => {
      mockExistsSync.mockReturnValue(false);
      await adapter.delete('models/old.glb');
      expect(mockUnlinkSync).not.toHaveBeenCalled();
    });
  });

  describe('exists', () => {
    it('returns true when file exists', async () => {
      mockExistsSync.mockReturnValue(true);
      const result = await adapter.exists('models/test.glb');
      expect(result).toBe(true);
    });

    it('returns false when file does not exist', async () => {
      mockExistsSync.mockReturnValue(false);
      const result = await adapter.exists('models/test.glb');
      expect(result).toBe(false);
    });
  });

  describe('chunked upload', () => {
    describe('initChunkedUpload', () => {
      it('creates chunk directory and returns uploadId', async () => {
        const uploadId = await adapter.initChunkedUpload!('large-file.glb', 'application/octet-stream');
        expect(uploadId).toMatch(/^upload_\d+_/);
        expect(mockMkdirSync).toHaveBeenCalled();
        expect(mockWriteFileSync).toHaveBeenCalled(); // .meta.json
      });
    });

    describe('uploadChunk', () => {
      it('writes chunk to chunk directory', async () => {
        const uploadId = await adapter.initChunkedUpload!('file.glb');
        await adapter.uploadChunk!(uploadId, 0, Buffer.from('chunk-data'));
        expect(mockWriteFileSync).toHaveBeenCalled();
      });
    });

    describe('getUploadedChunks', () => {
      it('returns list of uploaded chunk indices', async () => {
        mockExistsSync.mockReturnValue(true);
        mockReaddirSync.mockReturnValue(['chunk_000000', 'chunk_000001', '.meta.json', 'chunk_000002']);
        const chunks = await adapter.getUploadedChunks!('upload_123');
        expect(chunks).toEqual([0, 1, 2]);
      });

      it('returns empty array when chunk dir does not exist', async () => {
        mockExistsSync.mockReturnValue(false);
        const chunks = await adapter.getUploadedChunks!('upload_123');
        expect(chunks).toEqual([]);
      });
    });

    describe('assembleChunks', () => {
      it('concatenates chunks into final file', async () => {
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync
          .mockReturnValueOnce(Buffer.from('part1'))
          .mockReturnValueOnce(Buffer.from('part2'))
          .mockReturnValueOnce(Buffer.from('part3'));

        const uploadId = await adapter.initChunkedUpload!('assembled.glb');
        const result = await adapter.assembleChunks!(uploadId, 3, 'assembled.glb');

        expect(result).toBe('/uploads/assembled.glb');
        expect(mockRmSync).toHaveBeenCalled(); // cleanup
      });

      it('throws if a chunk is missing', async () => {
        mockExistsSync.mockImplementation((p: string) => !p.includes('chunk_000001'));

        const uploadId = await adapter.initChunkedUpload!('incomplete.glb');
        await expect(adapter.assembleChunks!(uploadId, 3, 'incomplete.glb'))
          .rejects.toThrow('Missing chunk 1');
      });
    });

    describe('abortChunkedUpload', () => {
      it('removes chunk directory if it exists', async () => {
        mockExistsSync.mockReturnValue(true);
        await adapter.abortChunkedUpload!('upload_abort');
        expect(mockRmSync).toHaveBeenCalled();
      });

      it('does nothing if chunk directory does not exist', async () => {
        mockExistsSync.mockReturnValue(false);
        await adapter.abortChunkedUpload!('upload_abort');
        expect(mockRmSync).not.toHaveBeenCalled();
      });
    });
  });

  describe('key normalization', () => {
    it('handles keys with full /uploads/ prefix', async () => {
      await adapter.upload('/uploads/models/test.glb', Buffer.from('data'));
      const filePath = mockWriteFileSync.mock.calls[0][0] as string;
      expect(filePath.replace(/\\/g, '/')).toContain('test-storage');
      expect(filePath.replace(/\\/g, '/')).toContain('models/test.glb');
    });
  });
});
