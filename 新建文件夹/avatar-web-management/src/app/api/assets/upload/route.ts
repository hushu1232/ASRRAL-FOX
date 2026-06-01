export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/auth/middleware';
import { getStorageAdapter } from '@/lib/storage';
import { enqueueJob } from '@/lib/storage/pipeline';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:upload');

const ALLOWED_EXTENSIONS = ['.glb', '.gltf', '.png', '.jpg', '.jpeg', '.hdr', '.exr', '.fbx', '.blend', '.obj', '.mtl', '.mp4'];

const MIME_TO_TYPE: Record<string, string> = {
  'model/gltf-binary': 'model',
  'model/gltf+json': 'model',
  'model/gltf': 'model',
  'image/png': 'texture',
  'image/jpeg': 'texture',
  'image/jpg': 'texture',
};

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._\-一-鿿]/g, '_').replace(/\.\./g, '');
}

function getExtension(filename: string): string {
  return path.extname(filename).toLowerCase();
}

function mimeToAssetType(mime: string, ext: string): string {
  if (MIME_TO_TYPE[mime]) return MIME_TO_TYPE[mime];
  if (['.glb', '.gltf', '.fbx', '.obj', '.blend'].includes(ext)) return 'model';
  if (['.png', '.jpg', '.jpeg'].includes(ext)) return 'texture';
  if (['.hdr', '.exr'].includes(ext)) return 'hdri';
  if (['.mp4'].includes(ext)) return 'animation';
  return 'model';
}

export const POST = withAuth(async (req, user) => {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: '未选择文件' }, { status: 400 });
    }

    const originalName = sanitizeFilename(file.name);
    const ext = getExtension(originalName);

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({
        success: false,
        error: `不支持的文件类型: ${ext}。支持: ${ALLOWED_EXTENSIONS.join(', ')}`,
      }, { status: 400 });
    }

    const MAX_SIZE = 500 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({
        success: false,
        error: `文件大小超过限制 (${(MAX_SIZE / 1024 / 1024).toFixed(0)}MB)`,
      }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const timestamp = Date.now();
    const safeName = `${timestamp}-${originalName}`;
    const assetType = mimeToAssetType(file.type, ext);

    const storageKey = `${user.workspaceId}/${assetType}/${safeName}`;
    const storage = getStorageAdapter();
    const storagePath = await storage.upload(storageKey, buffer, file.type);

    const id = uuidv4();

    const asset = await prisma.asset.create({
      data: {
        id,
        workspaceId: user.workspaceId,
        uploaderId: user.sub,
        filename: safeName,
        fileSize: BigInt(file.size),
        mimeType: file.type || 'application/octet-stream',
        storagePath,
        assetType,
        format: ext.replace('.', ''),
        license: 'cc_by',
        tags: '[]',
        status: 'processing',
      },
    });

    enqueueJob({
      assetId: id,
      storagePath,
      mimeType: file.type || 'application/octet-stream',
      assetType,
    });

    return NextResponse.json({ success: true, data: { ...asset, fileSize: Number(asset.fileSize) } }, { status: 201 });
  } catch (err) {
    log.error({ err }, 'Upload error');
    return NextResponse.json({ success: false, error: '上传失败: ' + String(err) }, { status: 500 });
  }
});
