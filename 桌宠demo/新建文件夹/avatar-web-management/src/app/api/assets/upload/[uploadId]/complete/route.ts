export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/auth/middleware';
import { getStorageAdapter } from '@/lib/storage';
import { getSession, deleteSession } from '@/lib/storage/chunked-upload';
import { enqueueJob } from '@/lib/storage/pipeline';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:upload-complete');

function getAssetType(ext: string): string {
  if (['.glb', '.gltf', '.fbx', '.obj', '.blend'].includes(ext)) return 'model';
  if (['.png', '.jpg', '.jpeg'].includes(ext)) return 'texture';
  if (['.hdr', '.exr'].includes(ext)) return 'hdri';
  if (['.mp4'].includes(ext)) return 'animation';
  return 'model';
}

export const POST = withAuth(async (req, user) => {
  try {
    const uploadId = req.nextUrl.pathname.split('/').filter(Boolean).at(-2) || '';

    if (!uploadId || uploadId === 'upload') {
      return NextResponse.json({ success: false, error: '缺少 uploadId' }, { status: 400 });
    }

    const session = getSession(uploadId);
    if (!session) {
      return NextResponse.json({ success: false, error: '上传会话不存在或已过期' }, { status: 404 });
    }

    if (session.uploadedChunks.length < session.totalChunks) {
      const missing = [];
      for (let i = 0; i < session.totalChunks; i++) {
        if (!session.uploadedChunks.includes(i)) missing.push(i);
      }
      return NextResponse.json({
        success: false,
        error: `尚有 ${missing.length} 个分块未上传`,
        data: { missingChunks: missing.slice(0, 10) },
      }, { status: 400 });
    }

    const storage = getStorageAdapter();
    if (!storage.assembleChunks) {
      return NextResponse.json({ success: false, error: '存储适配器不支持分块合并' }, { status: 500 });
    }

    session.status = 'assembling';

    const storagePath = await storage.assembleChunks(
      uploadId,
      session.totalChunks,
      session.finalKey,
      session.contentType,
    );

    const finalKey = session.finalKey.replace('pending/', '');
    const ext = finalKey.slice(finalKey.lastIndexOf('.')).toLowerCase();
    const assetType = getAssetType(ext);

    const id = uuidv4();

    const asset = await prisma.asset.create({
      data: {
        id,
        workspaceId: user.workspaceId,
        uploaderId: user.sub,
        filename: finalKey.split('-').slice(1).join('-'),
        fileSize: BigInt(session.fileSize),
        mimeType: session.contentType,
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
      mimeType: session.contentType,
      assetType,
    });

    session.status = 'completed';
    deleteSession(uploadId);

    return NextResponse.json({ success: true, data: asset });
  } catch (err) {
    log.error({ err }, 'Upload complete error');
    return NextResponse.json({ success: false, error: '合并分块失败: ' + String(err) }, { status: 500 });
  }
});
