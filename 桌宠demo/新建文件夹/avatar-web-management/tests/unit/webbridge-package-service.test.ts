import { createHash } from 'node:crypto';
import { NotFoundError } from '@/lib/errors';
import {
  CURRENT_PET_PACKAGE_ID,
  CHARACTER_CARD_FILE_ID,
  buildWebBridgePackageFile,
  buildWebBridgePackageManifest,
} from '@/lib/webbridge/package-service';

const petExport = {
  version: 1,
  petName: 'XiaYu',
  personality: 'calm',
  backstory: 'from WebBridge tests',
  characterExtra: 'likes local confirmation',
  animationModel: 'live2d',
  idleTimeout: 300,
  wanderInterval: 15,
  params: [],
  bodyParams: [],
  equippedParts: [],
  materialOverrides: {},
  mappedAssets: [],
};

describe('webbridge package service', () => {
  it('builds an install-only current pet character bundle manifest', () => {
    const manifest = buildWebBridgePackageManifest({
      packageId: CURRENT_PET_PACKAGE_ID,
      origin: 'http://localhost:3000',
      petExport,
    });

    expect(manifest.packageId).toBe(CURRENT_PET_PACKAGE_ID);
    expect(manifest.packageType).toBe('characterBundle');
    expect(manifest.files).toHaveLength(1);
    expect(manifest.files[0].kind).toBe('characterCard');
    expect(manifest.files[0].relativePath).toBe('characters/current-pet/card.json');
    expect(manifest.configDraft.characterName).toBe('XiaYu');
    expect(manifest.configDraft.characterCardPath).toBe('characters/current-pet/card.json');
    expect(manifest.activationPolicy.autoApply).toBe(false);
    expect(manifest.activationPolicy.requiresLocalConfirmation).toBe(true);
  });

  it('uses the same SHA-256 in the manifest as the downloadable character-card bytes', () => {
    const manifest = buildWebBridgePackageManifest({
      packageId: CURRENT_PET_PACKAGE_ID,
      origin: 'http://localhost:3000',
      petExport,
    });
    const file = buildWebBridgePackageFile({
      packageId: CURRENT_PET_PACKAGE_ID,
      fileId: CHARACTER_CARD_FILE_ID,
      petExport,
    });

    const expectedHash = createHash('sha256').update(file.bytes).digest('hex');

    expect(manifest.files[0].sha256).toBe(expectedHash);
    expect(manifest.files[0].size).toBe(file.bytes.byteLength);
    expect(JSON.parse(file.bytes.toString('utf8')).name).toBe('XiaYu');
  });

  it('rejects unknown package ids', () => {
    expect(() => buildWebBridgePackageManifest({
      packageId: 'unknown-package',
      origin: 'http://localhost:3000',
      petExport,
    })).toThrow(NotFoundError);
  });

  it('rejects unknown file ids', () => {
    expect(() => buildWebBridgePackageFile({
      packageId: CURRENT_PET_PACKAGE_ID,
      fileId: 'unknown-file',
      petExport,
    })).toThrow(NotFoundError);
  });
});
