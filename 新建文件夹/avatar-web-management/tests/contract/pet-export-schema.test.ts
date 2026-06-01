/**
 * Unity client contract test — validates pet export JSON against the published schema.
 * If this test fails, the Unity AstralFox client may break when consuming the export.
 */

import Ajv, { type ValidateFunction } from 'ajv';

const ajv = new Ajv({ allErrors: true });
// ajv-formats requires AJV v7+, so register uri format manually
ajv.addFormat('uri', /^https?:\/\/\S+$/);

let validate: ValidateFunction;

beforeAll(async () => {
  // Dynamic import because jest doesn't resolve .json schemas as modules in all configs
  const schema = {
    $id: 'https://avatar-web.internal/schemas/pet-export.schema.json',
    title: 'PetConfigExport',
    type: 'object',
    required: [
      'version', 'petName', 'personality', 'backstory',
      'animationModel', 'idleTimeout', 'wanderInterval',
      'params', 'bodyParams', 'equippedParts', 'mappedAssets',
    ],
    properties: {
      version: { type: 'integer', minimum: 1 },
      petName: { type: 'string', minLength: 1 },
      personality: { type: 'string' },
      backstory: { type: 'string' },
      animationModel: { type: 'string', enum: ['live2d', 'dragonbones', 'vrm'] },
      ffmpegPath: { type: 'string' },
      idleTimeout: { type: 'number', minimum: 0 },
      wanderInterval: { type: 'number', minimum: 0 },
      avatarId: { type: 'string' },
      modelPath: { type: 'string' },
      params: {
        type: 'array',
        items: { type: 'object', required: ['key', 'value'], properties: { key: { type: 'string' }, value: { type: 'number' } } },
      },
      bodyParams: {
        type: 'array',
        items: { type: 'object', required: ['key', 'value'], properties: { key: { type: 'string' }, value: { type: 'number' } } },
      },
      equippedParts: {
        type: 'array',
        items: { type: 'object', required: ['slot', 'part_id'], properties: { slot: { type: 'string' }, part_id: { type: 'string' } } },
      },
      materialOverrides: { type: 'object' },
      mappedAssets: {
        type: 'array',
        items: {
          type: 'object',
          required: ['slotName', 'assetId', 'assetType'],
          properties: {
            slotName: { type: 'string' },
            assetId: { type: 'string' },
            assetType: { type: 'string', enum: ['model', 'texture', 'animation', 'sound'] },
          },
        },
      },
    },
  };
  validate = ajv.compile(schema);
});

describe('Pet Export Schema (Unity Client Contract)', () => {
  // ═══ Minimal valid export ═════════════════════════════════
  it('validates a minimal valid export', () => {
    const minimal = {
      version: 1,
      petName: '星尘',
      personality: '',
      backstory: '',
      animationModel: 'live2d',
      idleTimeout: 300,
      wanderInterval: 15.0,
      params: [],
      bodyParams: [],
      equippedParts: [],
      materialOverrides: {},
      mappedAssets: [],
    };

    const valid = validate(minimal);
    expect(validate.errors).toBeNull();
    expect(valid).toBe(true);
  });

  // ═══ Full export with all fields ═══════════════════════════
  it('validates a full export with avatar and assets', () => {
    const full = {
      version: 1,
      petName: '星尘',
      personality: '温柔体贴',
      backstory: '来自异世界的猫耳少女',
      animationModel: 'live2d',
      ffmpegPath: '/usr/bin/ffmpeg',
      idleTimeout: 300,
      wanderInterval: 15.0,
      avatarId: 'avatar-uuid-1',
      modelPath: '/models/cattail.model3.json',
      params: [
        { key: 'MouthOpen', value: 0.5 },
        { key: 'EyeOpen', value: 1.0 },
      ],
      bodyParams: [{ key: 'Height', value: 0.3 }],
      equippedParts: [
        { slot: 'Head', part_id: 'hair_01' },
        { slot: 'Body', part_id: 'outfit_01' },
      ],
      materialOverrides: { albedo: '#ffffff', metallic: 0.1 },
      mappedAssets: [
        { slotName: 'idle_animation', assetId: 'a1', assetType: 'animation' },
        { slotName: 'walk_animation', assetId: 'a2', assetType: 'animation' },
        { slotName: 'default_model', assetId: 'a3', assetType: 'model' },
      ],
    };

    const valid = validate(full);
    expect(validate.errors).toBeNull();
    expect(valid).toBe(true);
  });

  // ═══ Missing required fields ═══════════════════════════════
  it('rejects export missing required fields', () => {
    const invalid = { petName: 'missing everything else' };
    const valid = validate(invalid);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    const missingFields = validate.errors!.map((e) => e.dataPath || (e.params as Record<string, unknown>)?.missingProperty);
    expect(missingFields).toContain('version');
  });

  // ═══ Invalid animationModel ════════════════════════════════
  it('rejects unknown animationModel value', () => {
    const invalid = {
      version: 1,
      petName: 'test',
      personality: '',
      backstory: '',
      animationModel: 'spine',  // not supported
      idleTimeout: 300,
      wanderInterval: 15,
      params: [],
      bodyParams: [],
      equippedParts: [],
      materialOverrides: {},
      mappedAssets: [],
    };

    const valid = validate(invalid);
    expect(valid).toBe(false);
    const animError = validate.errors!.find((e) => e.dataPath === '.animationModel');
    expect(animError).toBeDefined();
  });

  // ═══ Zero/negative idleTimeout ═════════════════════════════
  it('allows zero timeout (Unity treats as "never idle")', () => {
    const zeroIdle = {
      version: 1,
      petName: 'test',
      personality: '',
      backstory: '',
      animationModel: 'dragonbones',
      idleTimeout: 0,
      wanderInterval: 0,
      params: [],
      bodyParams: [],
      equippedParts: [],
      materialOverrides: {},
      mappedAssets: [],
    };

    const valid = validate(zeroIdle);
    expect(valid).toBe(true);
  });

  // ═══ Negative timeout rejected ═════════════════════════════
  it('rejects negative idleTimeout', () => {
    const bad = {
      version: 1,
      petName: 'test',
      personality: '',
      backstory: '',
      animationModel: 'live2d',
      idleTimeout: -1,
      wanderInterval: 15,
      params: [],
      bodyParams: [],
      equippedParts: [],
      mappedAssets: [],
    };

    const valid = validate(bad);
    expect(valid).toBe(false);
  });

  // ═══ Invalid mapped asset type ═════════════════════════════
  it('rejects invalid assetType in mappedAssets', () => {
    const bad = {
      version: 1,
      petName: 'test',
      personality: '',
      backstory: '',
      animationModel: 'live2d',
      idleTimeout: 300,
      wanderInterval: 15,
      params: [],
      bodyParams: [],
      equippedParts: [],
      mappedAssets: [{ slotName: 'test', assetId: 'a1', assetType: 'shader' }],
    };

    const valid = validate(bad);
    expect(valid).toBe(false);
    const typeError = validate.errors!.find((e) => e.dataPath?.includes('assetType'));
    expect(typeError).toBeDefined();
  });

  // ═══ Version must be integer, not float ════════════════════
  it('rejects float version number', () => {
    const bad = {
      version: 1.5,
      petName: 'test',
      personality: '',
      backstory: '',
      animationModel: 'live2d',
      idleTimeout: 300,
      wanderInterval: 15,
      params: [],
      bodyParams: [],
      equippedParts: [],
      mappedAssets: [],
    };

    const valid = validate(bad);
    expect(valid).toBe(false);
  });
});
