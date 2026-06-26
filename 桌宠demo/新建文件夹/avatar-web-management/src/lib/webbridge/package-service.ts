import { createHash } from 'node:crypto';
import { NotFoundError } from '@/lib/errors';
import type { PetConfigExport } from '@/lib/services/petService';

export const CURRENT_PET_PACKAGE_ID = 'current-pet-character-bundle';
export const CHARACTER_CARD_FILE_ID = 'character-card';

export interface WebBridgePackageFileEntry {
  id: string;
  kind: 'characterCard';
  url: string;
  relativePath: string;
  sha256: string;
  size: number;
}

export interface WebBridgeConfigDraft {
  characterName: string;
  characterCardPath: string;
  live2DModelPath: string;
}

export interface WebBridgeActivationPolicy {
  autoApply: boolean;
  requiresLocalConfirmation: boolean;
}

export interface WebBridgePackageManifest {
  schemaVersion: 1;
  packageId: string;
  packageType: 'characterBundle';
  displayName: string;
  version: string;
  files: WebBridgePackageFileEntry[];
  configDraft: WebBridgeConfigDraft;
  activationPolicy: WebBridgeActivationPolicy;
}

export interface BuildWebBridgePackageManifestOptions {
  packageId: string;
  origin: string;
  petExport: PetConfigExport;
}

export interface BuildWebBridgePackageFileOptions {
  packageId: string;
  fileId: string;
  petExport: PetConfigExport;
}

export interface WebBridgePackageFileDownload {
  fileId: string;
  contentType: string;
  bytes: Buffer;
}

const CHARACTER_CARD_RELATIVE_PATH = 'characters/current-pet/card.json';

export function buildWebBridgePackageManifest({
  packageId,
  origin,
  petExport,
}: BuildWebBridgePackageManifestOptions): WebBridgePackageManifest {
  assertCurrentPetPackage(packageId);

  const file = buildWebBridgePackageFile({
    packageId,
    fileId: CHARACTER_CARD_FILE_ID,
    petExport,
  });
  const fileUrl = new URL(
    `/api/webbridge/packages/${encodeURIComponent(packageId)}/files/${encodeURIComponent(file.fileId)}`,
    origin
  );

  return {
    schemaVersion: 1,
    packageId,
    packageType: 'characterBundle',
    displayName: `${petExport.petName} Character Bundle`,
    version: String(petExport.version || 1),
    files: [
      {
        id: file.fileId,
        kind: 'characterCard',
        url: fileUrl.toString(),
        relativePath: CHARACTER_CARD_RELATIVE_PATH,
        sha256: sha256(file.bytes),
        size: file.bytes.byteLength,
      },
    ],
    configDraft: {
      characterName: petExport.petName,
      characterCardPath: CHARACTER_CARD_RELATIVE_PATH,
      live2DModelPath: petExport.modelPath || '',
    },
    activationPolicy: {
      autoApply: false,
      requiresLocalConfirmation: true,
    },
  };
}

export function buildWebBridgePackageFile({
  packageId,
  fileId,
  petExport,
}: BuildWebBridgePackageFileOptions): WebBridgePackageFileDownload {
  assertCurrentPetPackage(packageId);
  if (fileId !== CHARACTER_CARD_FILE_ID) {
    throw new NotFoundError('WebBridge package file', fileId);
  }

  const card = {
    schemaVersion: 1,
    name: petExport.petName,
    personality: petExport.personality,
    backstory: petExport.backstory,
    characterExtra: petExport.characterExtra || '',
    animationModel: petExport.animationModel,
    avatarId: petExport.avatarId,
    modelPath: petExport.modelPath,
    params: petExport.params,
    bodyParams: petExport.bodyParams,
    equippedParts: petExport.equippedParts,
    materialOverrides: petExport.materialOverrides,
    mappedAssets: petExport.mappedAssets,
    localServices: {
      ttsLocalUrl: petExport.ttsLocalUrl,
      sttLocalUrl: petExport.sttLocalUrl,
      llmModelPath: petExport.llmModelPath,
      sovitsUrl: petExport.sovitsUrl,
      sovitsReferenceVoiceId: petExport.sovitsReferenceVoiceId,
      enableWakeWord: petExport.enableWakeWord,
      wakeWord: petExport.wakeWord,
      wakeSensitivity: petExport.wakeSensitivity,
      autoStartServices: petExport.autoStartServices,
      pipelineTimeout: petExport.pipelineTimeout,
    },
  };

  return {
    fileId,
    contentType: 'application/json; charset=utf-8',
    bytes: Buffer.from(`${JSON.stringify(card, null, 2)}\n`, 'utf8'),
  };
}

function assertCurrentPetPackage(packageId: string): void {
  if (packageId !== CURRENT_PET_PACKAGE_ID) {
    throw new NotFoundError('WebBridge package', packageId);
  }
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}
