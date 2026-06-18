/** Rigging HTTP client unit tests — mocks fetch, no real service needed. */

import {
  separateLayers, rigModel, exportModel, deployModel,
  runPipeline, downloadModelZip, checkHealth,
} from '@/lib/rigging/client';

const BASE = 'http://localhost:8001';

beforeEach(() => {
  jest.restoreAllMocks();
});

// ── checkHealth ─────────────────────────────────────

describe('checkHealth', () => {
  it('returns true when rigging is healthy', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: true });
    const ok = await checkHealth();
    expect(ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/api/health`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('returns false on network error', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const ok = await checkHealth();
    expect(ok).toBe(false);
  });

  it('returns false on non-2xx response', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: false, status: 500 });
    const ok = await checkHealth();
    expect(ok).toBe(false);
  });
});

// ── separateLayers ──────────────────────────────────

describe('separateLayers', () => {
  const mockSeparateResponse = {
    image_id: 'abc123',
    layers: [
      { label: 'face', texture_url: '/api/files/sep/abc/face.png', mask_url: '/api/files/sep/abc/face_mask.png', bbox: [10, 20, 50, 60] },
      { label: 'body', texture_url: '/api/files/sep/abc/body.png', mask_url: '/api/files/sep/abc/body_mask.png', bbox: [0, 0, 100, 150] },
    ],
    processing_time_ms: 1200,
  };

  it('returns layer list on success', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockSeparateResponse,
    });
    const result = await separateLayers('abc123', ['face', 'body']);
    expect(result.imageId).toBe('abc123');
    expect(result.layers).toHaveLength(2);
  });

  it('throws on 404 missing image', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ detail: 'No image found for xyz' }),
    });
    await expect(separateLayers('xyz')).rejects.toThrow('No image found for xyz');
  });
});

// ── rigModel ────────────────────────────────────────

describe('rigModel', () => {
  const mockRigResponse = {
    image_id: 'abc123',
    skeleton: { name: 'root', position: [0.5, 1], children: [] },
    mesh_count: 2,
    meshes: [{ label: 'face', vertex_count: 4, triangle_count: 2, vertices: [[0, 0]], uvs: [[0, 0]], indices: [0, 1, 2] }],
    weights: [{ label: 'face', bone_names: ['head'], vertex_count: 4, bone_count: 1, weights: [[{ bone: 'head', weight: 1 }]] }],
    processing_time_ms: 800,
  };

  it('returns skeleton and meshes', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockRigResponse,
    });
    const result = await rigModel('abc123', [], 'catgirl');
    expect(result.skeleton.name).toBe('root');
    expect(result.meshCount).toBe(2);
  });
});

// ── exportModel ─────────────────────────────────────

describe('exportModel', () => {
  const mockExportResponse = {
    cmo3_url: '/api/files/export/abc/model.cmo3',
    moc3_url: '/api/files/export/abc/model.moc3',
    model3_json_url: '/api/files/export/abc/model.model3.json',
    textures_urls: ['/api/files/sep/abc/face.png'],
    processing_time_ms: 500,
  };

  it('returns all export URLs', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockExportResponse,
    });
    const result = await exportModel('abc123', {}, [], [], []);
    expect(result.moc3Url).toContain('.moc3');
    expect(result.model3JsonUrl).toContain('.json');
  });
});

// ── deployModel ─────────────────────────────────────

describe('deployModel', () => {
  it('returns deployed path', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        model_id: 'abc123', deployed_path: '/data/deploy/pet_v1',
        reload_triggered: false, configs_written: ['c1', 'c2'], processing_time_ms: 200,
      }),
    });
    const result = await deployModel('abc123');
    expect(result.deployedPath).toContain('pet_v1');
    expect(result.reloadTriggered).toBe(false);
  });

  it('throws on 404', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false, status: 404,
      json: async () => ({ detail: 'Exported model not found' }),
    });
    await expect(deployModel('nope')).rejects.toThrow('Exported model not found');
  });
});

// ── runPipeline ─────────────────────────────────────

describe('runPipeline', () => {
  it('returns full pipeline result', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        separate: { image_id: 'abc', layers: [], processing_time_ms: 100 },
        rig: { image_id: 'abc', skeleton: {}, mesh_count: 0, meshes: [], weights: [], processing_time_ms: 200 },
        export: { cmo3_url: '/f.cmo3', moc3_url: null, model3_json_url: '/f.json', textures_urls: [], processing_time_ms: 300 },
        deploy: null,
        total_time_ms: 600,
      }),
    });
    const result = await runPipeline('abc123', { template: 'catgirl', meshDensity: 'medium' });
    expect(result.separate).toBeDefined();
    expect(result.rig).toBeDefined();
    expect(result.export).toBeDefined();
    expect(result.totalTimeMs).toBe(600);
  });
});

// ── downloadModelZip ────────────────────────────────

describe('downloadModelZip', () => {
  it('returns array buffer on success', async () => {
    const fakeBuffer = new ArrayBuffer(42);
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => fakeBuffer,
    });
    const buf = await downloadModelZip('abc123');
    expect(buf).toBeInstanceOf(ArrayBuffer);
    expect(buf.byteLength).toBe(42);
  });

  it('throws on failure', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false, status: 404,
    });
    await expect(downloadModelZip('nope')).rejects.toThrow();
  });
});

// ── Timeout ─────────────────────────────────────────

describe('timeout handling', () => {
  it('wraps AbortError as RIGGING_TIMEOUT', async () => {
    global.fetch = jest.fn().mockImplementation(() => {
      const err = new Error('The user aborted a request.');
      err.name = 'AbortError';
      return Promise.reject(err);
    });
    await expect(separateLayers('abc')).rejects.toThrow(/timed out/i);
  });

  it('wraps network error as RIGGING_UNREACHABLE', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(separateLayers('abc')).rejects.toThrow(/unreachable/i);
  });
});
